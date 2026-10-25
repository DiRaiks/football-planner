import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  ObjectId,
  Player,
  PlayersChange,
  SetPaidBody,
  SignUpBody,
  UpdatePlayerBody,
} from '@football-planner/shared';

import { toPlayerDto } from '../../modules/players/player.model.js';
import { toPlayersChangeDto } from '../../modules/players/players.service.js';

const EventParams = Type.Object({ eventId: ObjectId });
const PlayerParams = Type.Object({ eventId: ObjectId, playerId: ObjectId });

/** Players of an event, mounted at /v1/events/:eventId/players */
const playersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { players } = fastify.services;

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get(
    '/',
    { schema: { params: EventParams, response: { 200: Type.Array(Player) } } },
    async (request) => {
      const roster = await players.roster(request.params.eventId);
      return roster.players.map((player) =>
        toPlayerDto(player, roster.waitlisted.has(player._id.toString())),
      );
    },
  );

  fastify.post(
    '/',
    {
      schema: {
        params: EventParams,
        body: SignUpBody,
        response: { 201: PlayersChange },
      },
    },
    async (request, reply) => {
      const result = await players.signUp(
        request.params.eventId,
        request.body,
        request.currentUser!,
      );
      return reply.code(201).send(toPlayersChangeDto(result));
    },
  );

  fastify.get(
    '/me',
    { schema: { params: EventParams, response: { 200: Player } } },
    async (request) => {
      const mine = await players.findMine(
        request.params.eventId,
        request.currentUser!,
      );
      return toPlayerDto(mine.player, mine.waitlisted);
    },
  );

  fastify.patch(
    '/:playerId',
    {
      schema: {
        params: PlayerParams,
        body: UpdatePlayerBody,
        response: { 200: PlayersChange },
      },
    },
    async (request) =>
      toPlayersChangeDto(
        await players.update(
          request.params.playerId,
          request.body,
          request.currentUser!,
          request.params.eventId,
        ),
      ),
  );

  fastify.patch(
    '/:playerId/paid',
    {
      schema: {
        params: PlayerParams,
        body: SetPaidBody,
        response: { 200: Player },
      },
    },
    async (request) => {
      const { player, waitlisted } = await players.setPaid(
        request.params.eventId,
        request.params.playerId,
        request.body.paid,
        request.currentUser!,
      );
      return toPlayerDto(player, waitlisted);
    },
  );

  fastify.delete(
    '/:playerId',
    { schema: { params: PlayerParams, response: { 200: PlayersChange } } },
    async (request) =>
      toPlayersChangeDto(
        await players.remove(
          request.params.playerId,
          request.currentUser!,
          request.params.eventId,
        ),
      ),
  );
};

export default playersRoutes;
