import { createHash } from 'node:crypto';
import type {
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  UpdateMeBody,
} from '@football-planner/shared';

import { AppError, isDuplicateKeyError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { PlayerModel } from '../players/player.model.js';
import type { PlayersService } from '../players/players.service.js';
import { UserModel, findUserByEmail, type UserDocument } from './user.model.js';

export class UsersService {
  // Unknown emails are checked against this hash so they take as long as real accounts
  private readonly dummyHash: Promise<string>;

  constructor() {
    this.dummyHash = hashPassword(crypto.randomUUID());
  }

  async listPublic() {
    // Accounts made from Telegram buttons stay out of the site's list of people
    const users = await UserModel.find(
      { email: { $exists: true } },
      { name: 1 },
    );
    return users.map((user) => ({ _id: user._id.toString(), name: user.name }));
  }

  async login({ email, password }: LoginBody) {
    const user = await findUserByEmail(email).select('+hash +salt');
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
      user.hash = await hashPassword(password);
      user.salt = undefined;
      await user.save();
    }

    return user;
  }

  async register({ email, name, password }: RegisterBody) {
    if (await findUserByEmail(email)) throw userExists();

    const hash = await hashPassword(password);
    try {
      return await UserModel.create({ email, name, hash });
    } catch (error) {
      // Concurrent registration of the same email hits the unique index
      if (isDuplicateKeyError(error)) throw userExists();
      throw error;
    }
  }

  async updateMe(user: UserDocument, { name }: UpdateMeBody) {
    user.name = name;
    return user.save();
  }

  async changePassword(user: UserDocument, input: ChangePasswordBody) {
    const stored = await UserModel.findById(user._id).select('+hash +salt');
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

    stored.hash = await hashPassword(input.newPassword);
    stored.salt = undefined;
    // Revokes all previously issued tokens
    stored.tokenVersion = (stored.tokenVersion ?? 0) + 1;
    return stored.save();
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
  | { status: 'linked'; user: UserDocument }
  | { status: 'expired' }
  | { status: 'taken' };

const hashCode = (code: string) =>
  createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

export class TelegramAccounts {
  constructor(private readonly players: PlayersService) {}

  /** The account of a Telegram user; made on their first button press, without email */
  async findOrCreate(from: TelegramUser) {
    const existing = await UserModel.findOne({ telegramId: from.id });
    if (existing) return existing;
    try {
      return await UserModel.create({
        name: telegramName(from),
        telegramId: from.id,
        ...(from.username && { telegramUsername: from.username }),
      });
    } catch (error) {
      // Two quick presses: the other one created it
      if (isDuplicateKeyError(error)) {
        const created = await UserModel.findOne({ telegramId: from.id });
        if (created) return created;
      }
      throw error;
    }
  }

  /** A one-time code the user sends to the bot as /link CODE; only its hash is stored */
  async createLinkCode(user: UserDocument) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    const code = [...bytes]
      .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join('');
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          telegramLink: {
            token: hashCode(code),
            expiresAt: new Date(Date.now() + CODE_TTL_MS),
          },
        },
      },
    );
    return code;
  }

  /** A code seen where others can read it (a group chat) must not work any more */
  async revokeCode(code: string) {
    await UserModel.updateOne(
      { 'telegramLink.token': hashCode(code) },
      { $unset: { telegramLink: 1 } },
    );
  }

  /**
   * Links the account that made the code to the Telegram user. The identity is claimed
   * first, atomically; then sign-ups of an account made from the bot's buttons move to
   * this account (a match signed up for twice keeps this account's sign-up), and the
   * matches are recounted.
   */
  async link(code: string, from: TelegramUser): Promise<LinkResult> {
    const user = await UserModel.findOneAndUpdate(
      {
        'telegramLink.token': hashCode(code),
        'telegramLink.expiresAt': { $gt: new Date() },
      },
      { $unset: { telegramLink: 1 } },
      { returnDocument: 'after' },
    );
    if (!user) return { status: 'expired' };
    if (user.telegramId === from.id) return { status: 'linked', user };

    // Accounts made from this Telegram user by button presses, even during the merge
    const merged: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const other = await UserModel.findOne({ telegramId: from.id });
      if (other && !other._id.equals(user._id)) {
        // Another account with an email owns this Telegram user: nothing to merge
        if (other.email) return { status: 'taken' };
        await UserModel.updateOne(
          { _id: other._id },
          { $unset: { telegramId: 1, telegramUsername: 1 } },
        );
        merged.push(other._id.toString());
      }
      try {
        await UserModel.updateOne(
          { _id: user._id },
          {
            $set: {
              telegramId: from.id,
              ...(from.username && { telegramUsername: from.username }),
            },
          },
        );
        break;
      } catch (error) {
        // A button press made a new account in between: merge that one too
        if (!isDuplicateKeyError(error) || attempt === 2) throw error;
      }
    }

    for (const otherId of merged) {
      await this.moveSignUps(otherId, user);
      await UserModel.deleteOne({ _id: otherId });
    }
    const linked = await UserModel.findById(user._id);
    return { status: 'linked', user: linked ?? user };
  }

  async unlink(user: UserDocument) {
    if (!user.email) {
      throw new AppError(
        409,
        'TELEGRAM_ONLY',
        'an account without email cannot be unlinked from Telegram',
      );
    }
    user.telegramId = undefined;
    user.telegramUsername = undefined;
    return user.save();
  }

  private async moveSignUps(fromUserId: string, to: UserDocument) {
    const toUserId = to._id.toString();
    const signUps = await PlayerModel.find({ userId: fromUserId });
    for (const player of signUps) {
      await this.players.resync(player.eventId, async () => {
        const duplicate = await PlayerModel.exists({
          eventId: player.eventId,
          userId: toUserId,
        });
        if (duplicate) await player.deleteOne();
        else {
          await PlayerModel.updateOne(
            { _id: player._id },
            { userId: toUserId, name: to.name },
          );
        }
      });
    }
  }
}

const userExists = () =>
  new AppError(409, 'USER_EXISTS', 'user already exists');
