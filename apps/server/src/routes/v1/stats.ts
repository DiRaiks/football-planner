import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AttendanceQuery, AttendanceRow } from '@football-planner/shared';

const statsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { stats } = fastify.services;

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get(
    '/attendance',
    {
      schema: {
        querystring: AttendanceQuery,
        response: { 200: Type.Array(AttendanceRow) },
      },
    },
    async (request) => stats.attendance(request.query.days ?? 90),
  );
};

export default statsRoutes;
