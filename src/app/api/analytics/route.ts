import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { channels, videos, transcriptSegments, searchHistory } from '@/db/schema';
import { sql, desc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [channelCount, videoCount, segmentCount, searchCount] = await Promise.all([
      db.$count(channels),
      db.$count(videos),
      db.$count(transcriptSegments),
      db.$count(searchHistory),
    ]);

    // Video status breakdown
    const statusBreakdown = await db
      .select({
        status: videos.transcriptStatus,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(videos)
      .groupBy(videos.transcriptStatus);

    // Top search queries (last 30 days, grouped by query, sorted by count)
    const topSearches = await db
      .select({
        query: searchHistory.query,
        count: sql<number>`cast(count(*) as int)`,
        lastSearched: sql<string>`max(${searchHistory.createdAt})`,
      })
      .from(searchHistory)
      .where(sql`${searchHistory.createdAt} >= now() - interval '30 days'`)
      .groupBy(searchHistory.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Total indexed duration (seconds)
    const [durationResult] = await db
      .select({ totalSeconds: sql<number>`cast(coalesce(sum(duration_seconds), 0) as int)` })
      .from(videos)
      .where(eq(videos.transcriptStatus, 'completed'));

    return NextResponse.json({
      channelCount,
      videoCount,
      segmentCount,
      searchCount,
      statusBreakdown,
      topSearches,
      totalIndexedSeconds: durationResult?.totalSeconds ?? 0,
    });
  } catch (error) {
    console.error('[Analytics]', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
