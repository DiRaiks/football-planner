import mongoose from "mongoose";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    mongoose: typeof mongoose;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME } = fastify.config;
  const { logger } = fastify;

  const uri = `mongodb://${DATABASE_USER}:${DATABASE_PASSWORD}@localhost:27017/${DATABASE_NAME}`;

  try {
    await mongoose.connect(uri);
    logger.info("Database connected");

    if (!fastify.mongoose) {
      fastify.decorate("mongoose", mongoose);
    }

    fastify.addHook("onClose", async (instance) => {
      await mongoose.disconnect();
      instance.logger.info("Database disconnected");
    });
  } catch (err) {
    logger.error(`Database connection error: ${(err as Error).message}`);
  }
};

export default fp(databasePlugin, "4.x");
