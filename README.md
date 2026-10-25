# football-planner

## Structure

- `apps/server` — Fastify API and Telegram bot
- `packages/shared` — API schemas and types (TypeBox) shared by the server and clients

The API lives under `/v1`. Paths without the prefix serve the current frontend and will be removed once it moves to `/v1`.

## Development

```bash
npm install
npm run dev     # API with reload, reads .env from the repository root
npm test        # all workspaces
npm run build
```

## Configuration

Copy `.env.example` to `.env` and fill in the values. Required: `PORT`, `MONGO_URI`, `JWT_SECRET` (at least 32 characters).

`MONGO_URI` accepts any MongoDB connection string, so both MongoDB Atlas (`mongodb+srv://...`) and a self-hosted instance (`mongodb://mongo:27017/football`) work.

Telegram notifications are enabled only when `BOT_TOKEN` is set. Links in bot messages use `PUBLIC_URL`.

Weather comes from [Open-Meteo](https://open-meteo.com) (no API key). Events can store venue coordinates; `WEATHER_DEFAULT_LAT`/`WEATHER_DEFAULT_LON` are used for events without them.

## Admins

Admins can edit and delete any event and player. Grant or revoke the role with:

```bash
npm run set-role --workspace apps/server -- user@example.com admin
```

The script reads `MONGO_URI` from `.env` and revokes the user's existing tokens.

## Development using Docker Compose

1. Create a `.env` file (see above).
   To enable HTTPS, place `privkey.pem` and `fullchain.pem` inside a `certs/`
   directory in the project root. The compose configuration will mount these
   files and set the appropriate environment variables automatically.
2. Run `docker compose up --build` to build and start the server container.

## Running tests

Execute `npm test` from the project root to run the server test suite. Tests start an in-memory MongoDB, so no database is needed.
