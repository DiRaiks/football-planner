import { Schema, model, type HydratedDocument } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface User {
  email: string;
  name: string;
  hash: string;
  // Only set for accounts that still use the legacy PBKDF2 hash
  salt?: string | null;
  role: UserRole;
  // Bumped to revoke all previously issued tokens (e.g. on password change)
  tokenVersion: number;
}

export type UserDocument = HydratedDocument<User>;

const UserSchema = new Schema<User>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    // Never returned from queries unless explicitly requested with `.select('+hash +salt')`
    hash: { type: String, required: true, select: false },
    salt: { type: String, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

UserSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export const UserModel = model<User>('User', UserSchema);

// Case-insensitive lookup that also matches legacy accounts stored with mixed-case emails
export const findUserByEmail = (email: string) =>
  UserModel.findOne({ email: email.trim() }).collation({
    locale: 'en',
    strength: 2,
  });

export const toPublicUser = (user: UserDocument) => ({
  _id: user._id.toString(),
  email: user.email,
  name: user.name,
  role: user.role,
});
