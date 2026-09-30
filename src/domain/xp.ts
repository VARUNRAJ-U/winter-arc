import type { DayRecord, Goals, ISODate, PillarKey, XPSource, XPTransaction } from '@/models';
import { PILLARS } from '@/models';
import { pillarCompletion } from './pillars';

/** XP awarded for completing one pillar. */
export const PILLAR_XP = 50;
/** Bonus awarded once, on the day every pillar is completed. */
export const FULL_DAY_XP = 200;
/** Bonus awarded once when an arc milestone day is completed. */
export const MILESTONE_XP = 250;

export const XP_LABELS: Record<XPSource, string> = {
  workout: 'Workout complete',
  diet: 'Nutrition complete',
  studies: 'Studies complete',
  sleep: 'Sleep complete',
  day: 'Full day secured',
  milestone: 'Milestone reached',
};

/** Deterministic ledger key. One transaction can exist per day and source. */
export function xpKey(date: ISODate, source: XPSource): string {
  return `${date}:${source}`;
}

export interface LedgerReconciliation {
  ledger: XPTransaction[];
  changed: boolean;
  gained: number;
}

/**
 * Rebuild the XP entries for a single day from that day's records.
 *
 * XP is never incremented imperatively. Instead the ledger is reconciled
 * against the facts: a pillar that is complete has exactly one transaction,
 * and a pillar that stops being complete loses its transaction. That makes
 * duplicate XP structurally impossible and keeps the ledger auditable.
 */
export function reconcileDayXp(
  ledger: XPTransaction[],
  date: ISODate,
  day: DayRecord | undefined,
  goals: Goals,
  options: { isMilestoneDay?: boolean } = {},
): LedgerReconciliation {
  const existing = new Map(ledger.filter((t) => t.date === date).map((t) => [t.source, t]));
  const desired = new Map<XPSource, number>();

  let completeCount = 0;
  for (const key of PILLARS) {
    const progress = pillarCompletion(key as PillarKey, day, goals);
    if (progress.complete) {
      completeCount += 1;
      desired.set(key, PILLAR_XP);
    }
  }

  const fullDay = completeCount === PILLARS.length;
  if (fullDay) {
    desired.set('day', FULL_DAY_XP);
    if (options.isMilestoneDay) desired.set('milestone', MILESTONE_XP);
  }

  let changed = false;
  let gained = 0;

  // Drop transactions that are no longer earned.
  for (const [source] of existing) {
    if (!desired.has(source)) changed = true;
  }
  // Add transactions that are newly earned.
  for (const [source, amount] of desired) {
    const prev = existing.get(source);
    if (!prev) {
      changed = true;
      gained += amount;
    } else if (prev.amount !== amount) {
      changed = true;
      gained += amount - prev.amount;
    }
  }

  if (!changed) return { ledger, changed: false, gained: 0 };

  const now = Date.now();
  const others = ledger.filter((t) => t.date !== date);
  const rebuilt: XPTransaction[] = [];
  for (const [source, amount] of desired) {
    const prev = existing.get(source);
    rebuilt.push({
      id: xpKey(date, source),
      date,
      source,
      amount,
      label: XP_LABELS[source],
      awardedAt: prev?.awardedAt ?? now,
    });
  }

  return {
    ledger: [...others, ...rebuilt].sort(
      (a, b) => a.date.localeCompare(b.date) || a.awardedAt - b.awardedAt,
    ),
    changed: true,
    gained,
  };
}

export function totalXp(ledger: XPTransaction[]): number {
  return ledger.reduce((sum, t) => sum + t.amount, 0);
}

export function xpForDate(ledger: XPTransaction[], date: ISODate): number {
  return ledger.reduce((sum, t) => (t.date === date ? sum + t.amount : sum), 0);
}

export function xpByDate(ledger: XPTransaction[]): Map<ISODate, number> {
  const map = new Map<ISODate, number>();
  for (const t of ledger) map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
  return map;
}

/** The most recent transactions, newest first, for the XP history view. */
export function recentTransactions(ledger: XPTransaction[], limit = 30): XPTransaction[] {
  return [...ledger].sort((a, b) => b.awardedAt - a.awardedAt || b.date.localeCompare(a.date)).slice(0, limit);
}
