import { Schema, model, type HydratedDocument } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface User {
  /** Missing for people who only used the bot's buttons in Telegram */
  email?: string;
  name: string;
  /** Missing together with the email */
  hash?: string;
  // Only set for accounts that still use the legacy PBKDF2 hash
  salt?: string | null;
  role: UserRole;
  // Bumped to revoke all previously issued tokens (e.g. on password change)
  tokenVersion: number;
  telegramId?: number;
  telegramUsername?: string;
  /** One-time token of a t.me link that links this account to a Telegram user */
  telegramLink?: { token: string; expiresAt: Date };
}

export type UserDocument = HydratedDocument<User>;

const UserSchema = new Schema<User>(
  {
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    // Never returned from queries unless explicitly requested with `.select('+hash +salt')`
    hash: { type: String, select: false },
    salt: { type: String, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    tokenVersion: { type: Number, default: 0 },
    telegramId: { type: Number },
    telegramUsername: { type: String },
    telegramLink: {
      type: new Schema({ token: String, expiresAt: Date }, { _id: false }),
      select: false,
    },
  },
  { timestamps: true },
);

// Partial: accounts made from Telegram have no email, and must not collide on null
UserSchema.index(
  { email: 1 },
  {
    name: 'email_unique',
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { email: { $type: 'string' } },
  },
);
UserSchema.index(
  { telegramId: 1 },
  {
    name: 'telegram_unique',
    unique: true,
    partialFilterExpression: { telegramId: { $type: 'number' } },
  },
);
UserSchema.index(
  { 'telegramLink.token': 1 },
  {
    name: 'telegram_link',
    partialFilterExpression: { 'telegramLink.token': { $type: 'string' } },
  },
);

/**
 * The unique email index of older versions counts a missing email as null, so a second
 * account without email would fail. Drops it; the partial index above replaces it.
 */
export const dropLegacyUserIndexes = async () => {
  const codeOf = (error: unknown) => (error as { code?: number }).code;
  // A new database has no users collection yet (NamespaceNotFound)
  const indexes = await UserModel.collection
    .indexes()
    .catch((error: unknown) => {
      if (codeOf(error) === 26) return [];
      throw error;
    });
  if (indexes.some((index) => index.name === 'email_1')) {
    // Another instance may have dropped it a moment ago (IndexNotFound)
    await UserModel.collection.dropIndex('email_1').catch((error: unknown) => {
      if (codeOf(error) !== 27) throw error;
    });
  }
};

export const UserModel = model<User>('User', UserSchema);

// Case-insensitive lookup that also matches legacy accounts stored with mixed-case emails
export const findUserByEmail = (email: string) =>
  UserModel.findOne({ email: email.trim() }).collation({
    locale: 'en',
    strength: 2,
  });

export const toPublicUser = (user: UserDocument) => ({
  _id: user._id.toString(),
  ...(user.email && { email: user.email }),
  name: user.name,
  role: user.role,
  telegramLinked: user.telegramId !== undefined && user.telegramId !== null,
});

export const isAdmin = (user: UserDocument) => user.role === 'admin';
