import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { bookmarks, transcriptSegments, videos } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/bookmarks
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const userBookmarks = await db
      .select({
        bookmark: bookmarks,
        segmentText: transcriptSegments.text,
        videoTitle: videos.title,
        videoThumbnail: videos.thumbnailUrl,
        youtubeVideoId: videos.youtubeVideoId,
      })
      .from(bookmarks)
      .leftJoin(transcriptSegments, eq(bookmarks.segmentId, transcriptSegments.id))
      .leftJoin(videos, eq(bookmarks.videoId, videos.id))
      .where(eq(bookmarks.userId, session.user.id))
      .orderBy(desc(bookmarks.createdAt));

    return NextResponse.json({ bookmarks: userBookmarks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}

const createBookmarkSchema = z.object({
  videoId: z.string().uuid(),
  segmentId: z.string().uuid().optional(),
  startTime: z.number(),
  note: z.string().max(500).optional(),
});

// POST /api/bookmarks
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createBookmarkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const [bookmark] = await db
      .insert(bookmarks)
      .values({ userId: session.user.id, ...parsed.data })
      .returning();

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 });
  }
}
