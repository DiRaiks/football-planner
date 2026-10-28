import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  City,
  CitySearchQuery,
  DefaultLocation,
} from '@football-planner/shared';

/** For the match form: cities to pick the weather location from, and the default */
const weatherRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { weather } = fastify.services;

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get(
    '/cities',
    {
      schema: {
        querystring: CitySearchQuery,
        response: { 200: Type.Array(City) },
      },
    },
    async (request) => weather.searchCities(request.query.q),
  );

  fastify.get(
    '/default',
    { schema: { response: { 200: DefaultLocation } } },
    async () => ({ location: weather.default }),
  );
};

export default weatherRoutes;
