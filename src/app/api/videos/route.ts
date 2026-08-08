import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { videos, channels } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { extractVideoId, getVideoInfo } from '@/lib/youtube';
import { enqueueTranscriptJob } from '@/lib/queue';
import { z } from 'zod';

// GET /api/videos?page=1&limit=20&channelId=...&status=...
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = (page - 1) * limit;

  try {
    const allVideos = await db
      .select({
        video: videos,
        channelName: channels.name,
        channelThumbnail: channels.thumbnailUrl,
      })
      .from(videos)
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db.$count(videos);

    return NextResponse.json({
      videos: allVideos,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Videos GET]', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}

const addVideoSchema = z.object({
  url: z.string().min(1),
  channelId: z.string().uuid().optional(),
});

// POST /api/videos — manually add a video
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = addVideoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { url, channelId } = parsed.data;

    const youtubeVideoId = extractVideoId(url);
    if (!youtubeVideoId) {
      return NextResponse.json({ error: 'Invalid YouTube video URL' }, { status: 400 });
    }

    // Check for duplicate
    const [existing] = await db
      .select({ id: videos.id, transcriptStatus: videos.transcriptStatus })
      .from(videos)
      .where(eq(videos.youtubeVideoId, youtubeVideoId))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        error: 'Video already added',
        video: existing,
      }, { status: 409 });
    }

    // Fetch video metadata from YouTube API
    const videoInfo = await getVideoInfo(youtubeVideoId);

    // Insert video
    const [newVideo] = await db
      .insert(videos)
      .values({
        youtubeVideoId: videoInfo.id,
        channelId: channelId ?? null,
        addedByUserId: session.user?.id,
        title: videoInfo.title,
        description: videoInfo.description,
        thumbnailUrl: videoInfo.thumbnailUrl,
        durationSeconds: videoInfo.durationSeconds,
        publishedAt: videoInfo.publishedAt,
        isLivestream: videoInfo.isLivestream,
        transcriptStatus: 'pending',
      })
      .returning();

    // Queue for transcript processing
    await enqueueTranscriptJob(newVideo.id, youtubeVideoId);

    return NextResponse.json({ video: newVideo }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Videos POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
