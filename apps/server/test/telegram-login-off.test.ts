import { describe, expect, it } from 'vitest';

import { setupApp } from './helpers.js';

// A separate file: each file runs one app on its own database
const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

describe('without Telegram login configured', () => {
  it('offers no Telegram login', async () => {
    expect(
      (await ctx.app.inject({ url: '/v1/auth/providers' })).json(),
    ).toEqual({ telegram: null, miniApp: false });
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/telegram',
      payload: { code: 'x', codeVerifier: 'v'.repeat(43) },
    });
    expect(response.json().code).toBe('TELEGRAM_DISABLED');
  });
});
