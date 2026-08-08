import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if email already exists
    const { eq } = await import('drizzle-orm');
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Check if this is the first user (make them admin)
    const userCount = await db.$count(users);
    const role = userCount === 0 ? 'admin' : 'user';

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({ name, email, passwordHash, role })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error('[Register]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
