# Deployment

One VPS runs the whole stack with Docker Compose:

| Service                 | Image                                     | Role                                                                                                           |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `web`                   | `ghcr.io/<owner>/football-planner-web`    | Caddy with the built app: TLS certificates, the SPA, proxy of `/v1`, `/telegram/*` and `/health` to the server |
| `server`                | `ghcr.io/<owner>/football-planner-server` | Fastify API and Telegram bot, plain HTTP inside the network, runs as `node`                                    |
| `mongo`, `mongo-backup` | `mongo:8.0`                               | Optional (`COMPOSE_PROFILES=mongo`): local MongoDB with daily gzip dumps to `./backups`                        |

Every push to `main` builds both images, tags them with the commit SHA and `latest`, and pushes them to GHCR. When the server is configured, the workflow uploads `compose.yml`, pulls the new images, restarts the stack and waits for both health checks. Until then the deploy job is skipped, so pushes stay green.

## First deployment

### 1. Server

A Linux VPS with 1 vCPU and 1-2 GB RAM is enough (more if MongoDB runs there too), a domain with an A record pointing to it, and Docker Engine with the compose plugin.

```bash
sudo usermod -aG docker <deploy-user>
sudo ufw allow 80,443/tcp            # if a firewall is enabled
sudo mkdir -p /opt/football-planner && sudo chown <deploy-user> /opt/football-planner
```

Create `/opt/football-planner/.env` from [`.env.example`](.env.example): at least `DOMAIN`, `MONGO_URI`, `JWT_SECRET`, `PUBLIC_URL`. For the Telegram bot add `BOT_TOKEN`, `BOT_WEBHOOK_URL` (same as `PUBLIC_URL`) and `BOT_WEBHOOK_SECRET` (`openssl rand -hex 32`).

A deploy key, created on your machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/football-planner-deploy -C football-planner-deploy
ssh-copy-id -i ~/.ssh/football-planner-deploy.pub <deploy-user>@<vps>
```

### 2. GitHub

Settings → Environments → **production**:

| Type     | Name          | Value                                                       |
| -------- | ------------- | ----------------------------------------------------------- |
| secret   | `VPS_HOST`    | Server IP or host name                                      |
| secret   | `VPS_USER`    | `<deploy-user>`                                             |
| secret   | `VPS_SSH_KEY` | Private key `~/.ssh/football-planner-deploy`                |
| secret   | `VPS_PORT`    | Only if SSH is not on port 22                               |
| variable | `DEPLOY_PATH` | `/opt/football-planner` (setting it enables the deploy job) |

The server logs in to GHCR with the workflow's short-lived token; nothing else to register.

### 3. Run and check

```bash
gh workflow run deploy.yml --ref main
gh run watch
```

- The run reaches "server is healthy" and "web is healthy".
- `https://<DOMAIN>` opens the app; Caddy issued the certificate.
- `https://<DOMAIN>/health` returns `{"status":"ok","dbState":"connected"}`.
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

**Start times of old matches** (once, after the first deploy of this version): `$compose exec server node scripts/migrate-dates.mjs --dry-run`, then without `--dry-run`. It uses the container's `MONGO_URI` and `TIME_ZONE`.

**Admin role:** `$compose exec server node scripts/set-role.mjs user@example.com admin` (uses the container's `MONGO_URI`).

**Restore a backup** (local MongoDB profile):

```bash
$compose exec -T mongo mongorestore --gzip --archive --drop < backups/football-<timestamp>.archive.gz
```

## Testing the stack locally

Build the images and run the same compose file with `DOMAIN=localhost` (Caddy uses a local certificate authority):

```bash
docker build -f apps/server/Dockerfile -t local/football-planner-server:test .
docker build -f apps/web/Dockerfile -t local/football-planner-web:test .
printf 'IMAGE_REGISTRY=local\nIMAGE_TAG=test\n' > images.env
# .env: DOMAIN=localhost, COMPOSE_PROFILES=mongo, MONGO_URI=mongodb://mongo:27017/football, JWT_SECRET=...
docker compose -f deploy/compose.yml --env-file .env --env-file images.env up -d
curl -k https://localhost/health
```
