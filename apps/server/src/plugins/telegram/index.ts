import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { splitList } from '@dirai-kit/fastify';
import { and, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import {
  html,
  pgStore,
  tgBot,
  tgHealth,
  tgNotifier,
  tgSubscriptions,
  type SentMessage,
  type TgBotOptions,
} from '@dirai-kit/tg';

import { zonedDay } from '../../lib/time.js';
import { events, users, type EventRecord } from '../../db/index.js';
import { findEventById } from '../../modules/events/event.model.js';
import {
  computeRoster,
  type RosterPerson,
} from '../../modules/players/count.js';
import { playersInOrder } from '../../modules/players/players.service.js';
import { registerTelegramActions } from './actions.js';
import {
  announcementMessage,
  cancelledAnnouncementMessage,
  cancelledMessage,
  eventChangedMessage,
  formatWhen,
  minimumReachedMessage,
  playersChangeMessage,
  squadChangedMessage,
  teamsMessage,
  reminderMessage,
  matchLink,
  rsvpKeyboard,
  type NotifyEvent,
  type NotifyPlayer,
  type PlayersChangeKind,
  type ReminderKind,
} from './messages.js';

/** Event data needed after the event is deleted */
export type CancelledEvent = Pick<
  EventRecord,
  '_id' | 'eventName' | 'date' | 'time' | 'place' | 'minimum' | 'telegram'
> & { maximum?: number };

export type TelegramNotifier = {
  eventCreated: (eventId: string) => void;
  /** `scheduleChanged`: date, time or place changed, which is worth a loud message */
  eventUpdated: (eventId: string, scheduleChanged: boolean) => void;
  eventCancelled: (event: CancelledEvent) => void;
  playersChanged: (
    kind: PlayersChangeKind,
    player: NotifyPlayer & { _id?: string },
    eventId: string,
  ) => void;
  /** People who got a place, or lost one (fewer places), after a change */
  squadChanged: (
    eventId: string,
    moves: { promoted: RosterPerson[]; demoted: RosterPerson[] },
  ) => void;
  /** The organiser split the squad into teams */
  teamsSplit: (eventId: string) => void;
  /** Sends the reminders due at `now`; resolves with how many went out */
  sendDueReminders: (now?: Date) => Promise<number>;
  /** The bot's username, for t.me links; null while the bot is off or not started */
  botUsername: () => string | null;
};

/** Overrides for tests: a fake Telegram API and no network calls on startup */
export type TelegramTestOptions = Pick<
  TgBotOptions,
  'configureApi' | 'botInfo'
>;

export type TelegramPluginOptions = { test?: TelegramTestOptions };

declare module 'fastify' {
  interface FastifyInstance {
    telegramBot: TelegramNotifier;
  }
}

// Every chat gets match announcements and sign-up changes
const TOPIC = 'events';

const HOUR = 3_600_000;
/** How long before the start each reminder goes out */
const REMINDER_LEAD: Record<ReminderKind, number> = {
  day: 24 * HOUR,
  soon: 2 * HOUR,
};

const noop = () => undefined;
const disabledNotifier: TelegramNotifier = {
  eventCreated: noop,
  eventUpdated: noop,
  eventCancelled: noop,
  playersChanged: noop,
  squadChanged: noop,
  teamsSplit: noop,
  sendDueReminders: async () => 0,
  botUsername: () => null,
};

const toNotifyEvent = (event: EventRecord | CancelledEvent): NotifyEvent => ({
  _id: event._id,
  eventName: event.eventName,
  date: event.date,
  time: event.time,
  place: event.place,
  minimum: event.minimum,
  maximum: event.maximum ?? 0,
});

const telegramPlugin: FastifyPluginAsync<TelegramPluginOptions> = async (
  fastify,
  { test },
) => {
  const {
    BOT_TOKEN,
    BOT_MODE,
    BOT_WEBHOOK_URL,
    BOT_WEBHOOK_SECRET,
    TELEGRAM_ADMIN_IDS,
    PUBLIC_URL,
    TELEGRAM_APP_URL,
    TIME_ZONE,
  } = fastify.config;

  if (!BOT_TOKEN) {
    fastify.log.warn(
      'BOT_TOKEN is not set, Telegram notifications are disabled',
    );
    fastify.decorate('telegramBot', disabledNotifier);
    return;
  }

  await fastify.register(tgBot, {
    token: BOT_TOKEN,
    mode: test ? 'none' : BOT_MODE,
    webhook:
      BOT_MODE === 'webhook' && BOT_WEBHOOK_URL && BOT_WEBHOOK_SECRET
        ? { url: BOT_WEBHOOK_URL, secretToken: BOT_WEBHOOK_SECRET }
        : undefined,
    admins: splitList(TELEGRAM_ADMIN_IDS).map(Number),
    botInfo: test?.botInfo,
    configureApi: test?.configureApi,
    texts: {
      start:
        'Привет! Я закрепляю анонсы матчей с кнопками записи и напоминаю о них. /help',
    },
  });
  await fastify.register(tgSubscriptions, {
    // Chats moved from MongoDB without topics got this one (scripts/migrate-from-mongo.mjs)
    store: pgStore(fastify.sqlClient, { table: 'chats' }),
    topics: [TOPIC],
  });
  await fastify.register(tgNotifier);
  // Bot metrics (tg_*) go to the app's /metrics, the bot's state to its /health
  await fastify.register(tgHealth, {
    registry: fastify.ops.registry,
    healthPath: false,
    metricsPath: false,
    // Well inside the 5 s of the Docker health check (Dockerfile)
    timeoutMs: 2000,
  });

  const { notifier, log, db } = fastify;
  const publicUrl = PUBLIC_URL?.replace(/\/+$/, '');
  const appUrl = TELEGRAM_APP_URL?.replace(/\/+$/, '');
  const keyboard = (event: NotifyEvent) =>
    rsvpKeyboard(event, matchLink(event._id, { publicUrl, appUrl }));

  // Updates of one event run in order, so a slow edit never overwrites a newer one.
  // `isLatest` tells a task whether newer updates of the same event are already waiting.
  const queues = new Map<string, Promise<void>>();
  const waiting = new Map<string, number>();
  const serial = (
    eventId: string,
    task: (isLatest: boolean) => Promise<void>,
  ) => {
    waiting.set(eventId, (waiting.get(eventId) ?? 0) + 1);
    const next = (queues.get(eventId) ?? Promise.resolve())
      .then(() => {
        const left = (waiting.get(eventId) ?? 1) - 1;
        if (left > 0) waiting.set(eventId, left);
        else waiting.delete(eventId);
        return task(left === 0);
      })
      .catch((err: unknown) =>
        log.error({ err, eventId }, 'telegram notification failed'),
      );
    queues.set(eventId, next);
    void next.then(() => {
      if (queues.get(eventId) === next) queues.delete(eventId);
    });
    return next;
  };

  const load = async (eventId: string) => {
    const event = await findEventById(db, eventId);
    if (!event) return null;
    const players = await playersInOrder(db, eventId);
    return { event, players, ...computeRoster(players, event.maximum) };
  };
  type State = NonNullable<Awaited<ReturnType<typeof load>>>;

  /** The weather at the start of the match; null when unknown or the provider fails */
  const forecastFor = async (state: State) => {
    const { weather } = fastify.services;
    const location = weather.resolveLocation(state.event.location);
    if (!location) return null;
    return weather
      .getForecastAt(location, state.event.startsAt)
      .catch((err: unknown) => {
        log.warn({ err }, 'weather for a Telegram message failed');
        return null;
      });
  };

  /** Rewrites the pinned announcements with the current players */
  const refreshAnnouncements = async (state: State) => {
    const event = toNotifyEvent(state.event);
    const message = announcementMessage(
      event,
      state.people,
      state.count,
      await forecastFor(state),
    );
    const replyMarkup = keyboard(event);
    const announcements: SentMessage[] =
      state.event.telegram?.announcements ?? [];

    await Promise.all(
      announcements.map((target) =>
        notifier.edit(target, message, { replyMarkup }),
      ),
    );
  };

  /** Merges fields into the match's Telegram state; resolves with whether it exists */
  const mergeTelegram = async (
    eventId: string,
    fields: Record<string, unknown>,
    without: string[] = [],
  ) => {
    const saved = await db
      .update(events)
      .set({
        telegram: sql`(coalesce(${events.telegram}, '{}'::jsonb) - ${`{${without.join(',')}}`}::text[]) || ${JSON.stringify(fields)}::jsonb`,
      })
      .where(eq(events._id, eventId))
      .returning({ _id: events._id });
    return saved.length > 0;
  };

  const setMinimumReached = (eventId: string, value: boolean) =>
    mergeTelegram(eventId, { minimumReached: value });

  /**
   * A loud message the first time the minimum is reached; reset when it is lost again
   * (fewer players or a higher minimum). The flag is saved first, so a failed write
   * can only skip a message, never repeat it.
   */
  const checkMinimum = async (state: State) => {
    const event = toNotifyEvent(state.event);
    const eventId = event._id;
    const reached = event.minimum > 0 && state.count.exactly >= event.minimum;
    const announced = state.event.telegram?.minimumReached ?? false;

    if (reached && !announced) {
      await setMinimumReached(eventId, true);
      await notifier.notify(TOPIC, minimumReachedMessage(event, state.count));
    } else if (!reached && announced) {
      await setMinimumReached(eventId, false);
    }
  };

  /**
   * Reminders the day before and two hours before the start. Each is claimed in the
   * database before it is sent, so several instances or a restart never repeat it.
   * The day-before one only goes to matches announced at least a day ahead and more
   * than two hours away; the announcement itself is fresh news otherwise.
   */
  const sendDueReminders = async (now = new Date()) => {
    let sent = 0;
    for (const kind of ['soon', 'day'] as const) {
      const notSent = sql`coalesce((${events.telegram} -> 'reminders' ->> ${kind})::boolean, false) = false`;
      const earliest =
        now.getTime() + (kind === 'day' ? REMINDER_LEAD.soon : 0);
      const due = await db
        .select()
        .from(events)
        .where(
          and(
            gt(events.startsAt, new Date(earliest)),
            lte(events.startsAt, new Date(now.getTime() + REMINDER_LEAD[kind])),
            notSent,
          ),
        );
      for (const candidate of due) {
        const scheduledAt = candidate.telegram?.scheduledAt;
        const announced = scheduledAt
          ? new Date(scheduledAt)
          : candidate.createdAt;
        if (
          kind === 'day' &&
          candidate.startsAt!.getTime() - announced.getTime() <
            REMINDER_LEAD.day
        ) {
          continue;
        }
        // The second reminder makes the first one pointless
        const flags = JSON.stringify(
          kind === 'soon' ? { soon: true, day: true } : { day: true },
        );
        const claimed = await db
          .update(events)
          .set({
            telegram: sql`jsonb_set(coalesce(${events.telegram}, '{}'::jsonb), '{reminders}', coalesce(${events.telegram} -> 'reminders', '{}'::jsonb) || ${flags}::jsonb)`,
          })
          .where(and(eq(events._id, candidate._id), notSent))
          .returning({ _id: events._id });
        if (!claimed.length) continue;

        try {
          const state = await load(candidate._id);
          if (!state) continue;
          const event = toNotifyEvent(state.event);
          const day =
            zonedDay(candidate.startsAt!, TIME_ZONE) ===
            zonedDay(now, TIME_ZONE)
              ? 'today'
              : 'tomorrow';
          await notifier.notify(
            TOPIC,
            reminderMessage(
              kind,
              event,
              state.count,
              await forecastFor(state),
              day,
            ),
            { replyMarkup: keyboard(event) },
          );
          sent++;
        } catch (err) {
          // Give the reminder back for the next run, and go on with the others
          log.error(
            { err, eventId: candidate._id },
            'telegram reminder failed',
          );
          await db
            .update(events)
            .set({
              telegram: sql`${events.telegram} #- ${`{reminders,${kind}}`}::text[]`,
            })
            .where(eq(events._id, candidate._id))
            .catch(() => undefined);
        }
      }
    }
    return sent;
  };

  let reminderTimer: NodeJS.Timeout | undefined;
  if (!test) {
    fastify.addHook('onReady', async () => {
      // The menu button of private chats opens the site as a Mini App, signed in
      if (publicUrl?.startsWith('https://')) {
        fastify.tg.bot.api
          .setChatMenuButton({
            menu_button: {
              type: 'web_app',
              text: 'Матчи',
              web_app: { url: publicUrl },
            },
          })
          .catch((err: unknown) =>
            log.warn({ err }, 'telegram menu button not set'),
          );
      }
      reminderTimer = setInterval(() => {
        sendDueReminders().catch((err: unknown) =>
          log.error({ err }, 'telegram reminders failed'),
        );
      }, 60_000);
    });
    fastify.addHook('onClose', async () => clearInterval(reminderTimer));
  }

  fastify.decorate('telegramBot', {
    eventCreated: (eventId) =>
      void serial(eventId, async () => {
        const state = await load(eventId);
        if (!state) return;

        const event = toNotifyEvent(state.event);
        const result = await notifier.notify(
          TOPIC,
          announcementMessage(
            event,
            state.people,
            state.count,
            await forecastFor(state),
          ),
          { pin: true, replyMarkup: keyboard(event) },
        );
        const saved = await mergeTelegram(eventId, {
          announcements: result.messages.map(({ chatId, messageId }) => ({
            chatId,
            messageId,
          })),
          minimumReached: false,
          scheduledAt: new Date().toISOString(),
        });

        // Deleted while the announcement was being sent: the cancellation
        // has no message ids to update, so strike these through here
        if (!saved) {
          await Promise.all(
            result.messages.map(async (target) => {
              await notifier.edit(target, cancelledAnnouncementMessage(event));
              await notifier.unpin(target);
            }),
          );
        }
      }),

    eventUpdated: (eventId, scheduleChanged) =>
      void serial(eventId, async (isLatest) => {
        const state = await load(eventId);
        if (!state) return;

        if (isLatest) await refreshAnnouncements(state);
        await checkMinimum(state);
        if (scheduleChanged) {
          // A new start time deserves new reminders
          await mergeTelegram(
            eventId,
            { scheduledAt: new Date().toISOString() },
            ['reminders'],
          );
          await notifier.notify(
            TOPIC,
            eventChangedMessage(toNotifyEvent(state.event)),
          );
        }
      }),

    eventCancelled: (snapshot) =>
      void serial(snapshot._id, async () => {
        const event = toNotifyEvent(snapshot);
        const announcements = snapshot.telegram?.announcements ?? [];

        await Promise.all(
          announcements.map(async (target) => {
            await notifier.edit(target, cancelledAnnouncementMessage(event));
            await notifier.unpin(target);
          }),
        );
        await notifier.notify(TOPIC, cancelledMessage(event));
      }),

    playersChanged: (kind, player, eventId) =>
      void serial(eventId, async (isLatest) => {
        const state = await load(eventId);
        if (!state) return;

        const event = toNotifyEvent(state.event);
        // A burst of sign-ups edits the announcement once, with the final state
        if (isLatest) await refreshAnnouncements(state);
        const waitlisted =
          kind !== 'removed' &&
          player._id !== undefined &&
          state.waitlisted.has(player._id);
        await notifier.notify(
          TOPIC,
          playersChangeMessage(kind, player, event, state.count, waitlisted),
          { silent: true },
        );

        await checkMinimum(state);
      }),

    squadChanged: (eventId, { promoted, demoted }) =>
      void serial(eventId, async () => {
        const state = await load(eventId);
        if (!state) return;
        const event = toNotifyEvent(state.event);
        await notifier.notify(
          TOPIC,
          squadChangedMessage(
            event,
            promoted.map((p) => p.name),
            demoted.map((p) => p.name),
          ),
        );

        // A personal note to players who use the bot; friends are told by the chat
        const notes = new Map<string, string>([
          ...promoted
            .filter((p) => p.userId)
            .map((p): [string, string] => [p.userId!, 'promoted']),
          ...demoted
            .filter((p) => p.userId)
            .map((p): [string, string] => [p.userId!, 'demoted']),
        ]);
        if (!notes.size) return;
        const recipients = await db
          .select({ _id: users._id, telegramId: users.telegramId })
          .from(users)
          .where(
            and(
              inArray(users._id, [...notes.keys()]),
              isNotNull(users.telegramId),
            ),
          );
        for (const user of recipients) {
          await notifier.send(
            user.telegramId!,
            notes.get(user._id) === 'promoted'
              ? html`🎉 Освободилось место: вы в составе на «${event.eventName}», ${formatWhen(event)}`
              : html`⏳ Мест на «${event.eventName}» стало меньше: вы в листе ожидания. Освободится место — напишу.`,
          );
        }
      }),

    teamsSplit: (eventId) =>
      void serial(eventId, async () => {
        const state = await load(eventId);
        if (!state?.event.teams?.length) return;
        await notifier.notify(
          TOPIC,
          teamsMessage(toNotifyEvent(state.event), state.event.teams),
        );
      }),

    sendDueReminders,
    botUsername: () =>
      fastify.tg.bot.isInited() ? fastify.tg.bot.botInfo.username : null,
  } satisfies TelegramNotifier);

  registerTelegramActions(fastify);
};

export default fp(telegramPlugin, {
  fastify: '5.x',
  name: 'telegram',
  dependencies: ['database', 'monitoring'],
});
