import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateEventBody,
  Event,
  EventWeather,
  ObjectId,
  UpdateEventBody,
} from '@football-planner/shared';

import { AppError } from '../../lib/errors.js';
import { toEventDto } from '../../modules/events/event.model.js';

const Params = Type.Object({ id: ObjectId });

const eventsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { events, weather } = fastify.services;

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get(
    '/',
    { schema: { response: { 200: Type.Array(Event) } } },
    async () => (await events.list()).map(toEventDto),
  );

  fastify.post(
    '/',
    { schema: { body: CreateEventBody, response: { 201: Event } } },
    async (request, reply) => {
      const event = await events.create(request.body, request.currentUser!);
      return reply.code(201).send(toEventDto(event));
    },
  );

  fastify.get(
    '/:id',
    { schema: { params: Params, response: { 200: Event } } },
    async (request) => toEventDto(await events.get(request.params.id)),
  );

  fastify.patch(
    '/:id',
    {
      schema: {
        params: Params,
        body: UpdateEventBody,
        response: { 200: Event },
      },
    },
    async (request) =>
      toEventDto(
        await events.update(
          request.params.id,
          request.body,
          request.currentUser!,
        ),
      ),
  );

  fastify.delete(
    '/:id',
    { schema: { params: Params } },
    async (request, reply) => {
      await events.remove(request.params.id, request.currentUser!);
      return reply.code(204).send();
    },
  );

  fastify.get(
    '/:id/weather',
    { schema: { params: Params, response: { 200: EventWeather } } },
    async (request) => {
      const event = await events.get(request.params.id);
      const location = weather.resolveLocation(event.location);
      if (!location) {
        throw new AppError(
          503,
          'WEATHER_DISABLED',
          'event has no location and no default is set',
        );
      }

      return {
        location,
        forecast: await weather.getForecastForDate(location, event.date),
      };
    },
  );
};

export default eventsRoutes;
