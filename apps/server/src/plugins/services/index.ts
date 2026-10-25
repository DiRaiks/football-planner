import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { EventsService } from '../../modules/events/events.service.js';
import { PlayersService } from '../../modules/players/players.service.js';
import {
  TelegramAccounts,
  UsersService,
} from '../../modules/users/users.service.js';
import { StatsService } from '../../modules/stats/stats.service.js';
import { WeatherService } from '../../modules/weather/weather.service.js';

export type Services = {
  events: EventsService;
  players: PlayersService;
  users: UsersService;
  telegramAccounts: TelegramAccounts;
  stats: StatsService;
  weather: WeatherService;
};

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}

const servicesPlugin: FastifyPluginAsync = async (fastify) => {
  const { WEATHER_DEFAULT_LAT: lat, WEATHER_DEFAULT_LON: lon } = fastify.config;
  const notifier = fastify.telegramBot;

  const players = new PlayersService(notifier);
  fastify.decorate('services', {
    events: new EventsService(notifier, fastify.config.TIME_ZONE),
    players,
    users: new UsersService(),
    telegramAccounts: new TelegramAccounts(players),
    stats: new StatsService(),
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
