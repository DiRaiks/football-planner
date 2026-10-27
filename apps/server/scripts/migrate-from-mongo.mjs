// Moves the data of the MongoDB era into Postgres, keeping the ids:
//
//   npm run migrate-from-mongo -- --dry-run   read MongoDB, print counts and problems
//   npm run migrate-from-mongo                apply the migrations, then copy the data
//
// Reads MONGO_URI (the old database), DATABASE_URL (the new one) and TIME_ZONE (start
// times of matches saved without one). Runs from a checkout with dev dependencies
// (mongodb, tsx); see deploy/README.md.
//
// Run it once, into an empty database, before the new server takes requests: a second
// copy would bring back rows deleted in Postgres since. It refuses a database with
// data unless --force is given, which only adds the rows that are missing.
import { MongoClient } from 'mongodb';

import { connectPostgres } from '../src/db/index.ts';
import {
  NotEmptyError,
  formatReport,
  migrateFromMongo,
} from '../src/db/migrate-from-mongo.ts';
import { isTimeZone } from '../src/lib/time.ts';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const { MONGO_URI, DATABASE_URL } = process.env;
const timeZone = process.env.TIME_ZONE || 'UTC';

if (!MONGO_URI) fail('MONGO_URI is not set: the MongoDB to copy from');
if (!dryRun && !DATABASE_URL)
  fail('DATABASE_URL is not set: the Postgres to copy to');
if (!isTimeZone(timeZone))
  fail(`TIME_ZONE "${timeZone}" is not a known time zone`);
if (!process.env.TIME_ZONE) console.warn('TIME_ZONE is not set, using UTC');

const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
// Applies the migrations under the server's advisory lock (db/index.ts): a server
// starting at the same time waits instead of migrating along
const database = dryRun
  ? null
  : connectPostgres(DATABASE_URL, {
      onIdleError: (error) =>
        console.warn(`Idle Postgres connection dropped: ${error.message}`),
    });
try {
  await mongo.connect();
  const db = mongo.db();
  console.log(
    `${dryRun ? 'Dry run: nothing is written. ' : ''}MongoDB database "${db.databaseName}"`,
  );
  const report = await migrateFromMongo(
    (name) => db.collection(name).find({}),
    database,
    { timeZone, dryRun, force },
  );
  for (const line of formatReport(report)) console.log(line);
} catch (error) {
  if (!(error instanceof NotEmptyError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongo.close();
  await database?.close();
}
