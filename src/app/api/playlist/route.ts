import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { videos } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { extractPlaylistId, getPlaylistInfo, getPlaylistVideos, getVideoInfo } from '@/lib/youtube';
import { enqueueTranscriptJob } from '@/lib/queue';
import { z } from 'zod';

// GET /api/playlist?url=... — preview playlist metadata without importing
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url')?.trim() ?? '';

  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  const playlistId = extractPlaylistId(url);
  if (!playlistId) {
    return NextResponse.json({ error: 'Invalid YouTube playlist URL' }, { status: 400 });
  }

  try {
    const info = await getPlaylistInfo(playlistId);
    return NextResponse.json({ playlist: info });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch playlist';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

const importPlaylistSchema = z.object({
  url: z.string().min(1),
});

// POST /api/playlist — fetch all video IDs from playlist and enqueue each
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = importPlaylistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const playlistId = extractPlaylistId(parsed.data.url);
    if (!playlistId) {
      return NextResponse.json({ error: 'Invalid YouTube playlist URL' }, { status: 400 });
    }

    // Fetch all video IDs from the playlist (paginated internally)
    const playlistItems = await getPlaylistVideos(playlistId);
    if (playlistItems.length === 0) {
      return NextResponse.json({ error: 'Playlist is empty or private' }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of playlistItems) {
      try {
        // Skip already-added videos
        const [existing] = await db
          .select({ id: videos.id })
          .from(videos)
          .where(eq(videos.youtubeVideoId, item.videoId))
          .limit(1);

        if (existing) {
          skipped++;
          continue;
        }

        // Fetch full metadata
        const videoInfo = await getVideoInfo(item.videoId);

        const [newVideo] = await db
          .insert(videos)
          .values({
            youtubeVideoId: videoInfo.id,
            channelId: null,
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

        await enqueueTranscriptJob(newVideo.id, videoInfo.id);
        added++;
      } catch (err) {
        // Don't abort the whole import for a single bad video
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${item.videoId}: ${msg}`);
      }
    }

    return NextResponse.json({
      added,
      skipped,
      total: playlistItems.length,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Import failed';
    console.error('[Playlist POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
