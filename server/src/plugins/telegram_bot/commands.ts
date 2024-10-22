import { Telegraf } from "telegraf";
import { Logger } from "winston";

export const initBotCommands = (bot: Telegraf, logger?: Logger) => {
  bot.command("start", (ctx) => ctx.reply("Hello!"));

  bot.command("init", async (ctx) => {
    logger?.info(`Init command received from ${ctx.chat.id}`);
    const { id } = ctx.chat;

    // TODO: Save chat to database
    const saveChat = await Promise.resolve(true);

    if (saveChat) ctx.reply(`Chat ${id} saved`);
    else ctx.reply(`Chat ${id} not saved`);
  });

  bot.command("remove", async (ctx) => {
    logger?.info(`Remove command received from ${ctx.chat.id}`);
    const { id } = ctx.chat;

    // TODO: Remove chat from database
    const removeChat = await Promise.resolve(true);

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
