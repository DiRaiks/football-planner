import { Telegraf } from 'telegraf';
import { ChatModel } from './chat.model.js';

type Player = {
  name: string;
  friends: { name: string }[];
  status: boolean;
};

type Event = {
  date: string;
  eventName: string;
  playersAmount: number;
  time: string;
  place: string;
  _id: string;
};

export const sendMessageAddPlayer = async <P extends Player, E extends Event>(
  player: P,
  event: E,
  exactly: number,
  maybe: number,
  bot: Telegraf,
) => {
  const chats = await ChatModel.find();

  let message = `Игрок ${player.name} пойдёт на матч "${event.eventName}",`;
  if (player.friends.length) {
    const friends = player.friends.map((friend) => friend.name);
    message += `\nДрузья: ${friends.toString()}`;
  }

  message +=
    `\nДата: ${event.date},` +
    `\nТекущее количество игроков: ${event.playersAmount} (точно: ${exactly}, возможно: ${maybe})`;

  if (!player.status) {
    message += '\nНо это не точно.';
  }

  for (const chat of chats) {
    await bot.telegram.sendMessage(chat.chatId, message);
  }
};

export const sendMessageRemovePlayer = async <
  P extends Player,
  E extends Event,
>(
  player: P,
  event: E,
  exactly: number,
  maybe: number,
  bot: Telegraf,
) => {
  const chats = await ChatModel.find();

  let message = `Игрок ${player.name} не пойдет на матч "${event.eventName}",`;
  if (player.friends.length) {
    const friends = player.friends.map((friend) => friend.name);
    message += `\nДрузья: ${friends.toString()}`;
  }
  message +=
    `\nДата: ${event.date},` +
    `\nТекущее количество игроков: ${event.playersAmount} (точно: ${exactly}, возможно: ${maybe})`;

  for (const chat of chats) {
    await bot.telegram.sendMessage(chat.chatId, message);
  }
};

export const sendMessageUpdatePlayer = async <
  P extends Player,
  E extends Event,
>(
  player: P,
  event: E,
  exactly: number,
  maybe: number,
  bot: Telegraf,
) => {
  const chats = await ChatModel.find();

  let message = `Игрок ${player.name} изменил свою запись на матч "${event.eventName}",`;
  if (player.friends.length) {
    const friends = player.friends.map((friend) => friend.name);
    message += `\nДрузья: ${friends.toString()}`;
  }
  message +=
    `\nДата: ${event.date},` +
    `\nТекущее количество игроков: ${event.playersAmount} (точно: ${exactly}, возможно: ${maybe})`;

  for (const chat of chats) {
    await bot.telegram.sendMessage(chat.chatId, message);
  }
};

export const sendMessageAddEvent = async <E extends Event>(
  event: E,
  bot: Telegraf,
) => {
  const chats = await ChatModel.find();

  const message =
    `Создан матч "${event.eventName}",` +
    `\nДата: ${event.date},` +
    `\nВремя: ${event.time},` +
    `\nМесто: ${event.place},` +
    `\nЗапись: https://football-planner.ru/events/${event._id},`;

  for (const chat of chats) {
    const currentMessage = await bot.telegram.sendMessage(chat.chatId, message);
    await bot.telegram.pinChatMessage(chat.chatId, currentMessage.message_id);
  }
};
