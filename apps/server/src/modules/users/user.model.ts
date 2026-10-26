import { eq, sql } from 'drizzle-orm';

import { users, type Executor, type UserRecord } from '../../db/index.js';

export type { UserRecord } from '../../db/index.js';
export type UserRole = UserRecord['role'];

/** Emails are stored trimmed and in lower case */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Case-insensitive, like the unique index: also matches legacy mixed-case emails */
export const findUserByEmail = async (q: Executor, email: string) => {
  const [user] = await q
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizeEmail(email)}`)
    .limit(1);
  return user ?? null;
};

export const findUserById = async (q: Executor, id: string) => {
  const [user] = await q.select().from(users).where(eq(users._id, id));
  return user ?? null;
};

export const toPublicUser = (user: UserRecord) => ({
  _id: user._id,
  ...(user.email && { email: user.email }),
  name: user.name,
  role: user.role,
  telegramLinked: user.telegramId !== null,
});

export const isAdmin = (user: UserRecord) => user.role === 'admin';
