import type {
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  UpdateMeBody,
} from '@football-planner/shared';

import { AppError, isDuplicateKeyError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { UserModel, findUserByEmail, type UserDocument } from './user.model.js';

export class UsersService {
  // Unknown emails are checked against this hash so they take as long as real accounts
  private readonly dummyHash: Promise<string>;

  constructor() {
    this.dummyHash = hashPassword(crypto.randomUUID());
  }

  async listPublic() {
    const users = await UserModel.find({}, { name: 1 });
    return users.map((user) => ({ _id: user._id.toString(), name: user.name }));
  }

  async login({ email, password }: LoginBody) {
    const user = await findUserByEmail(email).select('+hash +salt');
    const result = await verifyPassword(
      password,
      user ?? { hash: await this.dummyHash },
    );

    if (!user || !result.ok) {
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
    if (!stored || !(await verifyPassword(input.currentPassword, stored)).ok) {
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

const userExists = () =>
  new AppError(409, 'USER_EXISTS', 'user already exists');
