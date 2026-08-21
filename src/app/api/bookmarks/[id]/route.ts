import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { bookmarks } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// DELETE /api/bookmarks/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const deleted = await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user.id)))
      .returning({ id: bookmarks.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 });
  }
}
