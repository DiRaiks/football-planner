import { describe, expect, it } from 'vitest';

import { setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 2 });

describe('auth rate limit', () => {
  it('returns 429 after too many login attempts', async () => {
    const attempt = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'x@example.com', password: 'whatever' },
      });

    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(429);
  });
});
