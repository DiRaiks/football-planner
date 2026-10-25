import { describe, expect, it } from 'vitest';

import { countPlayers } from '../src/modules/players/count.js';

describe('countPlayers', () => {
  it('counts players and friends by status', () => {
    expect(
      countPlayers([
        { status: true, friends: [{ name: 'a', status: false }] },
        {
          status: false,
          friends: [
            { name: 'b', status: true },
            { name: 'c', status: true },
          ],
        },
      ]),
    ).toEqual({ all: 5, exactly: 3, maybe: 2 });
  });

  it('handles an empty list', () => {
    expect(countPlayers([])).toEqual({ all: 0, exactly: 0, maybe: 0 });
  });
});
