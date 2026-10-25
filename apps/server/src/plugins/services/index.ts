import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { EventsService } from '../../modules/events/events.service.js';
import { PlayersService } from '../../modules/players/players.service.js';
import {
  TelegramAccounts,
  UsersService,
} from '../../modules/users/users.service.js';
import {
  TelegramOidc,
  type TelegramOidcOptions,
} from '../../modules/users/telegram-login.js';
import { StatsService } from '../../modules/stats/stats.service.js';
import { WeatherService } from '../../modules/weather/weather.service.js';

export type Services = {
  events: EventsService;
  players: PlayersService;
  users: UsersService;
  telegramAccounts: TelegramAccounts;
  stats: StatsService;
  /** "Log in with Telegram" on the site; null until configured */
  telegramLogin: TelegramOidc | null;
  weather: WeatherService;
};

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}

type ServicesOptions = {
  telegramLogin?: Pick<TelegramOidcOptions, 'keys' | 'fetch'>;
};

const servicesPlugin: FastifyPluginAsync<ServicesOptions> = async (
  fastify,
  options,
) => {
  const {
    WEATHER_DEFAULT_LAT: lat,
    WEATHER_DEFAULT_LON: lon,
    TELEGRAM_LOGIN_CLIENT_ID: clientId,
    TELEGRAM_LOGIN_CLIENT_SECRET: clientSecret,
    PUBLIC_URL,
  } = fastify.config;
  const publicUrl = PUBLIC_URL?.replace(/\/+$/, '');
  if (clientId && clientSecret && !publicUrl) {
    fastify.log.warn(
      'PUBLIC_URL is not set, so "Log in with Telegram" is disabled',
    );
  }
  const notifier = fastify.telegramBot;

  const players = new PlayersService(notifier);
  fastify.decorate('services', {
    events: new EventsService(notifier, fastify.config.TIME_ZONE),
    players,
    users: new UsersService(),
    telegramAccounts: new TelegramAccounts(players),
    stats: new StatsService(),
    telegramLogin:
      clientId && clientSecret && publicUrl
        ? new TelegramOidc({
            clientId,
            clientSecret,
            redirectUri: `${publicUrl}/auth/telegram`,
            ...options.telegramLogin,
          })
        : null,
    weather: new WeatherService(
      lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    ),
  } satisfies Services);
};

export default fp(servicesPlugin, {
  fastify: '5.x',
  name: 'services',
  dependencies: ['telegram'],
});
