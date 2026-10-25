import { Telegraf } from 'telegraf';
import type { FastifyBaseLogger as Logger } from 'fastify';
import { ChatModel } from './chat.model.js';

export type NotifyPlayer = {
  name: string;
  friends: { name: string }[];
  status: boolean;
};

export type NotifyEvent = {
  date: string;
  eventName: string;
  playersAmount: number;
  time: string;
  place: string;
  _id: string;
};

export type PlayersCount = { exactly: number; maybe: number };

type Context = { bot: Telegraf; logger: Logger; publicUrl?: string };

const broadcast = async (
  { bot, logger }: Context,
  message: string,
  { pin = false } = {},
) => {
  const chats = await ChatModel.find();

  for (const chat of chats) {
    try {
      const sent = await bot.telegram.sendMessage(chat.chatId, message);
      if (pin) await bot.telegram.pinChatMessage(chat.chatId, sent.message_id);
    } catch (error) {
      logger.error(
        `Failed to send message to chat ${chat.chatId}: ${(error as Error).message}`,
      );
    }
  }
};

const playerMessage = (
  action: string,
  player: NotifyPlayer,
  event: NotifyEvent,
  { exactly, maybe }: PlayersCount,
) => {
  let message = `Игрок ${player.name} ${action} "${event.eventName}",`;
  if (player.friends.length) {
    message += `\nДрузья: ${player.friends.map((friend) => friend.name).toString()}`;
  }

  return (
    message +
    `\nДата: ${event.date},` +
    `\nТекущее количество игроков: ${event.playersAmount} (точно: ${exactly}, возможно: ${maybe})`
  );
};

export const sendMessageAddPlayer = (
  ctx: Context,
  player: NotifyPlayer,
  event: NotifyEvent,
  count: PlayersCount,
) => {
  let message = playerMessage('пойдёт на матч', player, event, count);
  if (!player.status) message += '\nНо это не точно.';

  return broadcast(ctx, message);
};

export const sendMessageRemovePlayer = (
  ctx: Context,
  player: NotifyPlayer,
  event: NotifyEvent,
  count: PlayersCount,
) => broadcast(ctx, playerMessage('не пойдет на матч', player, event, count));

export const sendMessageUpdatePlayer = (
  ctx: Context,
  player: NotifyPlayer,
  event: NotifyEvent,
  count: PlayersCount,
) =>
  broadcast(
    ctx,
    playerMessage('изменил свою запись на матч', player, event, count),
  );

export const sendMessageAddEvent = (ctx: Context, event: NotifyEvent) => {
  let message =
    `Создан матч "${event.eventName}",` +
    `\nДата: ${event.date},` +
    `\nВремя: ${event.time},` +
    `\nМесто: ${event.place},`;
  if (ctx.publicUrl)
    message += `\nЗапись: ${ctx.publicUrl}/events/${event._id}`;

  return broadcast(ctx, message, { pin: true });
};
