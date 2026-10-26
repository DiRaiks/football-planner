/**
 * Moves the data of the MongoDB era into Postgres: users, matches, sign-ups and the
 * bot's chats, with their original ids. Run by scripts/migrate-from-mongo.mjs; the
 * documents come from a source function, so tests feed it fixtures instead of MongoDB.
 *
 * Idempotent: rows that exist already are left alone (ON CONFLICT DO NOTHING), so a
 * second run adds only what is new. Everything is written in one transaction.
 */
import { pgStore } from '@dirai/tg-kit';
import { getTableColumns, sql, type InferInsertModel } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

import { normalizeDate, normalizeTime } from '../lib/legacy-dates.js';
import { zonedToInstant } from '../lib/time.js';
import type { Database, Executor } from './index.js';
import {
  events,
  players,
  users,
  type EventTelegram,
  type FriendEntity,
} from './schema.js';

export type MongoDoc = Record<string, unknown>;
export type MongoCollection = 'users' | 'events' | 'players' | 'chats';
/** Documents of a collection, e.g. `(name) => db.collection(name).find()` */
export type MongoSource = (
  collection: MongoCollection,
) => AsyncIterable<MongoDoc> | Iterable<MongoDoc>;

/** Topic of the bot's chats saved before topics existed (tg-kit's `legacyTopics`) */
export const LEGACY_CHAT_TOPICS = ['events'];

export type CollectionReport = {
  read: number;
  /** Rows written, or that a dry run would write */
  inserted: number;
  /** Rows that were in Postgres already (a repeated run) */
  existing: number;
  skipped: number;
};

export type MigrationReport = {
  dryRun: boolean;
  timeZone: string;
  collections: Record<MongoCollection, CollectionReport>;
  /** Events whose start time was computed from their date and time */
  startsAtFilled: number;
  /** Everything worth a look: skipped documents, fields that were fixed up */
  problems: string[];
};

type UserRow = InferInsertModel<typeof users>;
type EventRow = InferInsertModel<typeof events>;
type PlayerRow = InferInsertModel<typeof players>;
type ChatRow = {
  chatId: number;
  topics: string[];
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const HEX_ID = /^[a-f0-9]{24}$/;

// --- Field conversion ---

/** The 24-hex id of an ObjectId or of a string, or null */
const idOf = (value: unknown): string | null => {
  const text =
    value && typeof value === 'object' && 'toHexString' in value
      ? (value as { toHexString(): string }).toHexString()
      : typeof value === 'string'
        ? value
        : '';
  const id = text.trim().toLowerCase();
  return HEX_ID.test(id) ? id : null;
};

const dateOf = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** When a document was made: its createdAt, or the time inside its ObjectId */
const createdOf = (doc: MongoDoc, id: string) =>
  dateOf(doc.createdAt) ?? new Date(parseInt(id.slice(0, 8), 16) * 1000);

const textOf = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

/** A number from a double, an Int32/Long or a numeric string; null otherwise */
const numberOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(
    typeof value === 'object' && 'toString' in value ? String(value) : value,
  );
  return Number.isFinite(number) ? number : null;
};

const intOf = (value: unknown, fallback: number) => {
  const number = numberOf(value);
  return number === null ? fallback : Math.max(0, Math.round(number));
};

// --- Documents to rows ---

const toUser = (doc: MongoDoc, problems: string[]): UserRow | null => {
  const id = idOf(doc._id);
  if (!id) {
    problems.push(`users: skipped a document with id ${String(doc._id)}`);
    return null;
  }
  const email = textOf(doc.email).toLowerCase() || null;
  const telegramId = numberOf(doc.telegramId);
  let name = textOf(doc.name).slice(0, 50);
  if (!name) {
    name = email?.split('@')[0] || `Telegram ${telegramId ?? id}`;
    problems.push(`users ${id}: no name, saved as "${name}"`);
  }
  const link = (doc.telegramLink ?? {}) as MongoDoc;
  const createdAt = createdOf(doc, id);
  return {
    _id: id,
    email,
    name,
    hash: textOf(doc.hash) || null,
    salt: textOf(doc.salt) || null,
    role: doc.role === 'admin' ? 'admin' : 'user',
    tokenVersion: intOf(doc.tokenVersion, 0),
    telegramId,
    telegramUsername: textOf(doc.telegramUsername) || null,
    telegramLinkToken: textOf(link.token) || null,
    telegramLinkExpiresAt: dateOf(link.expiresAt),
    createdAt,
    updatedAt: dateOf(doc.updatedAt) ?? createdAt,
  };
};

const toTelegram = (value: unknown): EventTelegram | null => {
  if (!value || typeof value !== 'object') return null;
  const doc = value as MongoDoc;
  const announcements = (
    Array.isArray(doc.announcements) ? doc.announcements : []
  )
    .map((item: MongoDoc) => ({
      chatId: numberOf(item?.chatId),
      messageId: numberOf(item?.messageId),
    }))
    .filter(
      (item): item is { chatId: number; messageId: number } =>
        item.chatId !== null && item.messageId !== null,
    );
  const sent = (doc.reminders ?? {}) as MongoDoc;
  const reminders = {
    ...(sent.day === true && { day: true }),
    ...(sent.soon === true && { soon: true }),
  };
  const scheduledAt = dateOf(doc.scheduledAt);
  return {
    announcements,
    minimumReached: doc.minimumReached === true,
    ...(Object.keys(reminders).length && { reminders }),
    ...(scheduledAt && { scheduledAt: scheduledAt.toISOString() }),
  };
};

const toTeams = (value: unknown) => {
  if (!Array.isArray(value) || !value.length) return null;
  return value.map((team) =>
    Array.isArray(team) ? team.map((name) => String(name)) : [],
  );
};

const toLocation = (value: unknown) => {
  const doc = (value ?? {}) as MongoDoc;
  const lat = numberOf(doc.lat);
  const lon = numberOf(doc.lon);
  return lat !== null && lon !== null ? { lat, lon } : null;
};

/**
 * Date and time in today's forms (YYYY-MM-DD, HH:MM), and the start time: kept when
 * the document has one, computed in `timeZone` otherwise
 */
const toSchedule = (
  doc: MongoDoc,
  id: string,
  timeZone: string,
  problems: string[],
) => {
  const rawDate = textOf(doc.date);
  const rawTime = textOf(doc.time);
  const date = normalizeDate(rawDate);
  const time = normalizeTime(rawTime);
  if (date && time && (date !== rawDate || time !== rawTime)) {
    problems.push(
      `events ${id}: date and time "${rawDate} ${rawTime}" saved as "${date} ${time}"`,
    );
  }
  let startsAt = dateOf(doc.startsAt);
  let filled = false;
  if (!startsAt) {
    startsAt = date && time ? zonedToInstant(date, time, timeZone) : null;
    filled = startsAt !== null;
    if (!startsAt) {
      problems.push(
        `events ${id}: no start time, date "${rawDate}" and time "${rawTime}" are not readable`,
      );
    }
  }
  return {
    date: date ?? rawDate,
    time: time ?? rawTime,
    startsAt,
    filled,
  };
};

const toEvent = (
  doc: MongoDoc,
  timeZone: string,
  problems: string[],
): (EventRow & { filled: boolean }) | null => {
  const id = idOf(doc._id);
  if (!id) {
    problems.push(`events: skipped a document with id ${String(doc._id)}`);
    return null;
  }
  const creatorId = idOf(doc.creatorId) ?? textOf(doc.creatorId);
  if (!creatorId) problems.push(`events ${id}: no creator`);
  const createdAt = createdOf(doc, id);
  return {
    _id: id,
    eventName: textOf(doc.eventName) || 'Матч',
    place: textOf(doc.place),
    ...toSchedule(doc, id, timeZone, problems),
    minimum: intOf(doc.minimum, 0),
    maximum: intOf(doc.maximum, 0),
    repeat: doc.repeat === 'weekly' ? 'weekly' : 'none',
    price: intOf(doc.price, 0),
    teams: toTeams(doc.teams),
    nextCreated: doc.nextCreated === true,
    repeatOf: idOf(doc.repeatOf) ?? (textOf(doc.repeatOf) || null),
    playersAmount: intOf(doc.playersAmount, 0),
    creatorId,
    location: toLocation(doc.location),
    telegram: toTelegram(doc.telegram),
    createdAt,
    updatedAt: dateOf(doc.updatedAt) ?? createdAt,
  };
};

const toFriends = (value: unknown): FriendEntity[] =>
  (Array.isArray(value) ? value : [])
    .filter((friend: MongoDoc) => friend && textOf(friend.name))
    .map((friend: MongoDoc) => {
      const sureSince = dateOf(friend.sureSince);
      return {
        name: textOf(friend.name),
        status: friend.status === true,
        ...(friend.status === true &&
          sureSince && { sureSince: sureSince.toISOString() }),
      };
    });

const toPlayer = (doc: MongoDoc, problems: string[]): PlayerRow | null => {
  const id = idOf(doc._id);
  const eventId = idOf(doc.eventId);
  const userId = idOf(doc.userId);
  if (!id || !eventId || !userId) {
    problems.push(
      `players ${String(doc._id)}: skipped, event "${String(doc.eventId)}" or user "${String(doc.userId)}" is not an id`,
    );
    return null;
  }
  const rawDate = textOf(doc.date);
  const createdAt = createdOf(doc, id);
  const status = doc.status === true;
  return {
    _id: id,
    eventId,
    userId,
    name: textOf(doc.name).slice(0, 50) || 'Игрок',
    date: normalizeDate(rawDate) ?? rawDate,
    status,
    friends: toFriends(doc.friends),
    sureSince: status ? dateOf(doc.sureSince) : null,
    paid: doc.paid === true,
    createdAt,
    updatedAt: dateOf(doc.updatedAt) ?? createdAt,
  };
};

const toChat = (doc: MongoDoc, problems: string[]): ChatRow | null => {
  const chatId = numberOf(doc.chatId);
  if (chatId === null || !Number.isSafeInteger(chatId)) {
    problems.push(`chats: skipped a chat with id ${String(doc.chatId)}`);
    return null;
  }
  const topics = Array.isArray(doc.topics)
    ? doc.topics.map((topic) => String(topic))
    : [...LEGACY_CHAT_TOPICS];
  const settings =
    doc.settings && typeof doc.settings === 'object'
      ? (doc.settings as Record<string, unknown>)
      : {};
  const createdAt = dateOf(doc.createdAt) ?? new Date();
  return {
    chatId,
    topics,
    settings,
    createdAt,
    updatedAt: dateOf(doc.updatedAt) ?? createdAt,
  };
};

export type MigrateOptions = {
  /** Time zone of the venues, for start times computed from date and time */
  timeZone: string;
  /** Only read and report; Postgres is not touched */
  dryRun: boolean;
};

const emptyReport = (): CollectionReport => ({
  read: 0,
  inserted: 0,
  existing: 0,
  skipped: 0,
});

/** Reads a collection and converts it, counting what was read and dropped */
const readAll = async <T>(
  source: MongoSource,
  name: MongoCollection,
  report: CollectionReport,
  convert: (doc: MongoDoc) => T | null,
) => {
  const rows: T[] = [];
  for await (const doc of source(name)) {
    report.read++;
    const row = convert(doc);
    if (row) rows.push(row);
    else report.skipped++;
  }
  return rows;
};

/**
 * Drops rows that would break a unique key of `key` (null keys never clash). The first
 * row, in the source's order, wins; the others are listed as problems.
 */
const dropDuplicates = <T extends object>(
  rows: T[],
  label: string,
  key: (row: T) => string | null,
  report: CollectionReport,
  problems: string[],
  /** Collects the id of each dropped row and the id of the row that won */
  merged?: Map<string, string>,
) => {
  const seen = new Map<string, string>();
  return rows.filter((row) => {
    const value = key(row);
    if (value === null) return true;
    const id = (row as { _id?: string })._id ?? value;
    const first = seen.get(value);
    if (first === undefined) {
      seen.set(value, id);
      return true;
    }
    report.skipped++;
    merged?.set(id, first);
    problems.push(
      `${label} ${id}: skipped, same ${value} as ${first}` +
        (merged ? '; its sign-ups move to that account' : ''),
    );
    return false;
  });
};

const withoutFilled = (row: EventRow & { filled?: boolean }): EventRow => {
  const copy = { ...row };
  delete copy.filled;
  return copy;
};

/**
 * A weekly match has at most one next match (unique repeat_of). Later ones stay, as
 * matches of their own: only their link to the series goes.
 */
const keepFirstNext = <T extends EventRow>(rows: T[], problems: string[]) => {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.repeatOf) continue;
    if (seen.has(row.repeatOf)) {
      problems.push(
        `events ${row._id}: another match follows ${row.repeatOf} already, kept without the link`,
      );
      row.repeatOf = null;
    } else seen.add(row.repeatOf);
  }
  return rows;
};

const CHUNK = 500;

/** Inserts the rows that are not there yet; resolves with how many were new */
const insertNew = async <T extends PgTable>(
  q: Executor,
  table: T,
  rows: InferInsertModel<T>[],
) => {
  let inserted = 0;
  const { _id } = getTableColumns(table) as { _id: never };
  for (let i = 0; i < rows.length; i += CHUNK) {
    const written = (await q
      .insert(table)
      .values(rows.slice(i, i + CHUNK) as never)
      .onConflictDoNothing()
      .returning({ _id })) as unknown[];
    inserted += written.length;
  }
  return inserted;
};

const idsIn = async (q: Executor, table: typeof users | typeof events) => {
  const rows = await q.select({ _id: table._id }).from(table);
  return new Set(rows.map((row) => row._id));
};

/** Sign-ups whose match and user exist; the others are listed */
const keepLinkedPlayers = (
  rows: PlayerRow[],
  eventIds: Set<string>,
  userIds: Set<string>,
  report: CollectionReport,
  problems: string[],
) =>
  rows.filter((row) => {
    const missing = [
      !eventIds.has(row.eventId) && `match ${row.eventId}`,
      !userIds.has(row.userId) && `user ${row.userId}`,
    ].filter(Boolean);
    if (!missing.length) return true;
    report.skipped++;
    problems.push(
      `players ${row._id}: skipped, ${missing.join(' and ')} not found (${row.name})`,
    );
    return false;
  });

export const migrateFromMongo = async (
  source: MongoSource,
  database: Database | null,
  { timeZone, dryRun }: MigrateOptions,
): Promise<MigrationReport> => {
  const problems: string[] = [];
  const collections = {
    users: emptyReport(),
    events: emptyReport(),
    players: emptyReport(),
    chats: emptyReport(),
  };

  // Accounts that clash with an earlier one (an email differing only in case): their
  // sign-ups go to the earlier account instead of being lost
  const mergedUsers = new Map<string, string>();
  const userRows = dropDuplicates(
    dropDuplicates(
      await readAll(source, 'users', collections.users, (doc) =>
        toUser(doc, problems),
      ),
      'users',
      (row) => row.email ?? null,
      collections.users,
      problems,
      mergedUsers,
    ),
    'users',
    (row) => (row.telegramId == null ? null : `telegram id ${row.telegramId}`),
    collections.users,
    problems,
    mergedUsers,
  );
  const eventRows = keepFirstNext(
    await readAll(source, 'events', collections.events, (doc) =>
      toEvent(doc, timeZone, problems),
    ),
    problems,
  );
  const playerRows = dropDuplicates(
    await readAll(source, 'players', collections.players, (doc) => {
      const row = toPlayer(doc, problems);
      const owner = row && mergedUsers.get(row.userId);
      // Chains of merges end at an account that stays
      if (row && owner) {
        let target = owner;
        while (mergedUsers.has(target)) target = mergedUsers.get(target)!;
        row.userId = target;
      }
      return row;
    }),
    'players',
    (row) => `sign-up of user ${row.userId} for match ${row.eventId}`,
    collections.players,
    problems,
  );
  const chatRows = dropDuplicates(
    await readAll(source, 'chats', collections.chats, (doc) =>
      toChat(doc, problems),
    ),
    'chats',
    (row) => `chat ${row.chatId}`,
    collections.chats,
    problems,
  );
  const startsAtFilled = eventRows.filter((row) => row.filled).length;
  const report = { dryRun, timeZone, collections, startsAtFilled, problems };

  if (dryRun || !database) {
    const linked = keepLinkedPlayers(
      playerRows,
      new Set(eventRows.map((row) => row._id!)),
      new Set(userRows.map((row) => row._id!)),
      collections.players,
      problems,
    );
    collections.users.inserted = userRows.length;
    collections.events.inserted = eventRows.length;
    collections.players.inserted = linked.length;
    collections.chats.inserted = chatRows.length;
    return report;
  }

  await database.migrate();
  // The bot's store creates its table on first use
  await pgStore(database.client, { table: 'chats' }).get(0);

  await database.db.transaction(async (tx) => {
    const count = (
      name: MongoCollection,
      rows: unknown[],
      inserted: number,
    ) => {
      collections[name].inserted = inserted;
      collections[name].existing = rows.length - inserted;
    };
    count('users', userRows, await insertNew(tx, users, userRows));
    count(
      'events',
      eventRows,
      await insertNew(tx, events, eventRows.map(withoutFilled)),
    );
    const linked = keepLinkedPlayers(
      playerRows,
      await idsIn(tx, events),
      await idsIn(tx, users),
      collections.players,
      problems,
    );
    count('players', linked, await insertNew(tx, players, linked));
    count('chats', chatRows, await insertChats(tx, chatRows));
  });
  return report;
};

const insertChats = async (q: Executor, rows: ChatRow[]) => {
  let inserted = 0;
  for (const row of rows) {
    const result = (await q.execute(sql`
      INSERT INTO chats (chat_id, topics, settings, created_at, updated_at)
      VALUES (${row.chatId}, ${`{${row.topics.map((t) => JSON.stringify(t)).join(',')}}`}::text[],
        ${JSON.stringify(row.settings)}::jsonb, ${row.createdAt}, ${row.updatedAt})
      ON CONFLICT (chat_id) DO NOTHING
      RETURNING chat_id`)) as unknown as { rows: unknown[] };
    inserted += result.rows.length;
  }
  return inserted;
};

/** The report as lines of text, for the console */
export const formatReport = (report: MigrationReport) => {
  const verb = report.dryRun ? 'would insert' : 'inserted';
  const lines = Object.entries(report.collections).map(
    ([name, c]) =>
      `${name.padEnd(8)} read ${c.read}, ${verb} ${c.inserted}` +
      (report.dryRun ? '' : `, already there ${c.existing}`) +
      `, skipped ${c.skipped}`,
  );
  lines.push(
    `start times computed in ${report.timeZone}: ${report.startsAtFilled}`,
  );
  if (report.problems.length) {
    lines.push(`problems (${report.problems.length}):`);
    lines.push(...report.problems.map((problem) => `  ${problem}`));
  } else {
    lines.push('no problems');
  }
  return lines;
};
