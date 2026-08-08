import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { channels, videos, transcriptSegments, searchHistory } from '@/db/schema';

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

    return NextResponse.json({ channelCount, videoCount, segmentCount, searchCount });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
