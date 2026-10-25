<div align="center">

<img src="apps/web/public/favicon.svg" width="56" alt="" />

# Football Planner

Sign-ups for amateur football matches: who is coming, how many are still missing, and what the weather will be.
The Telegram bot keeps a live, pinned announcement in your team chat.

</div>

<table>
  <tr>
    <td width="33%"><img src="docs/screenshots/events-light.jpg" alt="List of upcoming matches with date blocks and sign-up counts" /></td>
    <td width="33%"><img src="docs/screenshots/match-light.jpg" alt="Match page: scoreboard with 7 of 10 players, weather, and the player's sign-up" /></td>
    <td width="33%"><img src="docs/screenshots/match-dark.jpg" alt="The same match page in the dark theme" /></td>
  </tr>
  <tr>
    <td align="center">Upcoming matches</td>
    <td align="center">Match scoreboard</td>
    <td align="center">Dark theme</td>
  </tr>
</table>

<img src="docs/screenshots/match-desktop.jpg" alt="Match page on desktop: scoreboard and sign-up on the left, roster on the right" />

## Features

- **One-tap sign-up.** "Иду" or "Возможно" right on the match page, change your mind later, bring friends and mark whether each of them is sure.
- **Match scoreboard.** Sure players against the minimum, maybe players shown separately, and how many are still missing.
- **Weather for the match day** from [Open-Meteo](https://open-meteo.com), no API key needed.
- **Places and a waitlist.** Set how many fit on the pitch; later sure sign-ups wait in line in sign-up order and move up by themselves when someone drops out.
- **Telegram bot** with a pinned announcement per match that is edited on every change, quiet notes for sign-ups, and a loud message only when the minimum is reached, the time or place changes, or the match is cancelled.
- **Sign up from the chat.** Buttons under every announcement: "Иду", "Возможно", "Не иду", "+ Друг". The first press makes an account from the Telegram profile, no site needed; `/link` in the profile joins it with a site account.
- **Reminders** the day before and two hours before the start, with the score, who is missing and the weather.
- **Phone first**, with light and dark themes, keyboard navigation and screen reader labels.

### What the bot posts

```text
⚽ Вторничный футбол
📅 вт, 27 октября · 20:00
📍 Стадион «Динамо», поле 2

👥 7 из 10  ▰▰▰▰▰▰▰▱▱▱
✅ Точно: Ильдар Сафин, Артём (от Ильдар Сафин), Мария Котова, …
🤔 Возможно: Глеб Орлов, Руслан (от Тимур Ахмедов)
Нужно ещё 3
[ ✅ Иду ] [ 🤔 Возможно ] [ ❌ Не иду ]
[ ➕ Друг ] [ 🔗 Открыть ]
```

## Stack

| Part                             | Technology                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Web app (`apps/web`)             | React 19, React Router 8, TanStack Query 5, Tailwind CSS 4, Motion, Vite 8                                                 |
| API (`apps/server`)              | Fastify 5, TypeBox, Mongoose 9, pino                                                                                       |
| Shared types (`packages/shared`) | TypeBox schemas used by the API and the app                                                                                |
| Telegram                         | [`@dirai/tg-kit`](https://www.npmjs.com/package/@dirai/tg-kit) on grammY ([source](https://github.com/DiRaiks/tg-bot-kit)) |
| Tests                            | Vitest, Testing Library, in-memory MongoDB                                                                                 |

## Getting started

Requires Node.js 24+ and npm 11.21+ (older npm versions produce a lockfile that `npm ci` rejects), plus MongoDB.

```bash
npm install
cp .env.example .env    # set MONGO_URI and JWT_SECRET
npm run dev             # API on http://localhost:3000, reloads on changes
npm run dev:web         # app on http://localhost:5173
```

A local MongoDB is one command away: `docker run --rm -p 27017:27017 mongo:8`.

The app calls the API under `/v1` on the same origin. Vite proxies it in development; in production the reverse proxy routes `/v1` to the server. Set `VITE_API_URL` to use another origin.

## Configuration

Copy `.env.example` to `.env`.

| Variable                                                           | Required | Description                                                                                                |
| ------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`                                                        | yes      | Any MongoDB connection string: Atlas (`mongodb+srv://…`) or self-hosted (`mongodb://mongo:27017/football`) |
| `JWT_SECRET`                                                       | yes      | At least 32 characters, e.g. `openssl rand -base64 48`                                                     |
| `PORT`                                                             |          | API port, `3000` by default                                                                                |
| `BOT_TOKEN`                                                        |          | Telegram bot token; notifications are off without it                                                       |
| `BOT_MODE`                                                         |          | `polling` (development) or `webhook` (production)                                                          |
| `BOT_WEBHOOK_URL`, `BOT_WEBHOOK_SECRET`                            |          | Public HTTPS URL of the API and a random secret, for webhook mode                                          |
| `TELEGRAM_ADMIN_IDS`                                               |          | Telegram user ids allowed to run admin bot commands                                                        |
| `PUBLIC_URL`                                                       |          | Site URL for links in bot messages                                                                         |
| `CORS_ORIGINS`                                                     |          | Allowed origins if the app is served from another origin                                                   |
| `TRUST_PROXY`                                                      |          | Proxy hops (usually `1`) or proxy IPs when running behind a reverse proxy                                  |
| `TIME_ZONE`                                                        | `UTC`    | IANA time zone of the venues, e.g. `Europe/Moscow`: match times are entered in it                          |
| `WEATHER_DEFAULT_LAT`, `WEATHER_DEFAULT_LON`                       |          | Weather location for matches without coordinates                                                           |
| `JWT_EXPIRES_IN`, `AUTH_RATE_LIMIT_MAX`, `LOG_LEVEL`, `LOG_FORMAT` |          | Session length, login attempts per minute, logging                                                         |

### Admins

Admins can edit and delete any match and sign-up:

```bash
npm run set-role --workspace apps/server -- user@example.com admin
```

The script reads `MONGO_URI` from `.env` and signs the user out everywhere so the new role applies at once.

### Match start times

Every match stores the date and time entered for the venue, and the instant it starts (`startsAt`) in `TIME_ZONE`, used for sorting and reminders. Matches saved by older versions get it from a one-off migration, which also tidies free-text dates and times (`03.11.2026`, `20.00`):

```bash
npm run build --workspace apps/server
npm run migrate-dates --workspace apps/server -- --dry-run   # what would change
npm run migrate-dates --workspace apps/server                # apply
```

Matches it cannot read are listed; fix them in the app and run it again. After changing `TIME_ZONE`, `-- --all` recomputes every match.

## Deployment

Each push to `main` builds Docker images and, once a server is configured, deploys them with Docker Compose behind Caddy (automatic HTTPS). See [deploy/README.md](deploy/README.md).

## Project layout

```text
apps/
  server/    Fastify API and Telegram bot
  web/       React app
packages/
  shared/    API schemas and types
deploy/      production compose file, Caddy config, deployment guide
docs/        screenshots
```

## Tests

```bash
npm test     # API, shared types and web app
npm run lint
npm run types
```

API tests start an in-memory MongoDB and drive the server through HTTP, including the Telegram bot against a fake Telegram API. Web tests render screens with Testing Library against a fake API.

End-to-end tests run the production build of the web app against the real API on an in-memory MongoDB, on a desktop and a phone screen: sign up, create a match, join and leave it, sign out, plus an accessibility check with axe. Lighthouse checks the public pages:

```bash
npx playwright install chromium                     # once
npm run build --workspace football-planner-web
npm run test:e2e --workspace football-planner-web
npm run lighthouse --workspace football-planner-web # reports in apps/web/lighthouse-report
```

## Monitoring

`GET /health` reports the API, its database and the Telegram bot (polling or webhook state, the subscriptions store, the send queue). It answers 200 while the process runs; `status` is `degraded` when the database is down or the bot cannot receive updates. The route is public, so Telegram's error texts stay in the logs, and it is rate limited. `GET /metrics` serves Prometheus metrics: request durations by route, the MongoDB connection, Node.js process metrics, and the bot's `tg_*` metrics from [tg-kit](https://github.com/DiRaiks/tg-bot-kit): updates received, handler failures, commands, messages sent or failed, and the notifier queue. Caddy does not expose `/metrics` publicly; scrape it inside the Docker network.

## License

[MIT](LICENSE)
