/** Whether the runtime knows the IANA time zone, e.g. Europe/Moscow */
export const isTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

/** The calendar day of an instant in a time zone, e.g. 2026-11-03 */
export const zonedDay = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

/** Offset of the zone from UTC at `instant`, in ms */
const zoneOffset = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
};

/**
 * The instant of a wall-clock date and time in a time zone:
 * 2026-11-03 + 20:00 in Europe/Moscow is 2026-11-03T17:00:00Z.
 * Null when the date or time is not valid.
 */
export const zonedToInstant = (
  date: string,
  time: string,
  timeZone: string,
): Date | null => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!day || !clock) return null;
  const [year, month, dayOfMonth] = day.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const guess = Date.UTC(
    year,
    month - 1,
    dayOfMonth,
    Number(clock[1]),
    Number(clock[2]),
  );
  // Reject 2026-02-30 and the like, which Date.UTC silently rolls over
  if (new Date(guess).getUTCDate() !== dayOfMonth) return null;

  // Two passes settle the offset around daylight saving transitions
  let instant = guess - zoneOffset(guess, timeZone);
  instant = guess - zoneOffset(instant, timeZone);
  return new Date(instant);
};
