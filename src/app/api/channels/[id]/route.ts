import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { channels, videos } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/channels/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

    const channelVideos = await db
      .select()
      .from(videos)
      .where(eq(videos.channelId, id))
      .orderBy(videos.publishedAt);

    return NextResponse.json({ channel, videos: channelVideos });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch channel' }, { status: 500 });
  }
}

const updateChannelSchema = z.object({
  autoProcess: z.boolean().optional(),
  filterMinDuration: z.number().int().positive().nullable().optional(),
  filterMaxDuration: z.number().int().positive().nullable().optional(),
  filterContentType: z.enum(['all', 'videos_only', 'streams_only']).optional(),
});

// PATCH /api/channels/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateChannelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const [updated] = await db
      .update(channels)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

    return NextResponse.json({ channel: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
  }
}

// DELETE /api/channels/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const deleteVideos = searchParams.get('deleteVideos') === 'true';

  try {
    if (deleteVideos) {
      await db.delete(videos).where(eq(videos.channelId, id));
    } else {
      // Orphan videos (set channel_id to null)
      await db.update(videos).set({ channelId: null }).where(eq(videos.channelId, id));
    }

    await db.delete(channels).where(eq(channels.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 });
  }
}
