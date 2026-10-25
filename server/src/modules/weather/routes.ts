import { FastifyInstance } from 'fastify';

import { sendError } from '../../lib/http.js';

const weatherRoutes = async (fastify: FastifyInstance) => {
  fastify.get(
    '/get',
    { onRequest: [fastify.authenticate] },
    async (_request, reply) => {
      const { OPENWEATHER_API_KEY } = fastify.config;
      if (!OPENWEATHER_API_KEY) {
        return sendError(
          reply,
          503,
          'WEATHER_DISABLED',
          'weather is not configured',
        );
      }

      const url = new URL('https://api.openweathermap.org/data/2.5/onecall');
      url.searchParams.set('lat', '47.222531');
      url.searchParams.set('lon', '39.718705');
      url.searchParams.set('exclude', 'minutely,hourly');
      url.searchParams.set('appid', OPENWEATHER_API_KEY);
      url.searchParams.set('units', 'metric');

      const response = await fetch(url);
      if (!response.ok) {
        return sendError(
          reply,
          502,
          'WEATHER_UNAVAILABLE',
          `weather API responded with ${response.status}`,
        );
      }

      return response.json();
    },
  );
};

export default weatherRoutes;
