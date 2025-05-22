import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import fastifyJwt from "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const { JWT_SECRET } = fastify.config;

  fastify.register(fastifyJwt, { secret: JWT_SECRET });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send(err);
    }
  });
};

export default fp(authPlugin, "5.x");
