// Grants or revokes admin rights: node scripts/set-role.mjs <email> <admin|user>
// Reads DATABASE_URL from the environment (e.g. `npm run set-role -- <email> admin`
// with the repository's .env, or `docker compose exec server npm run set-role ...`).
import pg from 'pg';

const [email, role] = process.argv.slice(2);
if (!email || !['admin', 'user'].includes(role)) {
  console.error('Usage: node scripts/set-role.mjs <email> <admin|user>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const result = await client
  .query(
    // Revoke existing tokens so the role change applies immediately
    `UPDATE users SET role = $2, token_version = token_version + 1, updated_at = now()
     WHERE lower(email) = lower($1)`,
    [email.trim(), role],
  )
  .finally(() => client.end());

if (!result.rowCount) {
  console.error(`User ${email} not found`);
  process.exit(1);
}
console.log(`User ${email} is now ${role}`);
