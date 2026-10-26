// Moves the data of the MongoDB era into Postgres, keeping the ids:
//
//   npm run migrate-from-mongo -- --dry-run   read MongoDB, print counts and problems
//   npm run migrate-from-mongo                apply the migrations, then copy the data
//
// Reads MONGO_URI (the old database), DATABASE_URL (the new one) and TIME_ZONE (start
// times of matches saved without one). Safe to run again: rows already in Postgres
// stay as they are. Runs from a checkout with dev dependencies (mongodb, tsx); see
// deploy/README.md.
import { MongoClient } from 'mongodb';

import { connectPostgres } from '../src/db/index.ts';
import {
  formatReport,
  migrateFromMongo,
} from '../src/db/migrate-from-mongo.ts';
import { isTimeZone } from '../src/lib/time.ts';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const dryRun = process.argv.includes('--dry-run');
const { MONGO_URI, DATABASE_URL } = process.env;
const timeZone = process.env.TIME_ZONE || 'UTC';

if (!MONGO_URI) fail('MONGO_URI is not set: the MongoDB to copy from');
if (!dryRun && !DATABASE_URL)
  fail('DATABASE_URL is not set: the Postgres to copy to');
if (!isTimeZone(timeZone))
  fail(`TIME_ZONE "${timeZone}" is not a known time zone`);
if (!process.env.TIME_ZONE) console.warn('TIME_ZONE is not set, using UTC');

const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
const database = dryRun ? null : connectPostgres(DATABASE_URL);
try {
  await mongo.connect();
  const db = mongo.db();
  console.log(
    `${dryRun ? 'Dry run: nothing is written. ' : ''}MongoDB database "${db.databaseName}"`,
  );
  const report = await migrateFromMongo(
    (name) => db.collection(name).find({}),
    database,
    { timeZone, dryRun },
  );
  for (const line of formatReport(report)) console.log(line);
} finally {
  await mongo.close();
  await database?.close();
}
