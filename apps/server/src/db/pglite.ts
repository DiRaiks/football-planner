/**
 * Postgres in WebAssembly for the tests, the end-to-end API and the data migration's
 * tests. Not used by the server in production: @electric-sql/pglite is a dev dependency.
 */
import type { PGlite } from '@electric-sql/pglite';
import { migratedPglite } from '@dirai-kit/pg/testing';
import { drizzle } from 'drizzle-orm/pglite';

import { MIGRATIONS_FOLDER, type Database } from './index.js';
import * as schema from './schema.js';

export const createPgliteDatabase = async (): Promise<
  Database & { pglite: PGlite }
> => {
  // A copy of a template migrated once per test worker
  const pglite = await migratedPglite({ migrationsFolder: MIGRATIONS_FOLDER });
  const db = drizzle({ client: pglite, schema });
  return {
    pglite,
    db,
    client: pglite,
    // Already applied to the template
    migrate: async () => undefined,
    close: () => pglite.close(),
  };
};
