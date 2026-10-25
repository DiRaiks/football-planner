import type { mongo } from 'mongoose';

import { normalizeDate, normalizeTime } from './legacy-dates.js';
import { zonedToInstant } from './time.js';

export type MigrationResult = {
  /** Events that got (or would get) a start time: id, new date and time, the instant */
  changed: {
    id: string;
    date: string;
    time: string;
    startsAt: Date;
    was?: string;
  }[];
  /** Events whose date or time could not be read */
  failed: { id: string; date: unknown; time: unknown }[];
  /** Players whose match day was corrected */
  players: number;
};

/**
 * Fills `startsAt` on events saved before it existed and normalises their date and time.
 * With `all`, recomputes every event (after a TIME_ZONE change). `dryRun` writes nothing.
 */
export const migrateDates = async (
  db: mongo.Db,
  {
    timeZone,
    dryRun,
    all = false,
  }: { timeZone: string; dryRun: boolean; all?: boolean },
): Promise<MigrationResult> => {
  const events = db.collection('events');
  const players = db.collection('players');
  const result: MigrationResult = { changed: [], failed: [], players: 0 };

  for await (const event of events.find(
    all ? {} : { startsAt: { $exists: false } },
  )) {
    const id = event._id.toString();
    const date = normalizeDate(String(event.date ?? ''));
    const time = normalizeTime(String(event.time ?? ''));
    const startsAt = date && time ? zonedToInstant(date, time, timeZone) : null;
    if (!date || !time || !startsAt) {
      result.failed.push({ id, date: event.date, time: event.time });
      continue;
    }

    const normalised = date === event.date && time === event.time;
    result.changed.push({
      id,
      date,
      time,
      startsAt,
      ...(!normalised && {
        was: `${String(event.date)} ${String(event.time)}`,
      }),
    });
    if (dryRun) continue;

    await events.updateOne(
      { _id: event._id },
      { $set: { date, time, startsAt } },
    );
    // Players keep the match day for statistics: follow a normalised date
    if (date !== event.date) {
      const updated = await players.updateMany(
        { eventId: id },
        { $set: { date } },
      );
      result.players += updated.modifiedCount;
    }
  }
  return result;
};
