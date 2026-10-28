import { describe, expect, it } from 'vitest';
import type { AttendanceRow } from '@football-planner/shared';

import { events, players, users } from '../src/db/index.js';
import { computeRoster } from '../src/modules/players/count.js';
import { playersInOrder } from '../src/modules/players/players.service.js';
import { setupApp } from './helpers.js';

const ctx = setupApp();

/** The attendance as computed in JavaScript before it became one SQL query */
const reference = async (now: Date, days: number) => {
  const since = days === 0 ? 0 : now.getTime() - days * 86_400_000;
  const all = await ctx.app.db.select().from(events);
  const recent = all
    .filter(
      (e) =>
        e.startsAt &&
        e.startsAt.getTime() >= since &&
        e.startsAt.getTime() < now.getTime(),
    )
    .sort((a, b) => b.startsAt!.getTime() - a.startsAt!.getTime());
  const rows = new Map<string, AttendanceRow>();
  for (const event of recent) {
    const list = await playersInOrder(ctx.app.db, event._id);
    for (const person of computeRoster(list, event.maximum).people) {
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
        row.lastPlayed ??= event.date;
      } else if (person.place === 'maybe') row.maybe++;
      rows.set(person.userId, row);
    }
  }
  return [...rows.values()]
    .filter((row) => row.played + row.maybe > 0)
    .sort((a, b) => b.played - a.played || a.name.localeCompare(b.name, 'ru'));
};

/** Deterministic pseudo-random numbers, so a failure can be replayed */
const random = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
};

describe('attendance query', () => {
  it('places people like the roster does: friends take places, sure ones in turn', async () => {
    const rnd = random(42);
    const pick = (n: number) => Math.floor(rnd() * n);
    const base = Date.parse('2026-09-01T17:00:00Z');
    const people = await ctx.app.db
      .insert(users)
      .values(
        Array.from({ length: 12 }, (_, i) => ({
          name: `Игрок ${String.fromCharCode(1040 + i)}`,
          email: `p${i}@example.com`,
        })),
      )
      .returning();

    for (let day = 0; day < 20; day++) {
      const startsAt = new Date(base + day * 86_400_000);
      const [event] = await ctx.app.db
        .insert(events)
        .values({
          eventName: `Матч ${day}`,
          place: 'P',
          date: startsAt.toISOString().slice(0, 10),
          time: '20:00',
          startsAt,
          minimum: 1,
          maximum: [0, 2, 4, 6][pick(4)]!,
          creatorId: people[0]!._id,
          createdAt: new Date(base - 10 * 86_400_000),
        })
        .returning();
      const signedUp = people.filter(() => rnd() < 0.6);
      for (const [position, user] of signedUp.entries()) {
        const createdAt = new Date(base - 5 * 86_400_000 + position * 60_000);
        const sure = rnd() < 0.7;
        // Became sure later than signing up, or (legacy) without a time at all
        const sureSince =
          sure && rnd() < 0.8
            ? new Date(createdAt.getTime() + pick(500) * 1000)
            : null;
        await ctx.app.db.insert(players).values({
          eventId: event!._id,
          userId: user._id,
          name: rnd() < 0.2 ? `${user.name} (новое имя ${day})` : user.name,
          date: event!.date,
          status: sure,
          sureSince,
          createdAt,
          friends: Array.from({ length: pick(3) }, (_, i) => {
            const friendSure = rnd() < 0.7;
            return {
              name: `Друг ${i}`,
              status: friendSure,
              ...(friendSure &&
                rnd() < 0.8 && {
                  sureSince: new Date(
                    createdAt.getTime() + pick(500) * 1000,
                  ).toISOString(),
                }),
            };
          }),
        });
      }
    }

    const now = new Date(base + 25 * 86_400_000);
    // 0 is all time
    for (const days of [7, 14, 90, 0]) {
      const expected = await reference(now, days);
      expect(expected.length).toBeGreaterThan(0);
      expect(await ctx.app.services.stats.attendance(days, now)).toEqual(
        expected,
      );
    }
  });
});
