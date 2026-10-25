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
  playersAmount: number;
  eventName: string;
  creatorId: string;
  location?: { lat: number; lon: number };
  /** Telegram state: pinned announcements to edit, and whether the minimum was announced */
  telegram?: {
    announcements: { chatId: number; messageId: number }[];
    minimumReached: boolean;
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
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
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
  playersAmount: event.playersAmount,
  creatorId: event.creatorId,
  ...(event.location && {
    location: { lat: event.location.lat, lon: event.location.lon },
  }),
  ...timestamps(event),
});
