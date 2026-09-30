import type { DayRecord, Goals, Nutrition, PillarKey, PillarProgress } from '@/models';
import { PILLARS } from '@/models';
import { formatDuration } from '@/utils/format';
import { PILLAR_XP } from './xp';

export const PILLAR_LABELS: Record<PillarKey, string> = {
  workout: 'Workout',
  diet: 'Diet',
  studies: 'Studies',
  sleep: 'Sleep',
};

export const PILLAR_TAGLINES: Record<PillarKey, string> = {
  workout: 'Build a Stronger Body',
  diet: 'Fuel Your Potential',
  studies: 'Sharpen Your Mind',
  sleep: 'Recover. Reset. Dominate.',
};

export const PILLAR_COLOR_VAR: Record<PillarKey, string> = {
  workout: 'var(--pillar-workout)',
  diet: 'var(--pillar-diet)',
  studies: 'var(--pillar-studies)',
  sleep: 'var(--pillar-sleep)',
};

export const emptyDay = (date: string): DayRecord => ({
  date,
  workout: null,
  meals: [],
  studySessions: [],
  sleep: null,
  note: '',
  celebratedAt: null,
});

/* ------------------------------------------------------------ Derivations */

export function completedMeals(day: DayRecord | undefined): number {
  return day?.meals.filter((m) => m.completed).length ?? 0;
}

export function completedStudySessions(day: DayRecord | undefined): number {
  return day?.studySessions.length ?? 0;
}

export function studyMinutes(day: DayRecord | undefined): number {
  return Math.round((day?.studySessions.reduce((s, x) => s + x.seconds, 0) ?? 0) / 60);
}

export function sleepMinutes(day: DayRecord | undefined): number {
  return day?.sleep?.minutes ?? 0;
}

export function workoutsCompleted(day: DayRecord | undefined): number {
  return day?.workout?.completed ? 1 : 0;
}

export function dayNutrition(day: DayRecord | undefined): Nutrition {
  const total: Nutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  for (const meal of day?.meals ?? []) {
    if (!meal.completed) continue;
    total.calories += meal.nutrition.calories;
    total.protein += meal.nutrition.protein;
    total.carbs += meal.nutrition.carbs;
    total.fats += meal.nutrition.fats;
  }
  return total;
}

/** Nutrition totals including meals that are planned but not yet eaten. */
export function plannedNutrition(day: DayRecord | undefined): Nutrition {
  const total: Nutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  for (const meal of day?.meals ?? []) {
    total.calories += meal.nutrition.calories;
    total.protein += meal.nutrition.protein;
    total.carbs += meal.nutrition.carbs;
    total.fats += meal.nutrition.fats;
  }
  return total;
}

/**
 * Progress for one pillar on one day. This is the single place that decides
 * what "complete" means; every screen, the XP ledger and the calendar all
 * read from it, so they can never disagree.
 */
export function pillarCompletion(
  key: PillarKey,
  day: DayRecord | undefined,
  goals: Goals,
): PillarProgress {
  switch (key) {
    case 'workout': {
      // One session per day; the record holds a single workout.
      const target = 1;
      const current = workoutsCompleted(day);
      const inProgress = !!day?.workout && !day.workout.completed;
      return {
        key,
        label: PILLAR_LABELS.workout,
        current,
        target,
        complete: current >= target,
        detail:
          current >= target
            ? `${day?.workout?.title ?? 'Workout'} completed`
            : inProgress
              ? `${day?.workout?.title ?? 'Session'} in progress`
              : 'Not started',
        xp: PILLAR_XP,
      };
    }
    case 'diet': {
      const target = Math.max(1, goals.mealsPerDay);
      const current = completedMeals(day);
      return {
        key,
        label: PILLAR_LABELS.diet,
        current,
        target,
        complete: current >= target,
        detail: `${current}/${target} meals completed`,
        xp: PILLAR_XP,
      };
    }
    case 'studies': {
      const target = Math.max(1, goals.studySessionsPerDay);
      const current = completedStudySessions(day);
      return {
        key,
        label: PILLAR_LABELS.studies,
        current,
        target,
        complete: current >= target,
        detail: `${current}/${target} focus sessions`,
        xp: PILLAR_XP,
      };
    }
    case 'sleep': {
      const targetMinutes = Math.round(Math.max(1, goals.sleepTargetHours) * 60);
      const current = sleepMinutes(day);
      const logged = !!day?.sleep;
      return {
        key,
        label: PILLAR_LABELS.sleep,
        current,
        target: targetMinutes,
        complete: logged && current >= targetMinutes,
        detail: logged
          ? `${formatDuration(current)} logged`
          : 'In progress',
        xp: PILLAR_XP,
      };
    }
    default: {
      const exhaustive: never = key;
      throw new Error(`Unknown pillar: ${String(exhaustive)}`);
    }
  }
}

export function allPillarProgress(day: DayRecord | undefined, goals: Goals): PillarProgress[] {
  return PILLARS.map((key) => pillarCompletion(key, day, goals));
}

export function completedPillarCount(day: DayRecord | undefined, goals: Goals): number {
  return allPillarProgress(day, goals).filter((p) => p.complete).length;
}

export function pillarFlags(day: DayRecord | undefined, goals: Goals): Record<PillarKey, boolean> {
  const out = {} as Record<PillarKey, boolean>;
  for (const p of allPillarProgress(day, goals)) out[p.key] = p.complete;
  return out;
}

export function isDayComplete(day: DayRecord | undefined, goals: Goals): boolean {
  return completedPillarCount(day, goals) === PILLARS.length;
}
