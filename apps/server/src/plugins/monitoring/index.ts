import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ops } from '@dirai-kit/fastify/ops';
import { ping } from '@dirai-kit/pg';
import { Gauge } from '@prometheus-io/client';

/**
 * /health and /metrics on one registry (`fastify.ops.registry`), which the bot's
 * metrics join too
 */
const monitoringPlugin: FastifyPluginAsync = async (fastify) => {
  const databaseConnected = () => ping(fastify.sqlClient);

  // Always 200 while the process runs: a Telegram outage should not restart the
  // container; the status says what is wrong
  await fastify.register(ops, {
    health: async () => {
      const dbState = (await databaseConnected())
        ? 'connected'
        : 'disconnected';
      // Without BOT_TOKEN there is no bot to check
      const report = fastify.hasDecorator('tgHealth')
        ? await fastify.tgHealth.check()
        : null;
      // The route is public: Telegram's error text and the webhook host stay in the logs
      const telegram = report && {
        ...report,
        webhook: report.webhook && {
          set: report.webhook.set,
          pendingUpdates: report.webhook.pendingUpdates,
          lastErrorAt: report.webhook.lastErrorAt,
        },
      };
      const degraded =
        dbState !== 'connected' || (report !== null && !report.ok);
      return { status: degraded ? 'degraded' : 'ok', dbState, telegram };
    },
  });

  new Gauge({
    name: 'database_connected',
    help: '1 while Postgres answers queries',
    registers: [fastify.ops.registry],
    async collect() {
      this.set((await databaseConnected()) ? 1 : 0);
    },
  });
};

export default fp(monitoringPlugin, {
  fastify: '5.x',
  name: 'monitoring',
  dependencies: ['database'],
});
