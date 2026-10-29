import type { DeadlineHours, Event } from '@football-planner/shared';
import { eq } from 'drizzle-orm';

import { events, type EventRecord, type Executor } from '../../db/index.js';

export type { EventRecord, EventTelegram } from '../../db/index.js';

export const toEventDto = (event: EventRecord): Event => ({
  _id: event._id,
  eventName: event.eventName,
  place: event.place,
  date: event.date,
  time: event.time,
  ...(event.startsAt && { startsAt: event.startsAt.toISOString() }),
  minimum: event.minimum,
  maximum: event.maximum,
  repeat: event.repeat,
  price: event.price,
  deadlineHours: event.deadlineHours as DeadlineHours,
  autoCancel: event.autoCancel,
  ...(event.teams?.length && { teams: event.teams.map((team) => [...team]) }),
  playersAmount: event.playersAmount,
  creatorId: event.creatorId,
  ...(event.location && {
    location: {
      lat: event.location.lat,
      lon: event.location.lon,
      ...(event.location.name && { name: event.location.name }),
    },
  }),
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
});

export const findEventById = async (q: Executor, id: string) => {
  const [event] = await q.select().from(events).where(eq(events._id, id));
  return event ?? null;
};
