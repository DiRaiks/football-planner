/**
 * Normalises match dates and times saved by older versions of the app, which accepted
 * free text, into the YYYY-MM-DD and HH:MM forms the API takes now. Used by
 * scripts/migrate-dates.mjs.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** YYYY-MM-DD, or null when the text is not a recognisable date */
export const normalizeDate = (value: string): string | null => {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/.exec(text);
  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : dotted
      ? [Number(dotted[3]), Number(dotted[2]), Number(dotted[1])]
      : [NaN, NaN, NaN];
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** HH:MM, or null when the text is not a recognisable time: 20:00, 9.30, 20-00, 20 */
export const normalizeTime = (value: string): string | null => {
  const match = /^(\d{1,2})(?:[:.\-h ](\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
};
