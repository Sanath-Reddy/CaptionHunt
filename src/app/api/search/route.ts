import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchTranscripts } from '@/lib/search';
import { db } from '@/db';
import { searchHistory } from '@/db/schema';

// GET /api/search?q=...&channels=...&minDuration=...&maxDuration=...&contentType=...&page=...
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
  const offset = (page - 1) * limit;

  if (!query) {
    return NextResponse.json({ results: [], total: 0, query: '' });
  }

  // Parse filters
  const channelIds = searchParams.get('channels')?.split(',').filter(Boolean);
  const minDuration = searchParams.get('minDuration') ? parseInt(searchParams.get('minDuration')!, 10) : undefined;
  const maxDuration = searchParams.get('maxDuration') ? parseInt(searchParams.get('maxDuration')!, 10) : undefined;
  const contentType = searchParams.get('contentType') as 'all' | 'videos_only' | 'streams_only' | null;
  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
  const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;

  try {
    const { results, total } = await searchTranscripts(
      query,
      {
        channelIds,
        minDuration,
        maxDuration,
        contentType: contentType ?? 'all',
        dateFrom,
        dateTo,
      },
      limit,
      offset
    );

    // Save to search history (non-blocking)
    if (page === 1 && session.user?.id) {
      db.insert(searchHistory)
        .values({
          userId: session.user.id,
          query,
          resultCount: total,
        })
        .catch(() => {}); // fire and forget
    }

    return NextResponse.json({
      results,
      total,
      query,
      pagination: { page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Search failed';
    console.error('[Search]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
