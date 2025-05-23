import { EventModel, EventEntity } from './event.model.js';
import { FastifyInstance } from 'fastify';

const eventsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/all', { onRequest: [fastify.authenticate] }, async () => {
    return EventModel.find();
  });

  fastify.post(
    '/save',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id } = request.user as { id: string };
      const body = request.body as EventEntity;
      const event = await EventModel.create({ ...body, creatorId: id });
      await fastify.telegramBot.sendMessageAddEvent(
        {
          ...event.toObject(),
          _id: event._id.toString(),
        },
        fastify.telegramBot.bot,
      );
      return event;
    },
  );

  fastify.delete(
    '/delete',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID } = request.query as { eventID: string };
      return EventModel.findByIdAndDelete(eventID);
    },
  );

  fastify.get(
    '/get',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID } = request.query as { eventID: string };
      return EventModel.findById(eventID);
    },
  );

  fastify.get(
    '/get/:eventID',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID } = request.params as { eventID: string };
      return EventModel.findById(eventID);
    },
  );

  fastify.put(
    '/change',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID, ...data } = request.body as Partial<EventEntity> & {
        eventID: string;
      };
      return EventModel.findByIdAndUpdate(eventID, data, { new: true });
    },
  );

  fastify.put(
    '/change/:eventID',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID } = request.params as { eventID: string };
      const data = request.body as Partial<EventEntity>;
      return EventModel.findByIdAndUpdate(eventID, data, { new: true });
    },
  );
};

export default eventsRoutes;
