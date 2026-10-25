import { describe, expect, it } from 'vitest';

import { missingText } from '@/features/events/Scoreboard';
import { countPeople } from '@/features/players/api';
import { rosterGroups } from '@/features/players/Roster';
import { weatherIcon } from '@/features/weather/WeatherBadge';
import {
  dayParts,
  formatDay,
  parseDay,
  plural,
  PLAYERS,
  todayIso,
} from '@/lib/format';
import { CloudRain, CloudSnow, Sun } from '@phosphor-icons/react';
import { ApiError, shouldRetry } from '@/lib/api';
import { player } from './helpers';

describe('format', () => {
  it('formats event days independently of the time zone', () => {
    expect(formatDay('2026-11-03')).toBe('вт, 3 ноября');
    expect(dayParts('2026-12-31')).toEqual({
      day: '31',
      month: 'дек',
      weekday: 'чт',
    });
    expect(parseDay('03.11.2026')).toBeNull();
    expect(formatDay('not a date')).toBe('not a date');
  });

  it('uses the local calendar day for today', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('declines Russian nouns', () => {
    expect(
      [1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, PLAYERS)),
    ).toEqual([
      'игрок',
      'игрока',
      'игроков',
      'игроков',
      'игроков',
      'игрок',
      'игрока',
      'игроков',
      'игроков',
    ]);
  });
});

describe('players', () => {
  const players = [
    player({
      _id: 'a',
      userId: 'u1',
      name: 'Андрей',
      status: true,
      friends: [{ name: 'Петя', status: false }],
    }),
    player({
      _id: 'b',
      userId: 'u2',
      name: 'Мария',
      status: false,
      friends: [{ name: 'Оля', status: true }],
    }),
  ];

  it('counts players and friends like the server', () => {
    expect(countPeople(players)).toEqual({
      all: 4,
      exactly: 2,
      maybe: 2,
      waiting: 0,
    });
    // With one place, the second sure person waits
    expect(countPeople(players, 1)).toEqual({
      all: 4,
      exactly: 1,
      maybe: 2,
      waiting: 1,
    });
  });

  it('groups the roster and marks the current user', () => {
    const { sure, maybe } = rosterGroups(players, 'u1');
    expect(sure.map((p) => [p.name, p.isMe, p.broughtBy])).toEqual([
      ['Андрей', true, undefined],
      ['Оля', false, 'Мария'],
    ]);
    expect(maybe.map((p) => p.name)).toEqual(['Петя', 'Мария']);
  });

  it('describes progress towards the minimum', () => {
    expect(missingText({ all: 6, exactly: 6, maybe: 0 }, 10)).toBe(
      'Нужно ещё 4 игрока',
    );
    expect(missingText({ all: 9, exactly: 9, maybe: 0 }, 10)).toBe(
      'Нужно ещё 1 игрок',
    );
    expect(missingText({ all: 12, exactly: 10, maybe: 2 }, 10)).toBe(
      'Минимум набран',
    );
    expect(missingText({ all: 3, exactly: 3, maybe: 0 }, 0)).toBeNull();
  });
});

describe('weather', () => {
  it('maps WMO codes to icons', () => {
    expect(weatherIcon(0)).toBe(Sun);
    expect(weatherIcon(63)).toBe(CloudRain);
    expect(weatherIcon(75)).toBe(CloudSnow);
  });
});

describe('shouldRetry', () => {
  it('does not retry answers that will not change', () => {
    expect(
      shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'event not found')),
    ).toBe(false);
    expect(shouldRetry(0, new ApiError(403, 'FORBIDDEN', 'forbidden'))).toBe(
      false,
    );
  });

  it('retries server and network failures twice', () => {
    const serverError = new ApiError(503, 'INTERNAL', 'unavailable');
    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetry(2, serverError)).toBe(false);
  });
});

describe('waitlist', () => {
  it('puts sure people beyond the places in line, in sign-up order', () => {
    const players = [
      player({
        _id: 'a',
        name: 'Аня',
        userId: 'u1',
        friends: [{ name: 'Гость', status: true }],
      }),
      player({ _id: 'b', name: 'Боря', userId: 'u2', status: false }),
      player({ _id: 'c', name: 'Вера', userId: 'u3' }),
    ];
    const { sure, maybe, waiting } = rosterGroups(players, 'u3', 2);
    expect(sure.map((p) => p.name)).toEqual(['Аня', 'Гость']);
    expect(maybe.map((p) => p.name)).toEqual(['Боря']);
    expect(waiting).toEqual([{ key: 'c', name: 'Вера', isMe: true }]);
  });
});
