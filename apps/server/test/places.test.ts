import { describe, expect, it } from 'vitest';

import { createEvent, register, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

const north = { lat: 59.94, lon: 30.31, name: 'Санкт-Петербург' };
const south = { lat: 45.04, lon: 38.98, name: 'Краснодар' };

describe('saved places', () => {
  it('suggests places of the past year, the most played first', async () => {
    const { auth } = await register(ctx.app);
    await createEvent(ctx.app, auth, { place: 'Манеж', date: '2026-10-01' });
    await createEvent(ctx.app, auth, {
      place: 'Арена',
      date: '2026-10-02',
      location: south,
    });
    await createEvent(ctx.app, auth, {
      place: 'манеж ',
      date: '2026-10-08',
      location: north,
    });
    await createEvent(ctx.app, auth, { place: 'Манеж', date: '2026-10-15' });
    // Too long ago to suggest
    await createEvent(ctx.app, auth, {
      place: 'Старое поле',
      date: '2024-05-01',
    });

    const res = await ctx.app.inject({
      url: '/v1/events/places',
      headers: auth,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      // The latest spelling, and the latest city known for the place
      { place: 'Манеж', location: north },
      { place: 'Арена', location: south },
    ]);
  });

  it('needs a signed-in user', async () => {
    const res = await ctx.app.inject({ url: '/v1/events/places' });
    expect(res.statusCode).toBe(401);
  });
});
