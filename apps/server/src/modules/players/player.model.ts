import type { Player } from '@football-planner/shared';
import { Schema, model, type HydratedDocument } from 'mongoose';

export interface FriendEntity {
  name: string;
  status: boolean;
  /** When this friend became sure: their turn for a place */
  sureSince?: Date;
}

export interface PlayerEntity {
  friends: FriendEntity[];
  name: string;
  date: string;
  status: boolean;
  eventId: string;
  userId: string;
  /** When the player became sure: their turn for a place, not the sign-up time */
  sureSince?: Date;
  /** Paid for the pitch; marked by the organiser */
  paid?: boolean;
}

export type PlayerDocument = HydratedDocument<PlayerEntity>;

export const FriendSchema = new Schema<FriendEntity>({
  name: { type: String, required: true },
  status: { type: Boolean, required: true },
  sureSince: { type: Date },
});

const PlayerSchema = new Schema<PlayerEntity>(
  {
    friends: { type: [FriendSchema], required: true },
    name: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: Boolean, required: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    sureSince: { type: Date },
    paid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One sign-up per user and event
PlayerSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const PlayerModel = model<PlayerEntity>('Player', PlayerSchema);

export const toPlayerDto = (
  player: PlayerDocument,
  waitlisted = false,
): Player => ({
  _id: player._id.toString(),
  name: player.name,
  status: player.status,
  friends: player.friends.map(({ name, status }) => ({ name, status })),
  eventId: player.eventId,
  userId: player.userId,
  date: player.date,
  waitlisted,
  paid: player.paid ?? false,
});
