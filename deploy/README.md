# Deployment

One VPS runs the whole stack with Docker Compose:

| Service                       | Image                                     | Role                                                                                                           |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `web`                         | `ghcr.io/<owner>/football-planner-web`    | Caddy with the built app: TLS certificates, the SPA, proxy of `/v1`, `/telegram/*` and `/health` to the server |
| `server`                      | `ghcr.io/<owner>/football-planner-server` | Fastify API and Telegram bot, plain HTTP inside the network, runs as `node`; applies database migrations first |
| `postgres`, `postgres-backup` | `postgres:18.6-alpine`                    | Optional (`COMPOSE_PROFILES=postgres`): local Postgres with a daily `pg_dump` to `./backups`                   |
| `mongo`, `mongo-backup`       | `mongo:8.0`                               | Legacy (`COMPOSE_PROFILES=postgres,mongo`): the MongoDB of older versions, only to move its data               |

When CI passes on `main`, the deploy workflow builds both images from that commit, tags them with its SHA and `latest`, and pushes them to GHCR. When the server is configured, the workflow uploads `compose.yml`, pulls the new images, restarts the stack and waits for both health checks. Until then the deploy job is skipped, so pushes stay green.

## First deployment

### 1. Server

A Linux VPS with 1 vCPU and 1-2 GB RAM is enough, a domain with an A record pointing to it, and Docker Engine with the compose plugin.

```bash
sudo usermod -aG docker <deploy-user>
sudo ufw allow 80,443/tcp            # if a firewall is enabled
sudo mkdir -p /opt/football-planner && sudo chown <deploy-user> /opt/football-planner
```

Create `/opt/football-planner/.env` from [`.env.example`](.env.example): at least `DOMAIN`, `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_URL`. For Postgres on the same host add `COMPOSE_PROFILES=postgres` and `POSTGRES_PASSWORD` (`openssl rand -hex 24`), and set `DATABASE_URL=postgres://football:<POSTGRES_PASSWORD>@postgres:5432/football`. For the Telegram bot add `BOT_TOKEN`, `BOT_WEBHOOK_URL` (same as `PUBLIC_URL`) and `BOT_WEBHOOK_SECRET` (`openssl rand -hex 32`).

A deploy key, created on your machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/football-planner-deploy -C football-planner-deploy
ssh-copy-id -i ~/.ssh/football-planner-deploy.pub <deploy-user>@<vps>
```

### 2. GitHub

Settings → Environments → **production**:

| Type   | Name          | Value                                        |
| ------ | ------------- | -------------------------------------------- |
| secret | `VPS_HOST`    | Server IP or host name                       |
| secret | `VPS_USER`    | `<deploy-user>`                              |
| secret | `VPS_SSH_KEY` | Private key `~/.ssh/football-planner-deploy` |
| secret | `VPS_PORT`    | Only if SSH is not on port 22                |

Settings → Secrets and variables → Actions → Variables → **Repository variables**:

| Type     | Name          | Value                                                       |
| -------- | ------------- | ----------------------------------------------------------- |
| variable | `DEPLOY_PATH` | `/opt/football-planner` (setting it enables the deploy job) |

`DEPLOY_PATH` has to be a repository variable: the deploy job is skipped by a job-level condition, which does not see the variables of an environment.

The server logs in to GHCR with the workflow's short-lived token; nothing else to register.

### 3. Run and check

```bash
gh workflow run deploy.yml --ref main
gh run watch
```

- The run reaches "server is healthy" and "web is healthy".
- `https://<DOMAIN>` opens the app; Caddy issued the certificate.
- `https://<DOMAIN>/health` returns `"status":"ok"` with `"dbState":"connected"` and, with a bot token, a `telegram` report with `"ok":true`.
- `https://<DOMAIN>/metrics` returns 404.
- With a bot token: the logs show "telegram webhook set", and `/subscribe` in a chat answers.

## Operations

```bash
cd /opt/football-planner
compose="docker compose --env-file .env --env-file images.env"
$compose ps
$compose logs -f server
```

**Rollback:** set `IMAGE_TAG=<sha of an earlier commit>` in `images.env`, then `$compose up -d`.

**Admin role:** `$compose exec server node scripts/set-role.mjs user@example.com admin` (uses the container's `DATABASE_URL`).

**Database migrations** run when the server starts, before it takes requests; a failed one stops the start, and the previous container keeps running until the health check passes. After a change to `apps/server/src/db/schema.ts`, `npm run db:generate --workspace apps/server` writes the next SQL file to `apps/server/drizzle/`; commit it with the change.

**Restore a backup** (local Postgres profile), with the server stopped:

```bash
$compose stop server
$compose exec -T postgres pg_restore -U football -d football --clean --if-exists < backups/football-<timestamp>.dump
$compose start server
```

## Moving from MongoDB

Versions before Postgres kept their data in MongoDB (`MONGO_URI`). The server no longer reads it, and refuses to start with only `MONGO_URI` set. `apps/server/scripts/migrate-from-mongo.mjs` copies users, matches, sign-ups and the bot's chats into Postgres:

- ids stay the same, so links to `/events/<id>` in old Telegram messages and signed-in sessions keep working;
- matches saved without a start time get one from their date and time in `TIME_ZONE`, with free-text dates such as `03.11.2026 20.00` normalised (this replaces the old `migrate-dates` script);
- chats saved by the first bot, without topics, get the `events` topic they used to receive;
- an account whose email (or Telegram id) repeats an earlier one, in any letter case, is not copied: its sign-ups move to the earlier account. A second next match of one weekly series stays, without the link to the series. Sign-ups of deleted matches or users are skipped. All of it is listed in the report;
- it can run again: rows already in Postgres stay as they are, only new ones are added. A row that clashes with a different row already in Postgres (the same email under another id) counts as already there, and its sign-ups are listed as skipped.

It needs the repository's dev dependencies, so it runs from a checkout in a one-off Node container on the stack's network. In a quiet hour:

1. Back up MongoDB: an Atlas snapshot, or `$compose exec -T mongo mongodump --archive --gzip > backups/before-postgres.archive.gz`.
2. In `.env`, keep `MONGO_URI` and add `POSTGRES_PASSWORD`, `DATABASE_URL=postgres://football:<POSTGRES_PASSWORD>@postgres:5432/football` and `COMPOSE_PROFILES=postgres` (`postgres,mongo` when MongoDB runs on this host). `TIME_ZONE` must be the venues' time zone.
3. Put the new `compose.yml` next to `.env` and start only Postgres; the running server is not touched:

   ```bash
   git clone --depth 1 https://github.com/DiRaiks/football-planner.git src
   cp src/deploy/compose.yml compose.yml
   $compose up -d postgres
   ```

4. Dry run: reads MongoDB, prints the counts and every problem, writes nothing:

   ```bash
   migrate="docker run --rm --network football-planner_default --env-file .env -v $PWD/src:/app -w /app node:24-alpine sh -c"
   $migrate 'npm ci --ignore-scripts && npm run migrate-from-mongo --workspace apps/server -- --dry-run'
   ```

   With MongoDB in this stack, `MONGO_URI` is `mongodb://mongo:27017/football`. Fix what the report lists in MongoDB if it matters, and run it again.

5. The real run: applies the migrations, then copies the data in one transaction and prints the same report:

   ```bash
   $migrate 'npm run migrate-from-mongo --workspace apps/server'
   ```

6. Deploy this version (merge, or `gh workflow run deploy.yml`). Then run step 5 once more: it adds what the old server saved in between (new accounts, matches and sign-ups; changes to rows already copied are not carried over).
7. Check the site and `/health`, then remove `MONGO_URI` from `.env`, drop `mongo` from `COMPOSE_PROFILES`, `$compose up -d --remove-orphans` and `rm -rf src`. The `mongo_data` volume and the MongoDB backups stay until you delete them.

## Testing the stack locally

Build the images and run the same compose file with `DOMAIN=localhost` (Caddy uses a local certificate authority):

```bash
docker build -f apps/server/Dockerfile -t local/football-planner-server:test .
docker build -f apps/web/Dockerfile -t local/football-planner-web:test .
printf 'IMAGE_REGISTRY=local\nIMAGE_TAG=test\n' > images.env
# .env: DOMAIN=localhost, COMPOSE_PROFILES=postgres, POSTGRES_PASSWORD=pw,
#       DATABASE_URL=postgres://football:pw@postgres:5432/football, JWT_SECRET=...
docker compose -f deploy/compose.yml --env-file .env --env-file images.env up -d
curl -k https://localhost/health
```
