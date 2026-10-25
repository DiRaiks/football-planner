import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyRequest } from 'fastify';

import {
  ObjectId,
  forbidden,
  isDuplicateKeyError,
  notFound,
  sendError,
} from '../../lib/http.js';
import { calcAllPlayers } from '../../utils/index.js';
import { EventModel } from '../events/event.model.js';
import { PlayerModel, type PlayerDocument } from './player.model.js';

const Friend = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 50 }),
    status: Type.Boolean(),
  },
  { additionalProperties: false },
);

// The client sends the whole player document; unknown fields (`_id`, `userId`, `__v`...) are stripped
const PlayerFields = {
  name: Type.String({ minLength: 1, maxLength: 50 }),
  status: Type.Boolean(),
  friends: Type.Array(Friend, { maxItems: 20 }),
};

const CreatePlayerBody = Type.Object(
  { ...PlayerFields, eventId: ObjectId },
  { additionalProperties: false },
);
const ChangePlayerBody = Type.Partial(
  Type.Object(PlayerFields, { additionalProperties: false }),
);
const PlayerIdParams = Type.Object({ playerID: ObjectId });

const playersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  const canManage = (request: FastifyRequest, player: PlayerDocument) => {
    const user = request.currentUser!;
    return player.userId === user._id.toString() || fastify.isAdmin(user);
  };

  /** Recalculates the event's players amount after a change of its players list */
  const syncEvent = async (eventId: string) => {
    const players = await PlayerModel.find({ eventId });
    const { all: playersAmount, exactly, maybe } = calcAllPlayers(players);
    const event = await EventModel.findByIdAndUpdate(
      eventId,
      { playersAmount },
      { returnDocument: 'after' },
    );

    return { players, event, count: { exactly, maybe } };
  };

  const toNotifyEvent = (
    event: NonNullable<Awaited<ReturnType<typeof syncEvent>>['event']>,
  ) => ({
    ...event.toObject(),
    _id: event._id.toString(),
  });

  fastify.post(
    '/save',
    { schema: { body: CreatePlayerBody } },
    async (request, reply) => {
      const userId = request.currentUser!._id.toString();
      const event = await EventModel.findById(request.body.eventId);
      if (!event) return notFound(reply, 'event');

      // The unique (eventId, userId) index also covers concurrent sign-ups
      let player;
      try {
        player = await PlayerModel.create({
          ...request.body,
          userId,
          date: event.date,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        return sendError(
          reply,
          409,
          'PLAYER_EXISTS',
          'already signed up for this event',
        );
      }
      const {
        players,
        event: updatedEvent,
        count,
      } = await syncEvent(player.eventId);
      if (updatedEvent) {
        fastify.telegramBot.playerAdded(
          player.toObject(),
          toNotifyEvent(updatedEvent),
          count,
        );
      }

      return { players, event: updatedEvent };
    },
  );

  fastify.put(
    '/change/:playerID',
    { schema: { params: PlayerIdParams, body: ChangePlayerBody } },
    async (request, reply) => {
      const player = await PlayerModel.findById(request.params.playerID);
      if (!player) return notFound(reply, 'player');
      if (!canManage(request, player)) return forbidden(reply);

      player.set(request.body);
      await player.save();

      const { players, event, count } = await syncEvent(player.eventId);
      if (event)
        fastify.telegramBot.playerUpdated(
          player.toObject(),
          toNotifyEvent(event),
          count,
        );

      return { player, players, event };
    },
  );

  fastify.delete(
    '/delete/:playerID',
    { schema: { params: PlayerIdParams } },
    async (request, reply) => {
      const player = await PlayerModel.findById(request.params.playerID);
      if (!player) return notFound(reply, 'player');
      if (!canManage(request, player)) return forbidden(reply);

      await player.deleteOne();

      const { players, event, count } = await syncEvent(player.eventId);
      if (event)
        fastify.telegramBot.playerRemoved(
          player.toObject(),
          toNotifyEvent(event),
          count,
        );

      return { player, players, event };
    },
  );

  fastify.get(
    '/byEventId/:eventID',
    { schema: { params: Type.Object({ eventID: ObjectId }) } },
    async (request) => PlayerModel.find({ eventId: request.params.eventID }),
  );

  fastify.get(
    '/:eventID/:userID',
    {
      schema: { params: Type.Object({ eventID: ObjectId, userID: ObjectId }) },
    },
    async (request) =>
      PlayerModel.findOne({
        eventId: request.params.eventID,
        userId: request.params.userID,
      }),
  );
};

export default playersRoutes;
