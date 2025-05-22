import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { EventModel, EventEntity } from "./event.model.js";

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/all", { onRequest: [fastify.authenticate] }, async () => {
    return EventModel.find();
  });

  fastify.post(
    "/save",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const body = request.body as EventEntity;
      const event = await EventModel.create(body);
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
    "/delete",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id } = request.query as { id: string };
      return EventModel.findByIdAndDelete(id);
    },
  );

  fastify.get(
    "/get",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id } = request.query as { id: string };
      return EventModel.findById(id);
    },
  );

  fastify.get(
    "/get/:eventID",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID } = request.params as { eventID: string };
      return EventModel.findById(eventID);
    },
  );

  fastify.patch(
    "/change",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id, ...data } = request.body as Partial<EventEntity> & {
        id: string;
      };
      return EventModel.findByIdAndUpdate(id, data, { new: true });
    },
  );

  fastify.patch(
    "/change/:eventID",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { eventID } = request.params as { eventID: string };
      const data = request.body as Partial<EventEntity>;
      return EventModel.findByIdAndUpdate(eventID, data, { new: true });
    },
  );
};

export default fp(eventsRoutes, "4.x");
