/**
 * Transcript extraction and storage service.
 * Fetches captions from YouTube, chunks them into searchable segments,
 * and stores them in the database with embeddings.
 */
import { YoutubeTranscript } from 'youtube-transcript';
import { db } from '@/db';
import { transcriptSegments, videos } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateEmbedding } from './embeddings';

export interface TranscriptChunk {
  text: string;
  startTime: number;
  endTime: number;
}

// ─── Fetch Raw Transcript ─────────────────────────────────────────────────────
export async function fetchRawTranscript(videoId: string): Promise<TranscriptChunk[]> {
  const rawSegments = await YoutubeTranscript.fetchTranscript(videoId);

  return rawSegments.map((seg) => ({
    text: seg.text.trim(),
    startTime: seg.offset / 1000, // convert ms to seconds
    endTime: (seg.offset + seg.duration) / 1000,
  }));
}

// ─── Chunk Transcript ─────────────────────────────────────────────────────────
/**
 * Groups raw caption segments into larger, more meaningful chunks.
 * This improves search quality and embedding coherence.
 * 
 * Strategy: merge segments into ~30-second windows, respecting sentence boundaries.
 */
export function chunkTranscript(
  rawSegments: TranscriptChunk[],
  targetDurationSeconds = 30
): TranscriptChunk[] {
  if (rawSegments.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let currentText = '';
  let chunkStart = rawSegments[0].startTime;
  let chunkEnd = rawSegments[0].endTime;

  for (const seg of rawSegments) {
    const chunkDuration = seg.endTime - chunkStart;

    if (chunkDuration > targetDurationSeconds && currentText.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentText.trim(),
        startTime: chunkStart,
        endTime: chunkEnd,
      });
      // Start new chunk
      currentText = seg.text;
      chunkStart = seg.startTime;
      chunkEnd = seg.endTime;
    } else {
      currentText = currentText ? `${currentText} ${seg.text}` : seg.text;
      chunkEnd = seg.endTime;
    }
  }

  // Push last chunk
  if (currentText.trim()) {
    chunks.push({
      text: currentText.trim(),
      startTime: chunkStart,
      endTime: chunkEnd,
    });
  }

  return chunks;
}

// ─── Process and Store ────────────────────────────────────────────────────────
/**
 * Full pipeline: fetch → chunk → embed → store
 * Updates the video's transcript_status throughout the process.
 */
export async function processAndStoreTranscript(
  videoId: string, // our DB video ID (uuid)
  youtubeVideoId: string
): Promise<{ segmentCount: number }> {
  try {
    // Mark as processing
    await db
      .update(videos)
      .set({ transcriptStatus: 'processing', updatedAt: new Date() })
      .where(eq(videos.id, videoId));

    // Fetch raw transcript
    const rawSegments = await fetchRawTranscript(youtubeVideoId);

    if (rawSegments.length === 0) {
      await db
        .update(videos)
        .set({ transcriptStatus: 'no_captions', updatedAt: new Date() })
        .where(eq(videos.id, videoId));
      return { segmentCount: 0 };
    }

    // Chunk into larger segments
    const chunks = chunkTranscript(rawSegments);

    // Delete existing segments (if reprocessing)
    await db.delete(transcriptSegments).where(eq(transcriptSegments.videoId, videoId));

    // Generate embeddings and store in batches
    const BATCH_SIZE = 10;
    let totalStored = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      // Generate embeddings for batch
      const embeddings = await Promise.all(
        batch.map((chunk) => generateEmbedding(chunk.text))
      );

      // Insert batch
      const rows = batch.map((chunk, idx) => ({
        videoId,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        text: chunk.text,
        embedding: embeddings[idx],
      }));

      await db.insert(transcriptSegments).values(rows);
      totalStored += rows.length;
    }

    // Mark as completed
    await db
      .update(videos)
      .set({
        transcriptStatus: 'completed',
        segmentCount: totalStored,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    return { segmentCount: totalStored };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    // Detect "no captions" errors
    const isNoCaptions =
      errMsg.includes('Could not get') ||
      errMsg.includes('Transcript is disabled') ||
      errMsg.includes('no transcript');

    await db
      .update(videos)
      .set({
        transcriptStatus: isNoCaptions ? 'no_captions' : 'failed',
        transcriptError: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    throw error;
  }
}
