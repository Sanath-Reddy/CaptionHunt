import { NextResponse } from 'next/server';
import { db } from '@/db';
import { videos, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { extractVideoId, getVideoInfo } from '@/lib/youtube';
import { enqueueTranscriptJob } from '@/lib/queue';
import { XMLParser } from 'fast-xml-parser';

// Verify PubSubHubbub subscription (YouTube sends a GET request)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('hub.challenge');
  const mode = searchParams.get('hub.mode');

  if (mode === 'subscribe' || mode === 'unsubscribe') {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Bad Request', { status: 400 });
}

// Receive new video upload notifications from YouTube
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(body);

    const entry = parsed?.feed?.entry;
    if (!entry) return new Response('OK', { status: 200 });

    const youtubeVideoId = entry['yt:videoId'];
    const youtubeChannelId = entry['yt:channelId'];

    if (!youtubeVideoId || !youtubeChannelId) {
      return new Response('OK', { status: 200 });
    }

    // Find the channel in our DB
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, youtubeChannelId))
      .limit(1);

    if (!channel || !channel.autoProcess) {
      return new Response('OK', { status: 200 });
    }

    // Check if video already exists
    const [existing] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.youtubeVideoId, youtubeVideoId))
      .limit(1);

    if (existing) {
      return new Response('OK', { status: 200 });
    }

    // Fetch video metadata and apply channel filters
    const videoInfo = await getVideoInfo(youtubeVideoId);

    // Apply duration filters
    if (channel.filterMinDuration && videoInfo.durationSeconds < channel.filterMinDuration) {
      console.log(`[Webhook] Video ${youtubeVideoId} skipped: too short (${videoInfo.durationSeconds}s < ${channel.filterMinDuration}s)`);
      return new Response('OK', { status: 200 });
    }
    if (channel.filterMaxDuration && videoInfo.durationSeconds > channel.filterMaxDuration) {
      console.log(`[Webhook] Video ${youtubeVideoId} skipped: too long`);
      return new Response('OK', { status: 200 });
    }

    // Apply content type filter
    if (channel.filterContentType === 'videos_only' && videoInfo.isLivestream) {
      return new Response('OK', { status: 200 });
    }
    if (channel.filterContentType === 'streams_only' && !videoInfo.isLivestream) {
      return new Response('OK', { status: 200 });
    }

    // Insert video and queue for processing
    const [newVideo] = await db
      .insert(videos)
      .values({
        youtubeVideoId: videoInfo.id,
        channelId: channel.id,
        title: videoInfo.title,
        description: videoInfo.description,
        thumbnailUrl: videoInfo.thumbnailUrl,
        durationSeconds: videoInfo.durationSeconds,
        publishedAt: videoInfo.publishedAt,
        isLivestream: videoInfo.isLivestream,
        transcriptStatus: 'pending',
      })
      .returning();

    await enqueueTranscriptJob(newVideo.id, youtubeVideoId);
    console.log(`[Webhook] Queued new video: ${videoInfo.title} (${youtubeVideoId})`);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[Webhook]', error);
    // Always return 200 to YouTube even on errors (to prevent re-delivery storms)
    return new Response('OK', { status: 200 });
  }
}
