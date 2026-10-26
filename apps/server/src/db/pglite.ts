/**
 * Postgres in WebAssembly for the tests, the end-to-end API and the data migration's
 * tests. Not used by the server in production: @electric-sql/pglite is a dev dependency.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { MIGRATIONS_FOLDER, type Database } from './index.js';
import * as schema from './schema.js';

export const createPgliteDatabase = async (): Promise<
  Database & { pglite: PGlite }
> => {
  const pglite = await PGlite.create();
  const db = drizzle(pglite, { schema });
  return {
    pglite,
    db,
    client: pglite,
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => pglite.close(),
  };
};
