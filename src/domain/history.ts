import type {
  DailyHistoryEntry,
  DayRecord,
  DayStatus,
  Goals,
  ISODate,
  PillarKey,
  XPTransaction,
} from '@/models';
import { PILLARS } from '@/models';
import { addDays, compareISO, daysBetween } from '@/utils/date';
import { completedPillarCount, pillarFlags } from './pillars';
import { xpByDate } from './xp';

export interface HistoryContext {
  days: Record<ISODate, DayRecord>;
  goals: Goals;
  startDate: ISODate;
  today: ISODate;
  ledger: XPTransaction[];
}

export function dayStatusFor(
  date: ISODate,
  today: ISODate,
  completed: number,
  startDate: ISODate,
): DayStatus {
  if (compareISO(date, startDate) < 0) return 'future';
  const delta = daysBetween(today, date);
  if (delta > 0) return 'future';
  if (completed === PILLARS.length) return 'complete';
  // A day still in progress is never "missed" - only elapsed days can be.
  if (delta === 0) return 'today';
  if (completed > 0) return 'partial';
  return 'missed';
}

export function historyEntry(date: ISODate, ctx: HistoryContext, xpMap?: Map<ISODate, number>): DailyHistoryEntry {
  const day = ctx.days[date];
  const completed = completedPillarCount(day, ctx.goals);
  const map = xpMap ?? xpByDate(ctx.ledger);
  return {
    date,
    dayNumber: daysBetween(ctx.startDate, date) + 1,
    status: dayStatusFor(date, ctx.today, completed, ctx.startDate),
    completedPillars: completed,
    pillars: pillarFlags(day, ctx.goals),
    xp: map.get(date) ?? 0,
  };
}

/** History for an inclusive date range. */
export function historyRange(from: ISODate, to: ISODate, ctx: HistoryContext): DailyHistoryEntry[] {
  const out: DailyHistoryEntry[] = [];
  const xpMap = xpByDate(ctx.ledger);
  const span = daysBetween(from, to);
  if (span < 0) return out;
  for (let i = 0; i <= span; i += 1) {
    out.push(historyEntry(addDays(from, i), ctx, xpMap));
  }
  return out;
}

/** Every elapsed day of the arc up to and including today. */
export function historyToDate(ctx: HistoryContext): DailyHistoryEntry[] {
  if (compareISO(ctx.today, ctx.startDate) < 0) return [];
  return historyRange(ctx.startDate, ctx.today, ctx);
}

/* ---------------------------------------------------------------- Streaks */

export interface StreakSummary {
  current: number;
  longest: number;
  /** True when today is already secured, so the streak is safe. */
  todaySecured: boolean;
}

/**
 * Streaks are always derived from history, never incremented. The current
 * streak counts back from today; a day still in progress does not break it,
 * so an unfinished today simply means the streak is measured to yesterday.
 */
export function computeStreaks(ctx: HistoryContext): StreakSummary {
  const entries = historyToDate(ctx);
  if (entries.length === 0) return { current: 0, longest: 0, todaySecured: false };

  let longest = 0;
  let run = 0;
  for (const entry of entries) {
    if (entry.completedPillars === PILLARS.length) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  const last = entries[entries.length - 1];
  const todaySecured = last.completedPillars === PILLARS.length;

  let current = 0;
  const startIndex = todaySecured ? entries.length - 1 : entries.length - 2;
  for (let i = startIndex; i >= 0; i -= 1) {
    if (entries[i].completedPillars === PILLARS.length) current += 1;
    else break;
  }

  return { current, longest, todaySecured };
}

/* --------------------------------------------------------------- Rollups */

export interface PillarRate {
  key: PillarKey;
  rate: number;
  completedDays: number;
}

export interface RangeSummary {
  entries: DailyHistoryEntry[];
  days: number;
  /** Share of days that were fully secured. */
  consistency: number;
  /** Average share of the four pillars completed per day. */
  completionRate: number;
  completedDays: number;
  partialDays: number;
  missedDays: number;
  totalSessions: number;
  totalXp: number;
  pillarRates: PillarRate[];
}

export function summariseRange(entries: DailyHistoryEntry[]): RangeSummary {
  const elapsed = entries.filter((e) => e.status !== 'future');
  const days = elapsed.length;
  const completedDays = elapsed.filter((e) => e.completedPillars === PILLARS.length).length;
  const partialDays = elapsed.filter(
    (e) => e.completedPillars > 0 && e.completedPillars < PILLARS.length,
  ).length;
  const missedDays = elapsed.filter((e) => e.completedPillars === 0 && e.status === 'missed').length;
  const totalSessions = elapsed.reduce((sum, e) => sum + e.completedPillars, 0);
  const totalXp = elapsed.reduce((sum, e) => sum + e.xp, 0);

  const pillarRates: PillarRate[] = PILLARS.map((key) => {
    const hits = elapsed.filter((e) => e.pillars[key]).length;
    return { key, rate: days ? hits / days : 0, completedDays: hits };
  });

  return {
    entries,
    days,
    consistency: days ? completedDays / days : 0,
    completionRate: days ? totalSessions / (days * PILLARS.length) : 0,
    completedDays,
    partialDays,
    missedDays,
    totalSessions,
    totalXp,
    pillarRates,
  };
}

/** Compare a range against the equally long window immediately before it. */
export function trendAgainstPrevious(
  ctx: HistoryContext,
  windowDays: number,
): { current: RangeSummary; previous: RangeSummary; consistencyDelta: number; sessionsDelta: number } {
  const to = ctx.today;
  const from = addDays(to, -(windowDays - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(windowDays - 1));

  const clampStart = (d: ISODate) => (compareISO(d, ctx.startDate) < 0 ? ctx.startDate : d);

  const current = summariseRange(historyRange(clampStart(from), to, ctx));
  const previous =
    compareISO(prevTo, ctx.startDate) < 0
      ? summariseRange([])
      : summariseRange(historyRange(clampStart(prevFrom), prevTo, ctx));

  return {
    current,
    previous,
    consistencyDelta: (current.consistency - previous.consistency) * 100,
    sessionsDelta: current.totalSessions - previous.totalSessions,
  };
}
