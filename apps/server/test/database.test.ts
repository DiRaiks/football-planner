import { createTestDatabase } from '@dirai-kit/pg/testing';
import { describe, expect, it } from 'vitest';

import { connectPostgres } from '../src/db/index.js';

const url = process.env.TEST_DATABASE_URL;

// Needs a real server: PGlite is one process
describe.runIf(url)('migrations on Postgres', () => {
  it('apply once when two processes start together', async () => {
    const target = await createTestDatabase(url!, { prefix: 'football_test_' });
    const a = connectPostgres(target.url);
    const b = connectPostgres(target.url);
    try {
      await Promise.all([a.migrate(), b.migrate()]);
      const { rows } = await a.client.query(
        'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations',
      );
      expect(rows).toEqual([{ n: 1 }]);
    } finally {
      await a.close();
      await b.close();
      await target.drop();
    }
  });
});
