import { FastifyInstance } from "fastify";
import { UserModel, type User } from "./user.model.js";
import { PlayerModel } from "../players/player.model.js";

const usersRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/", { onRequest: [fastify.authenticate] }, async () => {
    return UserModel.find();
  });

  fastify.patch(
    "/change",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id, ...data } = request.body as Partial<User> & { id: string };
      return UserModel.findByIdAndUpdate(id, data, { new: true, upsert: true });
    },
  );

  fastify.get(
    "/userEventsCount/:userId",
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { userId } = request.params as { userId: string };
      const events = await PlayerModel.find({ userId });
      return { count: events.length };
    },
  );
};

export default usersRoutes;
