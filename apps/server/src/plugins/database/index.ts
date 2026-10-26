import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  connectPostgres,
  type Database,
  type Db,
  type SqlClient,
} from '../../db/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    /** Raw queries: the Telegram kit's chat store, health checks */
    sqlClient: SqlClient;
    /** Whether the database answers a trivial query in time */
    databaseConnected: () => Promise<boolean>;
  }
}

export type DatabasePluginOptions = {
  /** A database to use instead of DATABASE_URL, e.g. PGlite in tests; not closed with the app */
  database?: Database;
};

const PING_TIMEOUT_MS = 2000;

const databasePlugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify,
  options,
) => {
  const { DATABASE_URL, MONGO_URI } = fastify.config;
  const logger = fastify.log;

  let database = options.database;
  if (!database) {
    if (!DATABASE_URL) {
      throw new Error(
        MONGO_URI
          ? 'MONGO_URI is no longer used: the server stores its data in Postgres now. ' +
              'Set DATABASE_URL (postgres://user:password@host:5432/db) and move the data ' +
              'with `npm run migrate-from-mongo` (deploy/README.md)'
          : 'DATABASE_URL is not set, e.g. postgres://user:password@host:5432/football',
      );
    }
    if (!/^postgres(ql)?:\/\//.test(DATABASE_URL)) {
      throw new Error(
        'DATABASE_URL must start with postgres:// or postgresql://',
      );
    }
    database = connectPostgres(DATABASE_URL);
    fastify.addHook('onClose', async () => {
      await database!.close();
      logger.info('Database disconnected');
    });
  }

  // Fail fast: the API is useless without a database, so a connection or migration
  // error aborts startup, before the server takes requests. On Postgres, migrate()
  // holds an advisory lock, so instances starting together take turns (db/index.ts)
  await database.migrate();
  logger.info('Database connected, migrations applied');

  const { client } = database;
  fastify.decorate('db', database.db);
  fastify.decorate('sqlClient', client);
  fastify.decorate('databaseConnected', async () => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
    });
    const ping = client.query('SELECT 1').then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([ping, timeout]);
    } finally {
      clearTimeout(timer);
    }
  });
};

export default fp(databasePlugin, { fastify: '5.x', name: 'database' });
