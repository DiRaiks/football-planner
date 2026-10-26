import { sql } from 'drizzle-orm';

import type { Db, Tx } from '../db/index.js';

/** Queues something to do once the transaction has committed, e.g. a Telegram message */
export type AfterCommit = (effect: () => void) => void;

/**
 * Runs a change to one match's roster in a transaction that holds the match's row
 * (`SELECT … FOR UPDATE`), so changes run one after another, also across processes, and
 * "who moved into the squad" is computed against the state right before each change.
 * Effects queued with `after` run once the change is committed, so notifications never
 * read the state before it.
 */
export const withEventLock = async <T>(
  db: Db,
  eventId: string,
  task: (tx: Tx, after: AfterCommit) => Promise<T>,
): Promise<T> => {
  const effects: (() => void)[] = [];
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT 1 FROM events WHERE id = ${eventId} FOR UPDATE`,
    );
    return task(tx, (effect) => effects.push(effect));
  });
  for (const effect of effects) effect();
  return result;
};
