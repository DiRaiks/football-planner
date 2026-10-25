const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  timeZone: 'UTC',
});

/** Parses an event day (YYYY-MM-DD) as a UTC date, independent of the device time zone */
export const parseDay = (date: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};

/** "вт, 3 ноября" */
export const formatDay = (date: string) => {
  const day = parseDay(date);
  return day ? dayFormat.format(day) : date;
};

/** Parts for the date block of an event card: "3", "нояб.", "вт" */
export const dayParts = (date: string) => {
  const day = parseDay(date);
  if (!day) return null;
  return {
    day: String(day.getUTCDate()),
    month: monthFormat.format(day).replace('.', ''),
    weekday: weekdayFormat.format(day),
  };
};

/** Today in the device time zone as YYYY-MM-DD */
export const todayIso = (now = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** "игрок", "игрока", "игроков" */
export const plural = (
  n: number,
  [one, few, many]: [string, string, string],
) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

export const PLAYERS: [string, string, string] = ['игрок', 'игрока', 'игроков'];
