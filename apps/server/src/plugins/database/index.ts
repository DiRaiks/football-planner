import mongoose from 'mongoose';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { dropLegacyUserIndexes } from '../../modules/users/user.model.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongoose: typeof mongoose;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const { MONGO_URI } = fastify.config;
  const logger = fastify.log;

  // Fail fast: the API is useless without a database, so a connection error aborts startup
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  logger.info('Database connected');

  await dropLegacyUserIndexes().catch((err: Error) =>
    logger.error(`Dropping legacy user indexes failed: ${err.message}`),
  );

  // Build indexes before serving requests; unique indexes back the duplicate checks.
  // A failure (e.g. existing duplicates) is logged instead of aborting startup.
  await Promise.all(
    mongoose.modelNames().map((name) =>
      mongoose
        .model(name)
        .init()
        .catch((err: Error) =>
          logger.error(`Index build failed for ${name}: ${err.message}`),
        ),
    ),
  );

  if (!fastify.mongoose) {
    fastify.decorate('mongoose', mongoose);
  }

  fastify.addHook('onClose', async () => {
    await mongoose.disconnect();
    logger.info('Database disconnected');
  });
};

export default fp(databasePlugin, { fastify: '5.x', name: 'database' });
