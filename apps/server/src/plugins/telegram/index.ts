import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import mongoose from 'mongoose';
import {
  html,
  mongoStore,
  tgBot,
  tgHealth,
  tgNotifier,
  tgSubscriptions,
  type SentMessage,
  type TgBotOptions,
} from '@dirai/tg-kit';

import { splitList } from '../../env.js';
import { zonedDay } from '../../lib/time.js';
import {
  EventModel,
  type EventDocument,
  type EventEntity,
} from '../../modules/events/event.model.js';
import {
  computeRoster,
  type RosterPerson,
} from '../../modules/players/count.js';
import { PlayerModel } from '../../modules/players/player.model.js';
import { UserModel } from '../../modules/users/user.model.js';
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
  rsvpKeyboard,
  type NotifyEvent,
  type NotifyPlayer,
  type PlayersChangeKind,
  type ReminderKind,
} from './messages.js';

/** Event data needed after the event is deleted */
export type CancelledEvent = Pick<
  EventEntity,
  'eventName' | 'date' | 'time' | 'place' | 'minimum' | 'telegram'
> & { _id: string; maximum?: number };

export type TelegramNotifier = {
  eventCreated: (eventId: string) => void;
  /** `scheduleChanged`: date, time or place changed, which is worth a loud message */
  eventUpdated: (eventId: string, scheduleChanged: boolean) => void;
  eventCancelled: (event: CancelledEvent) => void;
  playersChanged: (
    kind: PlayersChangeKind,
    player: NotifyPlayer & { _id?: { toString(): string } },
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

const toNotifyEvent = (event: EventDocument | CancelledEvent): NotifyEvent => ({
  _id: event._id.toString(),
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
    // Chats saved by the previous bot have only `chatId` and keep receiving events
    store: mongoStore(mongoose.connection.collection('chats'), {
      legacyTopics: [TOPIC],
    }),
    topics: [TOPIC],
  });
  await fastify.register(tgNotifier);
  // Bot metrics (tg_*) go to the app's /metrics, the bot's state to its /health
  await fastify.register(tgHealth, {
    registry: fastify.metrics.registry,
    healthPath: false,
    metricsPath: false,
    // Well inside the 5 s of the Docker health check (Dockerfile)
    timeoutMs: 2000,
  });

  const { notifier, log } = fastify;
  const publicUrl = PUBLIC_URL?.replace(/\/+$/, '');

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
    const event = await EventModel.findById(eventId);
    if (!event) return null;
    const players = await PlayerModel.find({ eventId }).sort({
      createdAt: 1,
      _id: 1,
    });
    return { event, players, ...computeRoster(players, event.maximum ?? 0) };
  };
  type State = NonNullable<Awaited<ReturnType<typeof load>>>;

  /** Rewrites the pinned announcements with the current players */
  const refreshAnnouncements = async (state: State) => {
    const event = toNotifyEvent(state.event);
    const message = announcementMessage(event, state.people, state.count);
    const replyMarkup = rsvpKeyboard(event, publicUrl);
    const announcements: SentMessage[] =
      state.event.telegram?.announcements ?? [];

    await Promise.all(
      announcements.map((target) =>
        notifier.edit(target, message, { replyMarkup }),
      ),
    );
  };

  const setMinimumReached = (eventId: string, value: boolean) =>
    EventModel.updateOne(
      { _id: eventId },
      { $set: { 'telegram.minimumReached': value } },
    );

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

  const forecastFor = async (state: State) => {
    const { weather } = fastify.services;
    const location = weather.resolveLocation(state.event.location);
    if (!location) return null;
    return weather
      .getForecastForDate(location, state.event.date)
      .catch((err: unknown) => {
        log.warn({ err }, 'weather for a reminder failed');
        return null;
      });
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
      const flag = `telegram.reminders.${kind}`;
      const earliest =
        now.getTime() + (kind === 'day' ? REMINDER_LEAD.soon : 0);
      const due = await EventModel.find({
        startsAt: {
          $gt: new Date(earliest),
          $lte: new Date(now.getTime() + REMINDER_LEAD[kind]),
        },
        [flag]: { $ne: true },
      });
      for (const candidate of due) {
        const announced: unknown =
          candidate.telegram?.scheduledAt ?? candidate.get('createdAt');
        if (
          kind === 'day' &&
          announced instanceof Date &&
          candidate.startsAt!.getTime() - announced.getTime() <
            REMINDER_LEAD.day
        ) {
          continue;
        }
        const claimed = await EventModel.updateOne(
          { _id: candidate._id, [flag]: { $ne: true } },
          {
            $set: {
              [flag]: true,
              // The second reminder makes the first one pointless
              ...(kind === 'soon' && { 'telegram.reminders.day': true }),
            },
          },
        );
        if (!claimed.modifiedCount) continue;

        try {
          const state = await load(candidate._id.toString());
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
            { replyMarkup: rsvpKeyboard(event, publicUrl) },
          );
          sent++;
        } catch (err) {
          // Give the reminder back for the next run, and go on with the others
          log.error(
            { err, eventId: candidate._id },
            'telegram reminder failed',
          );
          await EventModel.updateOne(
            { _id: candidate._id },
            { $unset: { [flag]: 1 } },
          ).catch(() => undefined);
        }
      }
    }
    return sent;
  };

  let reminderTimer: NodeJS.Timeout | undefined;
  if (!test) {
    fastify.addHook('onReady', async () => {
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
          announcementMessage(event, state.people, state.count),
          { pin: true, replyMarkup: rsvpKeyboard(event, publicUrl) },
        );
        const saved = await EventModel.updateOne(
          { _id: eventId },
          {
            $set: {
              'telegram.announcements': result.messages,
              'telegram.minimumReached': false,
              'telegram.scheduledAt': new Date(),
            },
          },
        );

        // Deleted while the announcement was being sent: the cancellation
        // has no message ids to update, so strike these through here
        if (saved.matchedCount === 0) {
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
          await EventModel.updateOne(
            { _id: eventId },
            {
              $unset: { 'telegram.reminders': 1 },
              $set: { 'telegram.scheduledAt': new Date() },
            },
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
          state.waitlisted.has(player._id.toString());
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
        const users = await UserModel.find({
          _id: { $in: [...notes.keys()] },
          telegramId: { $exists: true, $ne: null },
        });
        for (const user of users) {
          await notifier.send(
            user.telegramId!,
            notes.get(user._id.toString()) === 'promoted'
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
