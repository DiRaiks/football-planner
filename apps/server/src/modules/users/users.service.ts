import { createHash } from 'node:crypto';
import { and, asc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type {
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  UpdateMeBody,
} from '@football-planner/shared';

import { players, users, type Db, type UserRecord } from '../../db/index.js';
import { AppError, isDuplicateKeyError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import type { PlayersService } from '../players/players.service.js';
import { findUserByEmail, findUserById, normalizeEmail } from './user.model.js';

export class UsersService {
  // Unknown emails are checked against this hash so they take as long as real accounts
  private readonly dummyHash: Promise<string>;

  constructor(private readonly db: Db) {
    this.dummyHash = hashPassword(crypto.randomUUID());
  }

  async listPublic() {
    // Accounts made from Telegram buttons stay out of the site's list of people
    return this.db
      .select({ _id: users._id, name: users.name })
      .from(users)
      .where(isNotNull(users.email))
      .orderBy(asc(users.createdAt), asc(users._id));
  }

  async login({ email, password }: LoginBody) {
    const user = await findUserByEmail(this.db, email);
    const result = await verifyPassword(
      password,
      user?.hash
        ? { hash: user.hash, salt: user.salt }
        : { hash: await this.dummyHash },
    );

    if (!user?.hash || !result.ok) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'invalid credentials');
    }

    if (result.needsRehash) {
      const [upgraded] = await this.db
        .update(users)
        .set({ hash: await hashPassword(password), salt: null })
        .where(eq(users._id, user._id))
        .returning();
      return upgraded ?? user;
    }

    return user;
  }

  async register({ email, name, password }: RegisterBody) {
    if (await findUserByEmail(this.db, email)) throw userExists();

    const hash = await hashPassword(password);
    try {
      const [user] = (await this.db
        .insert(users)
        .values({ email: normalizeEmail(email), name: name.trim(), hash })
        .returning()) as [UserRecord];
      return user;
    } catch (error) {
      // Concurrent registration of the same email hits the unique index
      if (isDuplicateKeyError(error)) throw userExists();
      throw error;
    }
  }

  async updateMe(user: UserRecord, { name }: UpdateMeBody) {
    const [updated] = await this.db
      .update(users)
      .set({ name: name.trim() })
      .where(eq(users._id, user._id))
      .returning();
    return updated ?? { ...user, name: name.trim() };
  }

  async changePassword(user: UserRecord, input: ChangePasswordBody) {
    const stored = await findUserById(this.db, user._id);
    if (
      !stored?.hash ||
      !(
        await verifyPassword(input.currentPassword, {
          hash: stored.hash,
          salt: stored.salt,
        })
      ).ok
    ) {
      throw new AppError(
        400,
        'INVALID_PASSWORD',
        'current password is incorrect',
      );
    }

    const [updated] = (await this.db
      .update(users)
      .set({
        hash: await hashPassword(input.newPassword),
        salt: null,
        // Revokes all previously issued tokens
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users._id, stored._id))
      .returning()) as [UserRecord];
    return updated;
  }
}

/** Who pressed a button in Telegram */
export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

/** Link codes: short, unambiguous, typed by hand */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60_000;

const telegramName = (from: TelegramUser) =>
  [from.first_name, from.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
    .slice(0, 50) ||
  from.username ||
  `Telegram ${from.id}`;

export type LinkResult =
  | { status: 'linked'; user: UserRecord }
  | { status: 'expired' }
  | { status: 'taken' };

const hashCode = (code: string) =>
  createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

export class TelegramAccounts {
  constructor(
    private readonly db: Db,
    private readonly players: PlayersService,
  ) {}

  private async findByTelegramId(telegramId: number) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.telegramId, telegramId));
    return user ?? null;
  }

  /** The account of a Telegram user; made on their first button press, without email */
  async findOrCreate(from: TelegramUser) {
    const existing = await this.findByTelegramId(from.id);
    if (existing) return existing;
    try {
      const [created] = (await this.db
        .insert(users)
        .values({
          name: telegramName(from).trim(),
          telegramId: from.id,
          telegramUsername: from.username ?? null,
        })
        .returning()) as [UserRecord];
      return created;
    } catch (error) {
      // Two quick presses: the other one created it
      if (isDuplicateKeyError(error)) {
        const created = await this.findByTelegramId(from.id);
        if (created) return created;
      }
      throw error;
    }
  }

  /** A one-time code the user sends to the bot as /link CODE; only its hash is stored */
  async createLinkCode(user: UserRecord) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    const code = [...bytes]
      .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join('');
    await this.db
      .update(users)
      .set({
        telegramLinkToken: hashCode(code),
        telegramLinkExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      })
      .where(eq(users._id, user._id));
    return code;
  }

  /** A code seen where others can read it (a group chat) must not work any more */
  async revokeCode(code: string) {
    await this.db
      .update(users)
      .set({ telegramLinkToken: null, telegramLinkExpiresAt: null })
      .where(eq(users.telegramLinkToken, hashCode(code)));
  }

  /**
   * Links the account that made the code to the Telegram user. The identity is claimed
   * first, atomically; then sign-ups of an account made from the bot's buttons move to
   * this account (a match signed up for twice keeps this account's sign-up), and the
   * matches are recounted.
   */
  async link(code: string, from: TelegramUser): Promise<LinkResult> {
    const [user] = await this.db
      .update(users)
      .set({ telegramLinkToken: null, telegramLinkExpiresAt: null })
      .where(
        and(
          eq(users.telegramLinkToken, hashCode(code)),
          gt(users.telegramLinkExpiresAt, new Date()),
        ),
      )
      .returning();
    if (!user) return { status: 'expired' };
    if (user.telegramId === from.id) return { status: 'linked', user };

    // Accounts made from this Telegram user by button presses, even during the merge
    const merged: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const other = await this.findByTelegramId(from.id);
      if (other && other._id !== user._id) {
        // Another account with an email owns this Telegram user: nothing to merge
        if (other.email) return { status: 'taken' };
        await this.db
          .update(users)
          .set({ telegramId: null, telegramUsername: null })
          .where(eq(users._id, other._id));
        merged.push(other._id);
      }
      try {
        await this.db
          .update(users)
          .set({
            telegramId: from.id,
            ...(from.username && { telegramUsername: from.username }),
          })
          .where(eq(users._id, user._id));
        break;
      } catch (error) {
        // A button press made a new account in between: merge that one too
        if (!isDuplicateKeyError(error) || attempt === 2) throw error;
      }
    }

    for (const otherId of merged) {
      await this.moveSignUps(otherId, user);
      await this.db.delete(users).where(eq(users._id, otherId));
    }
    const linked = await findUserById(this.db, user._id);
    return { status: 'linked', user: linked ?? user };
  }

  async unlink(user: UserRecord) {
    if (!user.email) {
      throw new AppError(
        409,
        'TELEGRAM_ONLY',
        'an account without email cannot be unlinked from Telegram',
      );
    }
    const [updated] = await this.db
      .update(users)
      .set({ telegramId: null, telegramUsername: null })
      .where(eq(users._id, user._id))
      .returning();
    return updated ?? { ...user, telegramId: null, telegramUsername: null };
  }

  private async moveSignUps(fromUserId: string, to: UserRecord) {
    const signUps = await this.db
      .select()
      .from(players)
      .where(eq(players.userId, fromUserId));
    for (const player of signUps) {
      await this.players.resync(player.eventId, async (tx) => {
        const [duplicate] = await tx
          .select({ _id: players._id })
          .from(players)
          .where(
            and(
              eq(players.eventId, player.eventId),
              eq(players.userId, to._id),
            ),
          );
        if (duplicate) {
          await tx.delete(players).where(eq(players._id, player._id));
        } else {
          await tx
            .update(players)
            .set({ userId: to._id, name: to.name })
            .where(eq(players._id, player._id));
        }
      });
    }
  }
}

const userExists = () =>
  new AppError(409, 'USER_EXISTS', 'user already exists');
