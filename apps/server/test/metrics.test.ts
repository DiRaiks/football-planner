import { describe, expect, it } from 'vitest';

import { createEvent, register, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

describe('metrics', () => {
  it('serves Prometheus metrics with requests by route pattern', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(ctx.app, auth);
    await ctx.app.inject({ url: `/v1/events/${event._id}`, headers: auth });

    const response = await ctx.app.inject({ url: '/metrics' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    const text = response.body;
    expect(text).toContain('mongodb_connected 1');
    expect(text).toContain('process_cpu_user_seconds_total');
    expect(text).toMatch(
      /http_request_duration_seconds_count\{method="GET",route="\/v1\/events\/:id",status="200"\} 1/,
    );
    // Ids never become labels
    expect(text).not.toContain(event._id);
  });
});
