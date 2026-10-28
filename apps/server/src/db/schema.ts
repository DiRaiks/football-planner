import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { newId } from './ids.js';

/**
 * Ids stay 24-hex strings made like MongoDB ObjectIds: links to /events/<id> in old
 * Telegram messages and the user id in issued sessions keep working after the move.
 * The column is `id`; the code keeps calling it `_id`, as the API does.
 */
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => newId());

// Set from the app's clock (milliseconds): the roster sorts by them in JavaScript too
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

export const users = pgTable(
  'users',
  {
    _id: id(),
    /** Missing for people who only used the bot's buttons in Telegram */
    email: text('email'),
    name: text('name').notNull(),
    /** Missing together with the email */
    hash: text('password_hash'),
    /** Only set for accounts that still use the legacy PBKDF2 hash */
    salt: text('password_salt'),
    role: text('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    /** Bumped to revoke all previously issued tokens (e.g. on password change) */
    tokenVersion: integer('token_version').notNull().default(0),
    telegramId: bigint('telegram_id', { mode: 'number' }),
    telegramUsername: text('telegram_username'),
    /** Profile photo from the last Telegram login (site or Mini App), on Telegram's servers */
    telegramPhotoUrl: text('telegram_photo_url'),
    /** sha256 of a one-time code that links this account to a Telegram user */
    telegramLinkToken: text('telegram_link_token'),
    telegramLinkExpiresAt: timestamp('telegram_link_expires_at', {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    // Case-insensitive, and only for accounts with an email: Telegram ones have none
    uniqueIndex('users_email_unique')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL`),
    uniqueIndex('users_telegram_id_unique')
      .on(table.telegramId)
      .where(sql`${table.telegramId} IS NOT NULL`),
    index('users_telegram_link_token_idx')
      .on(table.telegramLinkToken)
      .where(sql`${table.telegramLinkToken} IS NOT NULL`),
    check('users_role_check', sql`${table.role} IN ('user', 'admin')`),
  ],
);

/** Telegram state of a match: pinned announcements to edit, reminders already sent */
export type EventTelegram = {
  announcements?: { chatId: number; messageId: number }[];
  /** Whether reaching the minimum was announced */
  minimumReached?: boolean;
  /** Reminders already sent: the day before and shortly before the start */
  reminders?: { day?: boolean; soon?: boolean };
  /** When the current start time was announced (ISO); the day-before reminder needs a day */
  scheduledAt?: string;
};

export const events = pgTable(
  'events',
  {
    _id: id(),
    eventName: text('event_name').notNull(),
    place: text('place').notNull(),
    /** Day and wall-clock time at the venue, as entered: YYYY-MM-DD and HH:MM */
    date: text('date').notNull(),
    time: text('time').notNull(),
    /** The moment the match starts: date and time in the venue's time zone (TIME_ZONE) */
    startsAt: timestamp('starts_at', { withTimezone: true }),
    minimum: integer('minimum').notNull(),
    /** Places on the pitch; 0 means no limit */
    maximum: integer('maximum').notNull().default(0),
    /** weekly: the next match is created a week later when this one starts */
    repeat: text('repeat', { enum: ['none', 'weekly'] })
      .notNull()
      .default('none'),
    /** What each person pays for the pitch, whole roubles; 0 means free */
    price: integer('price').notNull().default(0),
    /** Teams split by the organiser, names per team */
    teams: jsonb('teams').$type<string[][]>(),
    /** Set once the next match of a weekly series exists */
    nextCreated: boolean('next_created').notNull().default(false),
    /** The weekly match this one follows; each match has at most one next match */
    repeatOf: text('repeat_of').unique('events_repeat_of_unique'),
    playersAmount: integer('players_amount').notNull().default(0),
    creatorId: text('creator_id').notNull(),
    location: jsonb('location').$type<{ lat: number; lon: number }>(),
    telegram: jsonb('telegram').$type<EventTelegram>(),
    ...timestamps,
  },
  (table) => [
    index('events_starts_at_idx').on(table.startsAt),
    // Weekly matches waiting for their next one, looked up every minute
    index('events_weekly_due_idx')
      .on(table.startsAt)
      .where(sql`${table.repeat} = 'weekly' AND NOT ${table.nextCreated}`),
    check('events_repeat_check', sql`${table.repeat} IN ('none', 'weekly')`),
  ],
);

export type FriendEntity = {
  name: string;
  status: boolean;
  /** When this friend became sure (ISO): their turn for a place */
  sureSince?: string;
};

export const players = pgTable(
  'players',
  {
    _id: id(),
    eventId: text('event_id')
      .notNull()
      .references(() => events._id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users._id),
    name: text('name').notNull(),
    /** The match day, kept for statistics */
    date: text('date').notNull(),
    status: boolean('status').notNull(),
    friends: jsonb('friends').$type<FriendEntity[]>().notNull().default([]),
    /** When the player became sure: their turn for a place, not the sign-up time */
    sureSince: timestamp('sure_since', { withTimezone: true }),
    /** Paid for the pitch; marked by the organiser */
    paid: boolean('paid').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    // One sign-up per user and event
    unique('players_event_user_unique').on(table.eventId, table.userId),
    index('players_user_id_idx').on(table.userId),
  ],
);

export type UserRecord = typeof users.$inferSelect;
export type EventRecord = typeof events.$inferSelect;
export type PlayerRecord = typeof players.$inferSelect;
