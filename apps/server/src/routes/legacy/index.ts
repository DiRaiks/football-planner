import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateEventBody,
  LoginBody,
  ObjectId,
  RegisterBody,
  SignUpBody,
  UpdateEventBody,
  UpdatePlayerBody,
} from '@football-planner/shared';

import { AppError } from '../../lib/errors.js';
import { toPublicUser } from '../../modules/users/user.model.js';
import { describeWeather } from '../../modules/weather/weather.service.js';

/**
 * Endpoints called by the current frontend (football_planner_react).
 * They are thin adapters over the services and go away once the frontend uses /v1.
 */
const legacyRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { users, events, players, weather } = fastify.services;
  const auth = { onRequest: [fastify.authenticate] };
  const rateLimit = {
    max: fastify.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  };

  // --- auth ---

  fastify.post(
    '/auth/login',
    { schema: { body: LoginBody }, config: { rateLimit } },
    async (request) => {
      const user = await users.login(request.body);
      return { ...toPublicUser(user), token: fastify.issueToken(user) };
    },
  );

  fastify.post(
    '/auth/registration',
    { schema: { body: RegisterBody }, config: { rateLimit } },
    async (request) => {
      const user = await users.register(request.body);
      return { ...toPublicUser(user), token: fastify.issueToken(user) };
    },
  );

  fastify.get('/auth/check', auth, async (request) =>
    toPublicUser(request.currentUser!),
  );

  fastify.get(
    '/users/userEventsCount/:userId',
    { ...auth, schema: { params: Type.Object({ userId: ObjectId }) } },
    async (request) => players.countEventsOfUser(request.params.userId),
  );

  // --- events ---

  const EventIdParams = Type.Object({ eventID: ObjectId });

  fastify.get('/events/all', auth, async () => events.list());

  fastify.post(
    '/events/save',
    { ...auth, schema: { body: CreateEventBody } },
    async (request) => events.create(request.body, request.currentUser!),
  );

  fastify.get(
    '/events/get/:eventID',
    { ...auth, schema: { params: EventIdParams } },
    (request) => events.get(request.params.eventID),
  );

  fastify.put(
    '/events/change/:eventID',
    { ...auth, schema: { params: EventIdParams, body: UpdateEventBody } },
    async (request) =>
      events.update(request.params.eventID, request.body, request.currentUser!),
  );

  fastify.delete(
    '/events/delete',
    { ...auth, schema: { querystring: EventIdParams } },
    async (request) =>
      events.remove(request.query.eventID, request.currentUser!),
  );

  // --- players ---

  const PlayerIdParams = Type.Object({ playerID: ObjectId });

  fastify.post(
    '/players/save',
    {
      ...auth,
      schema: {
        // The legacy client passes the event id in the body
        body: Type.Object(
          { ...SignUpBody.properties, eventId: ObjectId },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { eventId, ...input } = request.body;
      return players.signUp(eventId, input, request.currentUser!);
    },
  );

  fastify.put(
    '/players/change/:playerID',
    { ...auth, schema: { params: PlayerIdParams, body: UpdatePlayerBody } },
    async (request) =>
      players.update(
        request.params.playerID,
        request.body,
        request.currentUser!,
      ),
  );

  fastify.delete(
    '/players/delete/:playerID',
    { ...auth, schema: { params: PlayerIdParams } },
    async (request) =>
      players.remove(request.params.playerID, request.currentUser!),
  );

  fastify.get(
    '/players/byEventId/:eventID',
    { ...auth, schema: { params: EventIdParams } },
    async (request) => players.listByEvent(request.params.eventID),
  );

  fastify.get(
    '/players/:eventID/:userID',
    {
      ...auth,
      schema: { params: Type.Object({ eventID: ObjectId, userID: ObjectId }) },
    },
    async (request) =>
      players.findByEventAndUser(request.params.eventID, request.params.userID),
  );

  // --- weather ---

  // Same shape as the retired OpenWeather One Call 2.5 response, limited to the fields the client reads
  fastify.get('/weather/get', auth, async () => {
    const location = weather.resolveLocation();
    if (!location)
      throw new AppError(503, 'WEATHER_DISABLED', 'weather is not configured');

    const forecast = await weather.getDailyForecast(location);
    return {
      lat: location.lat,
      lon: location.lon,
      current: null,
      daily: forecast.map((day) => ({
        // Noon UTC keeps the date stable in any client time zone
        dt: Date.parse(`${day.date}T12:00:00Z`) / 1000,
        temp: { min: day.tempMin, max: day.tempMax },
        weather: [
          {
            description: day.description,
            icon: describeWeather(day.weatherCode).icon,
          },
        ],
        pop:
          day.precipitationProbability === null
            ? null
            : day.precipitationProbability / 100,
        wind_speed: day.windSpeedMax,
      })),
    };
  });
};

export default legacyRoutes;
