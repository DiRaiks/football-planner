import type { PriceMode } from './schemas.js';

/**
 * What one person pays: the price itself, or the pitch shared by `squad` people and
 * rounded up to 10 roubles. null while nobody is in the squad to share it.
 */
export const shareOf = (
  price: number,
  mode: PriceMode | undefined,
  squad: number,
): number | null => {
  if (mode !== 'pitch') return price;
  if (squad <= 0) return null;
  return Math.ceil(price / squad / 10) * 10;
};
