import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { connectPostgres, newId } from '../src/db/index.js';

const url = process.env.TEST_DATABASE_URL;

// Needs a real server: PGlite is one process
describe.runIf(url)('migrations on Postgres', () => {
  it('apply once when two processes start together', async () => {
    const name = `football_test_${newId()}`;
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    const target = new URL(url!);
    target.pathname = `/${name}`;
    const a = connectPostgres(target.toString());
    const b = connectPostgres(target.toString());
    try {
      await Promise.all([a.migrate(), b.migrate()]);
      const { rows } = await a.client.query(
        'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations',
      );
      expect(rows).toEqual([{ n: 1 }]);
    } finally {
      await a.close();
      await b.close();
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    }
  });
});
