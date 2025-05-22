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

  const uri = `mongodb+srv://${DATABASE_USER}:${DATABASE_PASSWORD}@cluster0-nuyru.mongodb.net/${DATABASE_NAME}?retryWrites=true&w=majority`;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    logger.info("Database connected");

    if (!fastify.mongoose) {
      fastify.decorate("mongoose", mongoose);
    }

    fastify.addHook("onClose", async () => {
      await mongoose.disconnect();
      logger.info("Database disconnected");
    });
  } catch (err) {
    logger.error(`Database connection error: ${(err as Error).message}`);
  }
};

export default fp(databasePlugin, "4.x");
