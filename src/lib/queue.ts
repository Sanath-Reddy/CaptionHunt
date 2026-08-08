/**
 * Async job queue for background transcript processing.
 * Simple in-process queue with concurrency control.
 * Upgradeable to BullMQ/Redis for production.
 */
import { db } from '@/db';
import { processingJobs, videos } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { processAndStoreTranscript } from './transcript';

interface Job {
  jobId: string;
  videoId: string;
  youtubeVideoId: string;
}

const MAX_CONCURRENT = 2;
const MAX_ATTEMPTS = 3;

let activeJobs = 0;
const queue: Job[] = [];

/**
 * Add a video to the processing queue.
 * Creates a processing_jobs record and triggers processing.
 */
export async function enqueueTranscriptJob(videoId: string, youtubeVideoId: string): Promise<string> {
  // Create job record in DB
  const [job] = await db
    .insert(processingJobs)
    .values({ videoId, status: 'pending' })
    .returning({ id: processingJobs.id });

  // Add to in-memory queue
  queue.push({ jobId: job.id, videoId, youtubeVideoId });

  // Trigger processing (non-blocking)
  processQueue();

  return job.id;
}

/**
 * Process queued jobs up to MAX_CONCURRENT at a time.
 */
function processQueue() {
  while (activeJobs < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    activeJobs++;
    processJob(job).finally(() => {
      activeJobs--;
      processQueue(); // process next item when slot frees
    });
  }
}

async function processJob(job: Job) {
  const { jobId, videoId, youtubeVideoId } = job;

  // Update job status
  await db
    .update(processingJobs)
    .set({ status: 'processing' })
    .where(eq(processingJobs.id, jobId));

  try {
    const { segmentCount } = await processAndStoreTranscript(videoId, youtubeVideoId);

    await db
      .update(processingJobs)
      .set({
        status: 'completed',
        processedAt: new Date(),
      })
      .where(eq(processingJobs.id, jobId));

    console.log(`[Queue] Job ${jobId}: processed ${segmentCount} segments for video ${youtubeVideoId}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Queue] Job ${jobId} failed:`, errMsg);

    // Get current attempt count
    const [currentJob] = await db
      .select({ attempts: processingJobs.attempts })
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId));

    const attempts = (currentJob?.attempts ?? 0) + 1;

    if (attempts < MAX_ATTEMPTS) {
      // Re-queue with exponential backoff
      await db
        .update(processingJobs)
        .set({ status: 'pending', attempts, errorMessage: errMsg })
        .where(eq(processingJobs.id, jobId));

      const delay = Math.pow(2, attempts) * 5000; // 10s, 20s, 40s...
      setTimeout(() => {
        queue.push(job);
        processQueue();
      }, delay);
    } else {
      await db
        .update(processingJobs)
        .set({
          status: 'failed',
          attempts,
          errorMessage: errMsg,
          processedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));
    }
  }
}

/**
 * Get queue stats for display in the UI.
 */
export function getQueueStats() {
  return {
    queued: queue.length,
    active: activeJobs,
  };
}
