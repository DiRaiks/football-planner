import { Telegraf } from "telegraf";
import { Logger } from "winston";
import { ChatModel } from "./chat.model.js";

export const initBotCommands = (bot: Telegraf, logger?: Logger) => {
  bot.command("start", (ctx) => ctx.reply("Hello!"));

  bot.command("init", async (ctx) => {
    logger?.info(`Init command received from ${ctx.chat.id}`);
    const { id } = ctx.chat;

    let saveChat = true;
    try {
      await ChatModel.updateOne({ chatId: id }, { chatId: id }, { upsert: true });
    } catch (err) {
      saveChat = false;
      logger?.error(`Error saving chat ${id}: ${(err as Error).message}`);
    }

    if (saveChat) ctx.reply(`Chat ${id} saved`);
    else ctx.reply(`Chat ${id} not saved`);
  });

  bot.command("remove", async (ctx) => {
    logger?.info(`Remove command received from ${ctx.chat.id}`);
    const { id } = ctx.chat;

    let removeChat = true;
    try {
      await ChatModel.deleteOne({ chatId: id });
    } catch (err) {
      removeChat = false;
      logger?.error(`Error removing chat ${id}: ${(err as Error).message}`);
    }

    if (removeChat) ctx.reply(`Chat ${id} removed`);
    else ctx.reply(`Chat ${id} not removed`);
  });

  bot.command("help", (ctx) => {
    logger?.info(`Help command received from ${ctx.chat.id}`);
    const message = "/init - Initialize the bot" + "\n/remove - Remove the bot";
    ctx.reply(message);
  });

  logger?.info("Bot commands initialized");

  return bot;
};
