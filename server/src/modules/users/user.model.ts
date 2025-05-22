import { Schema, model, type Document } from "mongoose";

export class CreateUserDTO {
  readonly email!: string;
  readonly name!: string;
  readonly hash!: string;
  readonly salt!: string;
}

export interface User extends Document {
  readonly _id: string;
  readonly email: string;
  readonly name: string;
  readonly hash: string;
  readonly salt: string;
}

const UserSchema = new Schema<User>(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
  },
  { timestamps: true },
);

export const UserModel = model<User>("User", UserSchema);
