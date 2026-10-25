import { describe, expect, it } from 'vitest';

import { computeRoster, countPlayers } from '../src/modules/players/count.js';

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
    ).toEqual({ all: 5, exactly: 3, maybe: 2, waiting: 0 });
  });

  it('handles an empty list', () => {
    expect(countPlayers([])).toEqual({
      all: 0,
      exactly: 0,
      maybe: 0,
      waiting: 0,
    });
  });
});

describe('computeRoster', () => {
  const player = (id: string, status: boolean, friends: boolean[] = []) => ({
    _id: id,
    name: `P${id}`,
    status,
    friends: friends.map((sure, i) => ({ name: `F${id}.${i}`, status: sure })),
  });

  it('gives places in sign-up order and puts the rest in line', () => {
    const roster = computeRoster(
      [
        player('1', true, [true]),
        player('2', false),
        player('3', true),
        player('4', true),
      ],
      3,
    );
    expect(roster.count).toEqual({ all: 5, exactly: 3, maybe: 1, waiting: 1 });
    expect([...roster.waitlisted]).toEqual(['4']);
    expect(roster.people.map((p) => `${p.name}:${p.place}`)).toEqual([
      'P1:squad',
      'F1.0:squad',
      'P2:maybe',
      'P3:squad',
      'P4:waiting',
    ]);
  });

  it('puts a friend in line while their player has a place', () => {
    const roster = computeRoster([player('1', true, [true, true])], 2);
    expect(roster.count).toMatchObject({ exactly: 2, waiting: 1 });
    expect(roster.waitlisted.size).toBe(0);
    expect(roster.people.at(-1)).toEqual({
      key: '1:1',
      name: 'F1.1',
      from: 'P1',
      place: 'waiting',
    });
  });

  it('has no line without a limit', () => {
    expect(
      computeRoster([player('1', true), player('2', true)], 0).count.waiting,
    ).toBe(0);
  });
});
