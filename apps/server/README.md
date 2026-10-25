# server

Fastify API (`/v1`) and the Telegram bot. See the [repository README](../../README.md) for configuration and the [deployment guide](../../deploy/README.md).

The server speaks plain HTTP; TLS terminates at the reverse proxy (Caddy in production).

## Tests

```bash
npm test
```

Vitest with an in-memory MongoDB; the bot is tested against a fake Telegram API.
