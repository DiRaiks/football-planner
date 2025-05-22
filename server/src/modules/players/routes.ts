import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PlayerModel, PlayerEntity } from './player.model.js';
import { EventModel } from '../events/event.model.js';

const playersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/all', { onRequest: [fastify.authenticate] }, async () => {
    return PlayerModel.find();
  });

  fastify.post('/save', { onRequest: [fastify.authenticate] }, async (request) => {
    const body = request.body as PlayerEntity;

    const player = await PlayerModel.create(body);

    const players = await PlayerModel.find({ eventId: player.eventId });
    const exactly = players.filter((p) => p.status).length;
    const maybe = players.length - exactly;

    const updatedEvent = await EventModel.findByIdAndUpdate(
      player.eventId,
      { playersAmount: players.length },
      { new: true },
    );

    if (updatedEvent) {
      await fastify.telegramBot.sendMessageAddPlayer(
        player.toObject(),
        updatedEvent.toObject(),
        exactly,
        maybe,
        fastify.telegramBot.bot,
      );
    }

    return { players, event: updatedEvent };
  });

  fastify.delete('/delete', { onRequest: [fastify.authenticate] }, async (request) => {
    const { id } = request.query as { id: string };

    const removedPlayer = await PlayerModel.findByIdAndDelete(id);
    if (!removedPlayer) return null;

    const players = await PlayerModel.find({ eventId: removedPlayer.eventId });
    const exactly = players.filter((p) => p.status).length;
    const maybe = players.length - exactly;

    const updatedEvent = await EventModel.findByIdAndUpdate(
      removedPlayer.eventId,
      { playersAmount: players.length },
      { new: true },
    );

    if (updatedEvent) {
      await fastify.telegramBot.sendMessageRemovePlayer(
        removedPlayer.toObject(),
        updatedEvent.toObject(),
        exactly,
        maybe,
        fastify.telegramBot.bot,
      );
    }

    return { player: removedPlayer, players, event: updatedEvent };
  });

  fastify.delete('/delete/:playerID', { onRequest: [fastify.authenticate] }, async (request) => {
    const { playerID } = request.params as { playerID: string };

    const removedPlayer = await PlayerModel.findByIdAndDelete(playerID);
    if (!removedPlayer) return null;

    const players = await PlayerModel.find({ eventId: removedPlayer.eventId });
    const exactly = players.filter((p) => p.status).length;
    const maybe = players.length - exactly;

    const updatedEvent = await EventModel.findByIdAndUpdate(
      removedPlayer.eventId,
      { playersAmount: players.length },
      { new: true },
    );

    if (updatedEvent) {
      await fastify.telegramBot.sendMessageRemovePlayer(
        removedPlayer.toObject(),
        updatedEvent.toObject(),
        exactly,
        maybe,
        fastify.telegramBot.bot,
      );
    }

    return { player: removedPlayer, players, event: updatedEvent };
  });

  fastify.get('/byEventId', { onRequest: [fastify.authenticate] }, async (request) => {
    const { eventID } = request.query as { eventID: string };
    return PlayerModel.find({ eventId: eventID });
  });

  fastify.get('/byEventId/:eventID', { onRequest: [fastify.authenticate] }, async (request) => {
    const { eventID } = request.params as { eventID: string };
    return PlayerModel.find({ eventId: eventID });
  });

  fastify.get('/:eventID/:userID', { onRequest: [fastify.authenticate] }, async (request) => {
    const { eventID, userID } = request.params as { eventID: string; userID: string };
    return PlayerModel.findOne({ eventId: eventID, userId: userID });
  });

  fastify.get('/get/:playerID', { onRequest: [fastify.authenticate] }, async (request) => {
    const { playerID } = request.params as { playerID: string };
    return PlayerModel.findById(playerID);
  });

  fastify.patch('/change', { onRequest: [fastify.authenticate] }, async (request) => {
    const { id, ...data } = request.body as Partial<PlayerEntity> & { id: string };
    return PlayerModel.findByIdAndUpdate(id, data, { new: true });
  });

  fastify.patch('/change/:playerID', { onRequest: [fastify.authenticate] }, async (request) => {
    const { playerID } = request.params as { playerID: string };
    const data = request.body as Partial<PlayerEntity>;
    return PlayerModel.findByIdAndUpdate(playerID, data, { new: true });
  });
};

export default fp(playersRoutes, '4.x');
