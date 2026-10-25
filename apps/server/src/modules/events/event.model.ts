import type { Event } from '@football-planner/shared';
import { Schema, model, type HydratedDocument } from 'mongoose';

export interface EventEntity {
  place: string;
  /** Wall-clock time and day at the venue, as entered */
  time: string;
  date: string;
  /** The moment the match starts: date and time in the venue's time zone (TIME_ZONE) */
  startsAt?: Date;
  minimum: number;
  /** Places on the pitch; 0 means no limit */
  maximum: number;
  /** weekly: the next match is created a week later when this one starts */
  repeat: 'none' | 'weekly';
  /** What each person pays for the pitch, whole roubles; 0 means free */
  price: number;
  /** Teams split by the organiser, names per team */
  teams?: string[][];
  /** Set once the next match of a weekly series exists */
  nextCreated?: boolean;
  /** The weekly match this one follows */
  repeatOf?: string;
  playersAmount: number;
  eventName: string;
  creatorId: string;
  location?: { lat: number; lon: number };
  /** Telegram state: pinned announcements to edit, and whether the minimum was announced */
  telegram?: {
    announcements: { chatId: number; messageId: number }[];
    minimumReached: boolean;
    /** Reminders already sent: the day before and shortly before the start */
    reminders?: { day?: boolean; soon?: boolean };
    /** When the current start time was announced; the day-before reminder needs a day */
    scheduledAt?: Date;
  };
}

export type EventDocument = HydratedDocument<EventEntity>;

const EventSchema = new Schema<EventEntity>(
  {
    place: { type: String, required: true },
    time: { type: String, required: true },
    date: { type: String, required: true },
    // Optional until scripts/migrate-dates.mjs fills it for events saved before it existed
    startsAt: { type: Date, required: false, index: true },
    minimum: { type: Number, required: true },
    maximum: { type: Number, default: 0 },
    repeat: { type: String, enum: ['none', 'weekly'], default: 'none' },
    price: { type: Number, default: 0 },
    teams: { type: [[String]], default: undefined },
    nextCreated: { type: Boolean },
    // Unique: each weekly match has at most one next match
    repeatOf: { type: String, unique: true, sparse: true },
    playersAmount: { type: Number, required: true },
    eventName: { type: String, required: true },
    creatorId: { type: String, required: true },
    location: {
      type: new Schema({ lat: Number, lon: Number }, { _id: false }),
      required: false,
    },
    telegram: {
      type: new Schema(
        {
          announcements: [
            new Schema({ chatId: Number, messageId: Number }, { _id: false }),
          ],
          minimumReached: { type: Boolean, default: false },
          reminders: {
            type: new Schema({ day: Boolean, soon: Boolean }, { _id: false }),
            required: false,
          },
          scheduledAt: { type: Date },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
);

// Weekly matches waiting for their next one, looked up every minute
EventSchema.index(
  { startsAt: 1 },
  {
    name: 'weekly_due',
    partialFilterExpression: {
      repeat: 'weekly',
      nextCreated: { $exists: false },
    },
  },
);

export const EventModel = model<EventEntity>('Event', EventSchema);

const timestamps = (doc: { get: (path: string) => unknown }) => {
  const createdAt = doc.get('createdAt');
  const updatedAt = doc.get('updatedAt');
  return {
    ...(createdAt instanceof Date && { createdAt: createdAt.toISOString() }),
    ...(updatedAt instanceof Date && { updatedAt: updatedAt.toISOString() }),
  };
};

export const toEventDto = (event: EventDocument): Event => ({
  _id: event._id.toString(),
  eventName: event.eventName,
  place: event.place,
  date: event.date,
  time: event.time,
  ...(event.startsAt && { startsAt: event.startsAt.toISOString() }),
  minimum: event.minimum,
  maximum: event.maximum ?? 0,
  repeat: event.repeat ?? 'none',
  price: event.price ?? 0,
  ...(event.teams?.length && { teams: event.teams.map((team) => [...team]) }),
  playersAmount: event.playersAmount,
  creatorId: event.creatorId,
  ...(event.location && {
    location: { lat: event.location.lat, lon: event.location.lon },
  }),
  ...timestamps(event),
});
