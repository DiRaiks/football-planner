import { Type, type Static } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ObjectId, forbidden, notFound } from '../../lib/http.js';
import { PlayerModel } from '../players/player.model.js';
import { EventModel, type EventDocument } from './event.model.js';

// Unknown fields (e.g. `_id`, `playersAmount`, `creatorId` sent by the client) are stripped by Ajv
const EventFields = {
  place: Type.String({ minLength: 1, maxLength: 200 }),
  time: Type.String({ minLength: 1, maxLength: 20 }),
  date: Type.String({ minLength: 1, maxLength: 40 }),
  minimum: Type.Integer({ minimum: 0, maximum: 100 }),
  eventName: Type.String({ minLength: 1, maxLength: 100 }),
};

const CreateEventBody = Type.Object(EventFields, {
  additionalProperties: false,
});
const ChangeEventBody = Type.Partial(Type.Object(EventFields), {
  additionalProperties: false,
});
const EventIdQuery = Type.Object({ eventID: ObjectId });

const eventsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  const canManage = (request: FastifyRequest, event: EventDocument) => {
    const user = request.currentUser!;
    return event.creatorId === user._id.toString() || fastify.isAdmin(user);
  };

  const getEvent = (eventID: string) => EventModel.findById(eventID);

  const changeEvent = async (
    request: FastifyRequest,
    reply: FastifyReply,
    eventID: string,
    data: Static<typeof ChangeEventBody>,
  ) => {
    const event = await getEvent(eventID);
    if (!event) return notFound(reply, 'event');
    if (!canManage(request, event)) return forbidden(reply);

    event.set(data);
    return event.save();
  };

  const deleteEvent = async (
    request: FastifyRequest,
    reply: FastifyReply,
    eventID: string,
  ) => {
    const event = await getEvent(eventID);
    if (!event) return notFound(reply, 'event');
    if (!canManage(request, event)) return forbidden(reply);

    await PlayerModel.deleteMany({ eventId: eventID });
    await event.deleteOne();
    return event;
  };

  fastify.get('/all', async () => EventModel.find());

  fastify.post(
    '/save',
    { schema: { body: CreateEventBody } },
    async (request) => {
      const event = await EventModel.create({
        ...request.body,
        playersAmount: 0,
        creatorId: request.currentUser!._id.toString(),
      });
      fastify.telegramBot.eventCreated({
        ...event.toObject(),
        _id: event._id.toString(),
      });

      return event;
    },
  );

  fastify.get(
    '/get/:eventID',
    { schema: { params: EventIdQuery } },
    async (request, reply) =>
      (await getEvent(request.params.eventID)) ?? notFound(reply, 'event'),
  );

  fastify.put(
    '/change/:eventID',
    { schema: { params: EventIdQuery, body: ChangeEventBody } },
    async (request, reply) =>
      changeEvent(request, reply, request.params.eventID, request.body),
  );

  fastify.delete(
    '/delete',
    { schema: { querystring: EventIdQuery } },
    async (request, reply) =>
      deleteEvent(request, reply, request.query.eventID),
  );
};

export default eventsRoutes;
