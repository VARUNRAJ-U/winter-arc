import type { ISODate, Milestone } from '@/models';
import { ARC_LENGTH, arcDayNumber, arcDayToDate } from '@/utils/date';
import { clamp } from '@/utils/format';

export interface MilestoneDefinition {
  day: number;
  title: string;
  description: string;
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  { day: 30, title: 'Stronger Habits', description: 'The routine stops being a decision.' },
  { day: 60, title: 'Unstoppable', description: 'Discipline is now your baseline.' },
  { day: 90, title: 'A New You', description: 'The arc is closed. The standard remains.' },
];

export const MILESTONE_DAYS = MILESTONE_DEFINITIONS.map((m) => m.day);

export function isMilestoneDay(startDate: ISODate, date: ISODate): boolean {
  return MILESTONE_DAYS.includes(arcDayNumber(startDate, date));
}

export interface ArcPosition {
  /** 1-based day of the arc. Can exceed ARC_LENGTH once the arc is finished. */
  dayNumber: number;
  /** Day number clamped into the arc, for display. */
  displayDay: number;
  daysRemaining: number;
  progress: number;
  started: boolean;
  finished: boolean;
}

export function arcPosition(startDate: ISODate, today: ISODate): ArcPosition {
  const dayNumber = arcDayNumber(startDate, today);
  const displayDay = clamp(dayNumber, 1, ARC_LENGTH);
  return {
    dayNumber,
    displayDay,
    daysRemaining: Math.max(0, ARC_LENGTH - dayNumber + 1),
    progress: clamp((dayNumber - 1) / ARC_LENGTH, 0, 1),
    started: dayNumber >= 1,
    finished: dayNumber > ARC_LENGTH,
  };
}

export function milestonesFor(startDate: ISODate, today: ISODate): Milestone[] {
  const current = arcDayNumber(startDate, today);
  return MILESTONE_DEFINITIONS.map((def) => ({
    day: def.day,
    title: def.title,
    description: def.description,
    reached: current >= def.day,
    date: arcDayToDate(startDate, def.day),
  }));
}

export function nextMilestone(startDate: ISODate, today: ISODate): Milestone | null {
  return milestonesFor(startDate, today).find((m) => !m.reached) ?? null;
}

/**
 * The switchback route baked into the journey artwork, sampled from the
 * image itself. Nothing is drawn along it: the artwork already carries the
 * glowing trail, so the app only places markers on top of it. Units are
 * percentages of the image box, ordered from the start to the summit.
 */
const ROUTE: { x: number; y: number }[] = [
  { x: 88, y: 98 },
  { x: 86, y: 88 },
  { x: 78, y: 79 },
  { x: 60, y: 73 },
  { x: 41, y: 68 },
  { x: 36, y: 60 },
  { x: 48, y: 53 },
  { x: 58, y: 46 },
  { x: 50, y: 40 },
  { x: 44, y: 33 },
  { x: 56, y: 25 },
  { x: 52, y: 17 },
  { x: 50, y: 11 },
];

/** Cumulative arc length, so progress moves at a steady visual speed. */
const ROUTE_LENGTHS = (() => {
  const out = [0];
  for (let i = 1; i < ROUTE.length; i += 1) {
    const dx = ROUTE[i].x - ROUTE[i - 1].x;
    const dy = ROUTE[i].y - ROUTE[i - 1].y;
    out.push(out[i - 1] + Math.hypot(dx, dy));
  }
  return out;
})();

const ROUTE_TOTAL = ROUTE_LENGTHS[ROUTE_LENGTHS.length - 1];

/** The point on the route at a given 0..1 progress along the arc. */
export function pointOnRoute(progress: number): { x: number; y: number } {
  const t = clamp(progress, 0, 1) * ROUTE_TOTAL;
  for (let i = 1; i < ROUTE.length; i += 1) {
    if (t <= ROUTE_LENGTHS[i] || i === ROUTE.length - 1) {
      const span = ROUTE_LENGTHS[i] - ROUTE_LENGTHS[i - 1] || 1;
      const local = clamp((t - ROUTE_LENGTHS[i - 1]) / span, 0, 1);
      return {
        x: ROUTE[i - 1].x + (ROUTE[i].x - ROUTE[i - 1].x) * local,
        y: ROUTE[i - 1].y + (ROUTE[i].y - ROUTE[i - 1].y) * local,
      };
    }
  }
  return ROUTE[ROUTE.length - 1];
}

/** Milestone pins sit exactly on the route, at their share of the arc. */
export const MILESTONE_ANCHORS: Record<number, { x: number; y: number }> =
  Object.fromEntries(
    MILESTONE_DEFINITIONS.map((m) => [m.day, pointOnRoute(m.day / ARC_LENGTH)]),
  );
