// Fills `startsAt` on events saved before it existed and normalises their date and time.
//
//   node scripts/migrate-dates.mjs --dry-run      show what would change, write nothing
//   node scripts/migrate-dates.mjs                apply
//   node scripts/migrate-dates.mjs --all          recompute every event, e.g. after changing TIME_ZONE
//
// Reads MONGO_URI and TIME_ZONE from the environment (in the container they are set already;
// locally: npm run migrate-dates -- --dry-run). Needs the build: the logic lives in dist/lib.
import mongoose from 'mongoose';

const lib = await import('../dist/lib/migrate-dates.js').catch(() => null);
const { isTimeZone } = await import('../dist/lib/time.js').catch(() => ({}));
if (!lib || !isTimeZone) {
  console.error(
    'Build the server first: npm run build --workspace apps/server',
  );
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const timeZone = process.env.TIME_ZONE || 'UTC';

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set');
  process.exit(1);
}
if (!isTimeZone(timeZone)) {
  console.error(`TIME_ZONE "${timeZone}" is not a known time zone`);
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const { changed, failed, players } = await lib.migrateDates(
  mongoose.connection.db,
  { timeZone, dryRun, all: args.has('--all') },
);
await mongoose.disconnect();

for (const event of changed) {
  console.log(
    `${event.id} ${event.date} ${event.time} -> ${event.startsAt.toISOString()}${
      event.was ? ` (was ${event.was})` : ''
    }`,
  );
}
if (players) console.log(`players with a corrected match day: ${players}`);
console.log(
  `${dryRun ? 'would update' : 'updated'} ${changed.length} event(s), time zone ${timeZone}`,
);
if (failed.length) {
  console.error(
    `could not read the date or time of ${failed.length} event(s):`,
  );
  for (const event of failed) {
    console.error(
      `  ${event.id} date=${JSON.stringify(event.date)} time=${JSON.stringify(event.time)}`,
    );
  }
  console.error('Fix them in the app or in the database, then run again.');
  process.exit(1);
}
