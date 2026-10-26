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
- **Weekly matches.** Mark a match as weekly, and once it starts the same match a week later is created and announced in the chat.
- **Teams.** The organiser splits the squad into 2–4 random teams in one tap, guests included; the bot posts them to the chat. Pressing again reshuffles.
- **Payments.** Set a price per person, and the organiser ticks who paid; a player pays for the sure friends they bring. The roster shows what is collected out of the total.
- **Attendance.** Who played how often over the last month, three months or year, with "maybe" sign-ups and the last match played.
- **Log in with Telegram**, on the site or inside Telegram as a Mini App, with no password: the same account as the bot's buttons.
- **Installs on the phone** as an app (PWA), and the match list opens offline.
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
| API (`apps/server`)              | Fastify 5, TypeBox, Postgres with Drizzle ORM, pino                                                                        |
| Shared types (`packages/shared`) | TypeBox schemas used by the API and the app                                                                                |
| Telegram                         | [`@dirai/tg-kit`](https://www.npmjs.com/package/@dirai/tg-kit) on grammY ([source](https://github.com/DiRaiks/tg-bot-kit)) |
| Tests                            | Vitest, Testing Library, PGlite (Postgres in memory)                                                                       |

## Getting started

Requires Node.js 24+ and npm 11.21+ (older npm versions produce a lockfile that `npm ci` rejects), plus Postgres.

```bash
npm install
cp .env.example .env    # set DATABASE_URL and JWT_SECRET
npm run dev             # API on http://localhost:3000, reloads on changes
npm run dev:web         # app on http://localhost:5173
```

A local Postgres is one command away: `docker run --rm -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:18.6-alpine`, with `DATABASE_URL=postgres://postgres:pw@localhost:5432/postgres`. The server creates and updates its tables on startup (SQL migrations in `apps/server/drizzle`).

The app calls the API under `/v1` on the same origin. Vite proxies it in development; in production the reverse proxy routes `/v1` to the server. Set `VITE_API_URL` to use another origin.

## Configuration

Copy `.env.example` to `.env`.

| Variable                                                           | Required | Description                                                                                         |
| ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                     | yes      | Postgres connection string, e.g. `postgres://user:password@localhost:5432/football`                 |
| `JWT_SECRET`                                                       | yes      | At least 32 characters, e.g. `openssl rand -base64 48`                                              |
| `PORT`                                                             |          | API port, `3000` by default                                                                         |
| `BOT_TOKEN`                                                        |          | Telegram bot token; notifications are off without it                                                |
| `BOT_MODE`                                                         |          | `polling` (development) or `webhook` (production)                                                   |
| `BOT_WEBHOOK_URL`, `BOT_WEBHOOK_SECRET`                            |          | Public HTTPS URL of the API and a random secret, for webhook mode                                   |
| `TELEGRAM_ADMIN_IDS`                                               |          | Telegram user ids allowed to run admin bot commands                                                 |
| `PUBLIC_URL`                                                       |          | Site URL for links in bot messages                                                                  |
| `TELEGRAM_LOGIN_CLIENT_ID`, `TELEGRAM_LOGIN_CLIENT_SECRET`         |          | "Log in with Telegram" on the site, from @BotFather (see below)                                     |
| `TELEGRAM_APP_URL`                                                 |          | Mini App link, e.g. `https://t.me/<bot>/<app>`: "Открыть" under announcements opens the match there |
| `CORS_ORIGINS`                                                     |          | Allowed origins if the app is served from another origin                                            |
| `TRUST_PROXY`                                                      |          | Proxy hops (usually `1`) or proxy IPs when running behind a reverse proxy                           |
| `TIME_ZONE`                                                        | `UTC`    | IANA time zone of the venues, e.g. `Europe/Moscow`: match times are entered in it                   |
| `WEATHER_DEFAULT_LAT`, `WEATHER_DEFAULT_LON`                       |          | Weather location for matches without coordinates                                                    |
| `JWT_EXPIRES_IN`, `AUTH_RATE_LIMIT_MAX`, `LOG_LEVEL`, `LOG_FORMAT` |          | Session length, login attempts per minute, logging                                                  |

### Telegram login and Mini App

Players can sign in without a password, as the same account the bot's buttons make:

- **On the site:** in @BotFather, in the bot's Login Widget settings, register `<PUBLIC_URL>/auth/telegram` as a redirect URI, and put the Client ID and Client Secret into `TELEGRAM_LOGIN_CLIENT_ID` and `TELEGRAM_LOGIN_CLIENT_SECRET`. The site then shows "Войти через Telegram". It is OpenID Connect with PKCE: the server trades the code for an ID token and checks its signature against Telegram's keys.
- **Inside Telegram:** with `BOT_TOKEN` and an HTTPS `PUBLIC_URL`, the bot's menu button in private chats opens the site as a Mini App, signed in from the data Telegram signs with the bot token. To open matches from group announcements, create a Mini App for `PUBLIC_URL` in @BotFather (`/newapp`, or _Configure Mini App_ for the main one) and set `TELEGRAM_APP_URL` to its link; "Открыть" then opens that match in it.

### Admins

Admins can edit and delete any match and sign-up:

```bash
npm run set-role --workspace apps/server -- user@example.com admin
```

The script reads `DATABASE_URL` from `.env` and signs the user out everywhere so the new role applies at once.

### Match start times

Every match stores the date and time entered for the venue, and the instant it starts (`startsAt`) in `TIME_ZONE`, used for sorting and reminders.

### Moving from MongoDB

Versions before Postgres kept their data in MongoDB. `MONGO_URI` is no longer read: the server refuses to start with only `MONGO_URI` set. `npm run migrate-from-mongo --workspace apps/server -- --dry-run` reads `MONGO_URI` and reports what it would copy; without `--dry-run` it copies users, matches, sign-ups and the bot's chats into `DATABASE_URL`, keeping their ids. It also fills the start time of matches saved before `startsAt` existed, which the former `migrate-dates` script did. It runs once, into an empty database, before the new server takes requests. Steps for production: [deploy/README.md](deploy/README.md#moving-from-mongodb).

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

API tests start Postgres in memory (PGlite) and drive the server through HTTP, including the Telegram bot against a fake Telegram API. With `TEST_DATABASE_URL` (e.g. `postgres://postgres:pw@localhost:5432/postgres`) they run on that Postgres server instead, each test file in a fresh database. Web tests render screens with Testing Library against a fake API.

End-to-end tests run the production build of the web app against the real API on Postgres in memory, on a desktop and a phone screen: sign up, create a match, join and leave it, sign out, plus an accessibility check with axe. Lighthouse checks the public pages:

```bash
npx playwright install chromium                     # once
npm run build --workspace football-planner-web
npm run test:e2e --workspace football-planner-web
npm run lighthouse --workspace football-planner-web # reports in apps/web/lighthouse-report
```

## Monitoring

`GET /health` reports the API, its database and the Telegram bot (polling or webhook state, the subscriptions store, the send queue). It answers 200 while the process runs; `status` is `degraded` when the database is down or the bot cannot receive updates. The route is public, so Telegram's error texts stay in the logs, and it is rate limited. `GET /metrics` serves Prometheus metrics: request durations by route, whether the database answers (`database_connected`), Node.js process metrics, and the bot's `tg_*` metrics from [tg-kit](https://github.com/DiRaiks/tg-bot-kit): updates received, handler failures, commands, messages sent or failed, and the notifier queue. Caddy does not expose `/metrics` publicly; scrape it inside the Docker network.

## License

[MIT](LICENSE)
