import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import mongoose from 'mongoose';
import {
  mongoStore,
  tgBot,
  tgNotifier,
  tgSubscriptions,
  type SentMessage,
  type TgBotOptions,
} from '@dirai/tg-kit';

import { splitList } from '../../env.js';
import {
  EventModel,
  type EventDocument,
  type EventEntity,
} from '../../modules/events/event.model.js';
import { countPlayers } from '../../modules/players/count.js';
import { PlayerModel } from '../../modules/players/player.model.js';
import {
  announcementMessage,
  cancelledAnnouncementMessage,
  cancelledMessage,
  eventChangedMessage,
  minimumReachedMessage,
  playersChangeMessage,
  signUpKeyboard,
  type NotifyEvent,
  type NotifyPlayer,
  type PlayersChangeKind,
} from './messages.js';

/** Event data needed after the event is deleted */
export type CancelledEvent = Pick<
  EventEntity,
  'eventName' | 'date' | 'time' | 'place' | 'minimum' | 'telegram'
> & { _id: string };

export type TelegramNotifier = {
  eventCreated: (eventId: string) => void;
  /** `scheduleChanged`: date, time or place changed, which is worth a loud message */
  eventUpdated: (eventId: string, scheduleChanged: boolean) => void;
  eventCancelled: (event: CancelledEvent) => void;
  playersChanged: (
    kind: PlayersChangeKind,
    player: NotifyPlayer,
    eventId: string,
  ) => void;
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

const noop = () => undefined;
const disabledNotifier: TelegramNotifier = {
  eventCreated: noop,
  eventUpdated: noop,
  eventCancelled: noop,
  playersChanged: noop,
};

const toNotifyEvent = (event: EventDocument | CancelledEvent): NotifyEvent => ({
  _id: event._id.toString(),
  eventName: event.eventName,
  date: event.date,
  time: event.time,
  place: event.place,
  minimum: event.minimum,
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
        'Привет! Я закрепляю анонсы матчей с актуальным составом и сообщаю об изменениях. /help',
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
  };

  const load = async (eventId: string) => {
    const event = await EventModel.findById(eventId);
    if (!event) return null;
    const players = await PlayerModel.find({ eventId });
    return { event, players, count: countPlayers(players) };
  };

  /** Rewrites the pinned announcements with the current players */
  const refreshAnnouncements = async (
    state: NonNullable<Awaited<ReturnType<typeof load>>>,
  ) => {
    const message = announcementMessage(
      toNotifyEvent(state.event),
      state.players,
      state.count,
    );
    const replyMarkup = signUpKeyboard(toNotifyEvent(state.event), publicUrl);
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
  const checkMinimum = async (
    state: NonNullable<Awaited<ReturnType<typeof load>>>,
  ) => {
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

  fastify.decorate('telegramBot', {
    eventCreated: (eventId) =>
      serial(eventId, async () => {
        const state = await load(eventId);
        if (!state) return;

        const event = toNotifyEvent(state.event);
        const result = await notifier.notify(
          TOPIC,
          announcementMessage(event, state.players, state.count),
          { pin: true, replyMarkup: signUpKeyboard(event, publicUrl) },
        );
        const saved = await EventModel.updateOne(
          { _id: eventId },
          {
            $set: {
              'telegram.announcements': result.messages,
              'telegram.minimumReached': false,
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
      serial(eventId, async (isLatest) => {
        const state = await load(eventId);
        if (!state) return;

        if (isLatest) await refreshAnnouncements(state);
        await checkMinimum(state);
        if (scheduleChanged) {
          await notifier.notify(
            TOPIC,
            eventChangedMessage(toNotifyEvent(state.event)),
          );
        }
      }),

    eventCancelled: (snapshot) =>
      serial(snapshot._id, async () => {
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
      serial(eventId, async (isLatest) => {
        const state = await load(eventId);
        if (!state) return;

        const event = toNotifyEvent(state.event);
        // A burst of sign-ups edits the announcement once, with the final state
        if (isLatest) await refreshAnnouncements(state);
        await notifier.notify(
          TOPIC,
          playersChangeMessage(kind, player, event, state.count),
          { silent: true },
        );

        await checkMinimum(state);
      }),
  } satisfies TelegramNotifier);
};

export default fp(telegramPlugin, {
  fastify: '5.x',
  name: 'telegram',
  dependencies: ['database'],
});
