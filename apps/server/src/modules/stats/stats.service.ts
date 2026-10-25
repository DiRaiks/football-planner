import type { AttendanceRow } from '@football-planner/shared';

import { EventModel } from '../events/event.model.js';
import { computeRoster } from '../players/count.js';
import { PlayerModel } from '../players/player.model.js';

/** Matches looked at, at most: a year of five games a week */
const MAX_EVENTS = 260 * 5;

export class StatsService {
  /**
   * Who played how often in the matches of the last `days`: "played" counts a sure
   * sign-up with a place, "maybe" a sign-up that stayed undecided. Friends have no
   * account and are not counted.
   */
  async attendance(days = 90, now = new Date()): Promise<AttendanceRow[]> {
    const since = new Date(now.getTime() - days * 86_400_000);
    const events = await EventModel.find({
      startsAt: { $gte: since, $lt: now },
    })
      .sort({ startsAt: -1 })
      .limit(MAX_EVENTS);
    if (!events.length) return [];

    const players = await PlayerModel.find({
      eventId: { $in: events.map((event) => event._id.toString()) },
    }).sort({ createdAt: 1, _id: 1 });

    const byEvent = Map.groupBy(players, (player) => player.eventId);
    const rows = new Map<string, AttendanceRow>();
    for (const event of events) {
      const ofEvent = byEvent.get(event._id.toString()) ?? [];
      const { people } = computeRoster(ofEvent, event.maximum ?? 0);
      for (const person of people) {
        if (!person.userId) continue;
        const row = rows.get(person.userId) ?? {
          userId: person.userId,
          name: person.name,
          played: 0,
          maybe: 0,
          lastPlayed: null,
        };
        if (person.place === 'squad') {
          row.played++;
          // Events come newest first: the first match seen is the last one played
          row.lastPlayed ??= event.date;
        } else if (person.place === 'maybe') {
          row.maybe++;
        }
        rows.set(person.userId, row);
      }
    }
    return [...rows.values()]
      .filter((row) => row.played + row.maybe > 0)
      .sort(
        (a, b) => b.played - a.played || a.name.localeCompare(b.name, 'ru'),
      );
  }
}
