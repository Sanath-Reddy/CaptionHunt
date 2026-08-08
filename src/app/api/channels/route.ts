import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveChannelUrl, getChannelInfo } from '@/lib/youtube';
import { z } from 'zod';

// GET /api/channels — list all tracked channels
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const allChannels = await db
      .select()
      .from(channels)
      .orderBy(channels.createdAt);

    return NextResponse.json({ channels: allChannels });
  } catch (error) {
    console.error('[Channels GET]', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}

const addChannelSchema = z.object({
  url: z.string().min(1),
  autoProcess: z.boolean().default(true),
  filterMinDuration: z.number().int().positive().optional(),
  filterMaxDuration: z.number().int().positive().optional(),
  filterContentType: z.enum(['all', 'videos_only', 'streams_only']).default('all'),
});

// POST /api/channels — add a new channel
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = addChannelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { url, autoProcess, filterMinDuration, filterMaxDuration, filterContentType } = parsed.data;

    // Resolve channel URL to ID
    const youtubeChannelId = await resolveChannelUrl(url);

    // Check if already tracked
    const [existing] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.youtubeChannelId, youtubeChannelId))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Channel is already being tracked', channelId: existing.id }, { status: 409 });
    }

    // Fetch channel metadata from YouTube API
    const channelInfo = await getChannelInfo(youtubeChannelId);

    // Insert into DB
    const [newChannel] = await db
      .insert(channels)
      .values({
        youtubeChannelId: channelInfo.id,
        name: channelInfo.name,
        handle: channelInfo.handle,
        thumbnailUrl: channelInfo.thumbnailUrl,
        subscriberCount: channelInfo.subscriberCount,
        description: channelInfo.description,
        autoProcess,
        filterMinDuration,
        filterMaxDuration,
        filterContentType,
        addedByUserId: session.user?.id,
      })
      .returning();

    return NextResponse.json({ channel: newChannel }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Channels POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
