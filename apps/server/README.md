# server

Fastify API (`/v1`) and the Telegram bot. See the [repository README](../../README.md) for configuration and the [deployment guide](../../deploy/README.md).

The server speaks plain HTTP; TLS terminates at the reverse proxy (Caddy in production).

## Tests

```bash
npm test
```

Vitest with Postgres in memory (PGlite), or a real server with `TEST_DATABASE_URL`; the bot is tested against a fake Telegram API.

## Database

The schema is in `src/db/schema.ts`. After changing it, `npm run db:generate` writes the next SQL migration to `drizzle/`; the server applies pending migrations on startup.
