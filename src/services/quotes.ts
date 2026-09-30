import type { ISODate } from '@/models';

/** The base set, always available. */
const CORE_QUOTES = [
  'Discipline today creates the freedom tomorrow.',
  'Discipline is the bridge between goals and reality.',
  'Consistency today compounds into freedom.',
  'Harder days create a stronger you.',
  'A more disciplined you is always within reach.',
  'Small steps. Massive change.',
  'You do not rise to your goals. You fall to your standards.',
  'The work you avoid is the work that changes you.',
];

/** Unlocked at 500 XP through the rewards track. */
const BONUS_QUOTES = [
  'Momentum is built in the hours nobody applauds.',
  'The summit is only the proof. The climb is the point.',
  'Comfort is the tax you pay on an unlived life.',
  'Win the morning and the day stops arguing.',
  'Every secured day is a vote for who you are becoming.',
  'Cold mornings build warm futures.',
];

function hashDate(iso: ISODate): number {
  let hash = 0;
  for (let i = 0; i < iso.length; i += 1) {
    hash = (hash * 31 + iso.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Stable per day, so the quote never changes while the screen is open. */
export function quoteForDate(date: ISODate, includeBonus = false, offset = 0): string {
  const pool = includeBonus ? [...CORE_QUOTES, ...BONUS_QUOTES] : CORE_QUOTES;
  return pool[(hashDate(date) + offset) % pool.length];
}

export function celebrationQuote(date: ISODate, includeBonus = false): string {
  return quoteForDate(date, includeBonus, 3);
}

export function allQuotes(includeBonus: boolean): string[] {
  return includeBonus ? [...CORE_QUOTES, ...BONUS_QUOTES] : CORE_QUOTES;
}
