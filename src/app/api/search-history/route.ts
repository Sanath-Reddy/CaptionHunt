import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { searchHistory } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const history = await db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, session.user.id))
      .orderBy(desc(searchHistory.createdAt))
      .limit(50);

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
