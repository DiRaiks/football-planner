import { Schema, model } from 'mongoose';

export interface FriendEntity {
  name: string;
  status: boolean;
}

export interface PlayerEntity {
  friends: FriendEntity[];
  name: string;
  date: string;
  status: boolean;
  eventId: string;
  userId: string;
}

export const FriendSchema = new Schema<FriendEntity>({
  name: { type: String, required: true },
  status: { type: Boolean, required: true },
});

const PlayerSchema = new Schema<PlayerEntity>({
  friends: { type: [FriendSchema], required: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  status: { type: Boolean, required: true },
  eventId: { type: String, required: true },
  userId: { type: String, required: true },
}, { timestamps: true });

export const PlayerModel = model<PlayerEntity>('Player', PlayerSchema);
