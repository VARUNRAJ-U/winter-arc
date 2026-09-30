import { useMemo } from 'react';
import { useAppStore } from './appStore';
import type { DayRecord, ISODate, PillarProgress, RankState } from '@/models';
import {
  allPillarProgress,
  completedPillarCount,
  dayNutrition,
  emptyDay,
  plannedNutrition,
} from '@/domain/pillars';
import { rankForXp, rewardsFor } from '@/domain/rank';
import { totalXp, xpForDate } from '@/domain/xp';
import {
  computeStreaks,
  historyToDate,
  summariseRange,
  trendAgainstPrevious,
  type HistoryContext,
  type RangeSummary,
  type StreakSummary,
} from '@/domain/history';
import { arcPosition, milestonesFor, nextMilestone, type ArcPosition } from '@/domain/journey';
import { todayISO } from '@/utils/date';

/* The start date falls back to today so every selector stays safe during the
   brief window before onboarding completes. */
export function useStartDate(): ISODate {
  const start = useAppStore((s) => s.profile?.startDate);
  const today = useAppStore((s) => s.today);
  return start ?? today ?? todayISO();
}

export function useHistoryContext(): HistoryContext {
  const days = useAppStore((s) => s.days);
  const goals = useAppStore((s) => s.goals);
  const ledger = useAppStore((s) => s.xpLedger);
  const today = useAppStore((s) => s.today);
  const startDate = useStartDate();
  return useMemo(
    () => ({ days, goals, ledger, today, startDate }),
    [days, goals, ledger, today, startDate],
  );
}

export function useDay(date: ISODate): DayRecord {
  const day = useAppStore((s) => s.days[date]);
  return useMemo(() => day ?? emptyDay(date), [day, date]);
}

export function useToday(): ISODate {
  return useAppStore((s) => s.today);
}

export function usePillars(date: ISODate): PillarProgress[] {
  const day = useAppStore((s) => s.days[date]);
  const goals = useAppStore((s) => s.goals);
  return useMemo(() => allPillarProgress(day, goals), [day, goals]);
}

export function useCompletedPillarCount(date: ISODate): number {
  const day = useAppStore((s) => s.days[date]);
  const goals = useAppStore((s) => s.goals);
  return useMemo(() => completedPillarCount(day, goals), [day, goals]);
}

export function useTotalXp(): number {
  const ledger = useAppStore((s) => s.xpLedger);
  return useMemo(() => totalXp(ledger), [ledger]);
}

export function useDayXp(date: ISODate): number {
  const ledger = useAppStore((s) => s.xpLedger);
  return useMemo(() => xpForDate(ledger, date), [ledger, date]);
}

export function useRank(): RankState {
  const xp = useTotalXp();
  return useMemo(() => rankForXp(xp), [xp]);
}

export function useRewards() {
  const xp = useTotalXp();
  return useMemo(() => rewardsFor(xp), [xp]);
}

export function useStreaks(): StreakSummary {
  const ctx = useHistoryContext();
  return useMemo(() => computeStreaks(ctx), [ctx]);
}

export function useArcPosition(): ArcPosition {
  const startDate = useStartDate();
  const today = useToday();
  return useMemo(() => arcPosition(startDate, today), [startDate, today]);
}

export function useMilestones() {
  const startDate = useStartDate();
  const today = useToday();
  return useMemo(() => milestonesFor(startDate, today), [startDate, today]);
}

export function useNextMilestone() {
  const startDate = useStartDate();
  const today = useToday();
  return useMemo(() => nextMilestone(startDate, today), [startDate, today]);
}

export function useRangeSummary(windowDays: number | 'all'): {
  summary: RangeSummary;
  consistencyDelta: number | null;
  sessionsDelta: number | null;
} {
  const ctx = useHistoryContext();
  return useMemo(() => {
    if (windowDays === 'all') {
      const summary = summariseRange(historyToDate(ctx));
      return { summary, consistencyDelta: null, sessionsDelta: null };
    }
    const trend = trendAgainstPrevious(ctx, windowDays);
    // With nothing before this window there is no honest comparison to make.
    const comparable = trend.previous.days > 0;
    return {
      summary: trend.current,
      consistencyDelta: comparable ? trend.consistencyDelta : null,
      sessionsDelta: comparable ? trend.sessionsDelta : null,
    };
  }, [ctx, windowDays]);
}

export function useNutrition(date: ISODate) {
  const day = useAppStore((s) => s.days[date]);
  return useMemo(
    () => ({ consumed: dayNutrition(day), planned: plannedNutrition(day) }),
    [day],
  );
}

export function useQuoteUnlocked(): boolean {
  const xp = useTotalXp();
  return xp >= 500;
}
