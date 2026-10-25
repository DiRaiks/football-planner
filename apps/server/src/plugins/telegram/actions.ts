import { html, joinHtml } from '@dirai/tg-kit';
import type { FastifyInstance } from 'fastify';
import type { Context } from 'grammy';

import { AppError } from '../../lib/errors.js';
import { EventModel } from '../../modules/events/event.model.js';
import type { UserDocument } from '../../modules/users/user.model.js';
import type { RsvpAction } from './messages.js';

/** Failed /link attempts per Telegram user before a pause, and the pause */
const LINK_ATTEMPTS = 5;
const LINK_WINDOW_MS = 15 * 60_000;

const reply = (ctx: Context, text: string) => ctx.answerCallbackQuery({ text });

const isCode = (error: unknown, code: string) =>
  error instanceof AppError && error.code === code;

/**
 * Sign-up buttons under announcements and reminders, and `/link CODE` that links a
 * site account to the Telegram user. Whoever presses a button gets an account made
 * from their Telegram profile on the first press.
 */
export const registerTelegramActions = (fastify: FastifyInstance) => {
  const { bot } = fastify.tg;

  /** The player's state after a press, as the answer to it */
  const stateOf = async (eventId: string, user: UserDocument) => {
    const { player, waitlisted } = await fastify.services.players.findMine(
      eventId,
      user,
    );
    if (waitlisted) return '⏳ Мест нет: вы в листе ожидания';
    return player.status ? '✅ Вы в составе' : '🤔 Отметил: возможно';
  };

  const rsvp = async (
    eventId: string,
    action: RsvpAction,
    user: UserDocument,
  ): Promise<string> => {
    const { players } = fastify.services;
    const mine = await players.findByEventAndUser(eventId, user._id.toString());
    const playerId = mine?._id.toString();

    switch (action) {
      case 'yes':
      case 'maybe': {
        const status = action === 'yes';
        if (mine && mine.status === status) {
          return status ? 'Вы уже в списке' : 'Вы уже отметили «возможно»';
        }
        try {
          if (mine) await players.update(playerId!, { status }, user, eventId);
          else {
            await players.signUp(
              eventId,
              { name: user.name, status, friends: [] },
              user,
            );
          }
        } catch (error) {
          // A second quick press: the first one signed up already
          if (!isCode(error, 'PLAYER_EXISTS')) throw error;
        }
        return stateOf(eventId, user);
      }
      case 'no': {
        if (!mine) return 'Вас и так нет в списке';
        await players.remove(playerId!, user, eventId);
        return mine.friends.length > 0
          ? 'Отметил: вы и ваши гости не пойдёте'
          : 'Отметил: вы не пойдёте';
      }
      case 'friend': {
        if (!mine) {
          try {
            await players.signUp(
              eventId,
              { name: user.name, status: true, friends: [] },
              user,
            );
          } catch (error) {
            if (!isCode(error, 'PLAYER_EXISTS')) throw error;
          }
        }
        const me = await players.findByEventAndUser(
          eventId,
          user._id.toString(),
        );
        try {
          const { guest } = await players.addGuest(
            me!._id.toString(),
            user,
            eventId,
          );
          return `Добавил: ${guest}`;
        } catch (error) {
          if (isCode(error, 'TOO_MANY_FRIENDS')) {
            return 'Больше гостей добавить нельзя';
          }
          throw error;
        }
      }
    }
  };

  bot.callbackQuery(
    /^rsvp:([a-f0-9]{24}):(yes|maybe|no|friend)$/,
    async (ctx) => {
      const [, eventId, action] = ctx.match as [string, string, RsvpAction];
      try {
        const event = await EventModel.findById(eventId);
        if (!event) return await reply(ctx, 'Матч отменён');
        if (event.startsAt && event.startsAt.getTime() < Date.now()) {
          return await reply(ctx, 'Матч уже начался');
        }
        const user = await fastify.services.telegramAccounts.findOrCreate(
          ctx.from,
        );
        return await reply(ctx, await rsvp(eventId, action, user));
      } catch (err) {
        fastify.log.error({ err, eventId }, 'telegram sign-up failed');
        return reply(ctx, 'Не получилось, попробуйте ещё раз');
      }
    },
  );

  // Failed /link attempts by Telegram user: a code cannot be guessed by trying
  const failures = new Map<number, { count: number; since: number }>();
  const tooManyFailures = (userId: number) => {
    const entry = failures.get(userId);
    if (!entry || Date.now() - entry.since > LINK_WINDOW_MS) return false;
    return entry.count >= LINK_ATTEMPTS;
  };
  const recordFailure = (userId: number) => {
    const entry = failures.get(userId);
    if (!entry || Date.now() - entry.since > LINK_WINDOW_MS) {
      if (failures.size > 10_000) failures.clear();
      failures.set(userId, { count: 1, since: Date.now() });
    } else {
      entry.count++;
    }
  };

  fastify.tg.command({
    command: 'link',
    description: 'Привязать аккаунт сайта: /link КОД',
    handler: async (ctx) => {
      const accounts = fastify.services.telegramAccounts;
      const code = String(ctx.match ?? '').trim();
      try {
        if (ctx.chat?.type !== 'private' || !ctx.from) {
          // Everyone in the chat has seen the code now
          if (code) await accounts.revokeCode(code);
          return await ctx.reply(
            'Отправьте /link КОД мне в личные сообщения. Этот код больше не действует: получите новый в профиле.',
          );
        }
        if (!code) {
          return await ctx.reply(
            'Получите код в профиле на сайте и отправьте: /link КОД',
          );
        }
        if (tooManyFailures(ctx.from.id)) {
          return await ctx.reply(
            'Слишком много неверных кодов. Попробуйте через 15 минут.',
          );
        }

        const result = await accounts.link(code, ctx.from);
        if (result.status === 'expired') recordFailure(ctx.from.id);
        const text =
          result.status === 'linked'
            ? joinHtml([
                html`✅ Telegram привязан к аккаунту <b>${result.user.name}</b>.`,
                'Записи, сделанные кнопками, теперь видны на сайте.',
              ])
            : result.status === 'taken'
              ? html`Этот Telegram уже привязан к другому аккаунту. Отвяжите его там в профиле.`
              : html`Код не подошёл или устарел. Получите новый в профиле на сайте.`;
        return await ctx.reply(text.value, { parse_mode: 'HTML' });
      } catch (err) {
        fastify.log.error({ err }, 'telegram link failed');
        return ctx.reply('Не получилось привязать, попробуйте ещё раз.');
      }
    },
  });
};
