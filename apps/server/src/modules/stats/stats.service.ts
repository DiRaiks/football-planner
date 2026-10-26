import { sql } from 'drizzle-orm';
import type { AttendanceRow } from '@football-planner/shared';

import type { Db } from '../../db/index.js';

/** Matches looked at, at most: a year of five games a week */
const MAX_EVENTS = 260 * 5;

type Row = {
  user_id: string;
  name: string;
  played: number | string;
  maybe: number | string;
  last_played: string | null;
};

export class StatsService {
  constructor(private readonly db: Db) {}

  /**
   * Who played how often in the matches of the last `days`: "played" counts a sure
   * sign-up with a place, "maybe" a sign-up that stayed undecided. Friends have no
   * account and are not counted, but take places like in the roster (players/count.ts):
   * sure people get them in the order they became sure.
   */
  async attendance(days = 90, now = new Date()): Promise<AttendanceRow[]> {
    const since = new Date(now.getTime() - days * 86_400_000);
    const result = (await this.db.execute(sql`
      WITH recent AS (
        SELECT id, date, maximum, starts_at
        FROM events
        WHERE starts_at >= ${since} AND starts_at < ${now}
        ORDER BY starts_at DESC
        LIMIT ${MAX_EVENTS}
      ),
      signups AS (
        SELECT p.*, r.maximum, r.date AS event_date, r.starts_at,
          row_number() OVER (
            PARTITION BY p.event_id ORDER BY p.created_at, p.id
          ) AS position
        FROM players p
        JOIN recent r ON r.id = p.event_id
      ),
      -- Players and the friends they bring, in sign-up order within each match
      people AS (
        SELECT event_id, maximum, event_date, starts_at, user_id, name, status AS sure,
          coalesce(sure_since, created_at) AS since, position, 0::bigint AS friend
        FROM signups
        UNION ALL
        SELECT s.event_id, s.maximum, s.event_date, s.starts_at, NULL, NULL,
          coalesce((f.value ->> 'status')::boolean, false),
          coalesce((f.value ->> 'sureSince')::timestamptz, s.created_at),
          s.position, f.ordinality
        FROM signups s
        CROSS JOIN LATERAL jsonb_array_elements(s.friends) WITH ORDINALITY AS f
      ),
      placed AS (
        SELECT *,
          CASE
            WHEN NOT sure THEN 'maybe'
            WHEN maximum = 0 OR row_number() OVER (
              PARTITION BY event_id, sure ORDER BY since, position, friend
            ) <= maximum THEN 'squad'
            ELSE 'waiting'
          END AS place
        FROM people
      )
      SELECT
        user_id,
        -- The name in the newest match the person signed up for
        (array_agg(name ORDER BY starts_at DESC))[1] AS name,
        count(*) FILTER (WHERE place = 'squad') AS played,
        count(*) FILTER (WHERE place = 'maybe') AS maybe,
        (array_agg(event_date ORDER BY starts_at DESC)
          FILTER (WHERE place = 'squad'))[1] AS last_played
      FROM placed
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    `)) as unknown as { rows: Row[] };

    return result.rows
      .map((row) => ({
        userId: row.user_id,
        name: row.name,
        played: Number(row.played),
        maybe: Number(row.maybe),
        lastPlayed: row.last_played,
      }))
      .filter((row) => row.played + row.maybe > 0)
      .sort(
        (a, b) =>
          b.played - a.played ||
          a.name.localeCompare(b.name, 'ru') ||
          a.userId.localeCompare(b.userId),
      );
  }
}
