/**
 * Winter Arc domain checks.
 *
 * Exercises the pure calculation layer directly: date maths, pillar rules,
 * XP reconciliation, streaks, rank thresholds and milestone days. Run with
 * `npm run test:domain`.
 */
import {
  addDays,
  arcDayNumber,
  arcDayToDate,
  buildMonthGrid,
  daysBetween,
  formatLongDate,
  isValidISODate,
  parseTimeToMinutes,
  sleepDurationMinutes,
  toISODate,
} from '@/utils/date';
import { formatClock, formatCountdown, formatDuration } from '@/utils/format';
import { allPillarProgress, completedPillarCount, emptyDay, isDayComplete } from '@/domain/pillars';
import { FULL_DAY_XP, MILESTONE_XP, PILLAR_XP, reconcileDayXp, totalXp } from '@/domain/xp';
import { computeStreaks, dayStatusFor, summariseRange, historyToDate } from '@/domain/history';
import { arcPosition, isMilestoneDay, milestonesFor, pointOnRoute } from '@/domain/journey';
import { levelForXp, rankForXp, rewardsFor, LEVEL_THRESHOLDS } from '@/domain/rank';
import { defaultGoals } from '@/services/defaults';
import type { DayRecord, Goals, ISODate, XPTransaction } from '@/models';

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  check(name, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`);
}

const goals: Goals = { ...defaultGoals };

/** A day record with the given pillars satisfied. */
function dayWith(
  date: ISODate,
  opts: { workout?: boolean; meals?: number; sessions?: number; sleepMinutes?: number },
): DayRecord {
  const day = emptyDay(date);
  if (opts.workout) {
    day.workout = {
      id: 'w', date, mode: 'strength', title: 'Push Day', focus: 'Chest',
      exercises: [], elapsedSeconds: 0, runningSince: null, completed: true, completedAt: 1,
    };
  }
  day.meals = Array.from({ length: opts.meals ?? 0 }, (_, i) => ({
    id: `m${i}`, date, slot: 'breakfast' as const, title: 'Meal', items: '', note: '', time: '08:00',
    nutrition: { calories: 500, protein: 30, carbs: 50, fats: 15 },
    asset: null, completed: true, completedAt: 1,
  }));
  day.studySessions = Array.from({ length: opts.sessions ?? 0 }, (_, i) => ({
    id: `s${i}`, date, label: 'Session', targetMinutes: 50, seconds: 3000, completedAt: 1,
  }));
  if (opts.sleepMinutes) {
    day.sleep = {
      id: 'sl', date, bedTime: '22:30', wakeTime: '06:30',
      minutes: opts.sleepMinutes, quality: 4, note: '', loggedAt: 1,
    };
  }
  return day;
}

const fullDay = (date: ISODate) =>
  dayWith(date, { workout: true, meals: 3, sessions: 2, sleepMinutes: 480 });

console.log('\nWinter Arc domain checks\n');

/* ------------------------------------------------------------------ Dates */

console.log('Dates');
eq('toISODate uses local time', toISODate(new Date(2025, 0, 14, 23, 30)), '2025-01-14');
eq('toISODate at midnight', toISODate(new Date(2025, 0, 14, 0, 0)), '2025-01-14');
eq('addDays crosses a month', addDays('2025-01-31', 1), '2025-02-01');
eq('addDays crosses a year', addDays('2024-12-31', 1), '2025-01-01');
eq('addDays handles a leap day', addDays('2024-02-28', 1), '2024-02-29');
eq('addDays backwards', addDays('2025-03-01', -1), '2025-02-28');
eq('daysBetween is inclusive of direction', daysBetween('2025-01-01', '2025-01-15'), 14);
eq('daysBetween across a DST spring forward', daysBetween('2025-03-08', '2025-03-10'), 2);
eq('daysBetween across a DST fall back', daysBetween('2025-11-01', '2025-11-03'), 2);
eq('daysBetween is negative going back', daysBetween('2025-01-15', '2025-01-01'), -14);
eq('arcDayNumber starts at 1', arcDayNumber('2025-01-03', '2025-01-03'), 1);
eq('arcDayNumber on day 12', arcDayNumber('2025-01-03', '2025-01-14'), 12);
eq('arcDayNumber before the start', arcDayNumber('2025-01-03', '2025-01-01'), -1);
eq('arcDayToDate round-trips', arcDayToDate('2025-01-03', 12), '2025-01-14');
eq('arcDayToDate for day 90', arcDayToDate('2025-01-01', 90), '2025-03-31');
check('isValidISODate rejects nonsense', !isValidISODate('2025-02-30'));
check('isValidISODate rejects a bad shape', !isValidISODate('14/01/2025'));
check('isValidISODate accepts a real day', isValidISODate('2024-02-29'));
eq('formatLongDate', formatLongDate('2025-01-14'), 'Tue, Jan 14, 2025');
eq('month grid is six weeks', buildMonthGrid(2025, 0).length, 42);
eq('month grid starts on a Sunday', buildMonthGrid(2025, 0)[0].date, '2024-12-29');

console.log('Clock');
eq('parseTimeToMinutes', parseTimeToMinutes('22:30'), 1350);
eq('parseTimeToMinutes rejects 24:00', parseTimeToMinutes('24:00'), null);
eq('parseTimeToMinutes rejects junk', parseTimeToMinutes('abc'), null);
eq('sleep across midnight', sleepDurationMinutes('22:30', '06:30'), 480);
eq('sleep within one day', sleepDurationMinutes('01:00', '09:00'), 480);
eq('sleep with equal times is a full day', sleepDurationMinutes('22:00', '22:00'), 1440);
eq('sleep of seven and a half hours', sleepDurationMinutes('23:00', '06:30'), 450);
eq('formatDuration', formatDuration(480), '8h 00m');
eq('formatDuration part hour', formatDuration(450), '7h 30m');
eq('formatClock', formatClock(2712), '00:45:12');
eq('formatCountdown', formatCountdown(3000), '50:00');
eq('formatCountdown rounds up', formatCountdown(59.4), '01:00');

/* ---------------------------------------------------------------- Pillars */

console.log('Pillars');
const emptyToday = emptyDay('2025-01-14');
eq('an empty day completes nothing', completedPillarCount(emptyToday, goals), 0);
check('an empty day is not complete', !isDayComplete(emptyToday, goals));
eq('a full day completes four', completedPillarCount(fullDay('2025-01-14'), goals), 4);
check('a full day is complete', isDayComplete(fullDay('2025-01-14'), goals));

const twoMeals = dayWith('2025-01-14', { meals: 2 });
eq('two of three meals is not enough', completedPillarCount(twoMeals, goals), 0);
const threeMeals = dayWith('2025-01-14', { meals: 3 });
eq('three of three meals counts', completedPillarCount(threeMeals, goals), 1);

const shortSleep = dayWith('2025-01-14', { sleepMinutes: 420 });
eq('sleep under target does not count', completedPillarCount(shortSleep, goals), 0);
const overSleep = dayWith('2025-01-14', { sleepMinutes: 540 });
eq('sleep over target counts', completedPillarCount(overSleep, goals), 1);

const lowerGoals: Goals = { ...goals, mealsPerDay: 2 };
eq('lowering the meal goal completes the pillar', completedPillarCount(twoMeals, lowerGoals), 1);

const progress = allPillarProgress(fullDay('2025-01-14'), goals);
eq('four pillars are reported', progress.length, 4);
check('every pillar carries its XP value', progress.every((p) => p.xp === PILLAR_XP));

/* --------------------------------------------------------------------- XP */

console.log('XP');
let ledger: XPTransaction[] = [];
const d1 = '2025-01-14';

const r1 = reconcileDayXp(ledger, d1, fullDay(d1), goals);
ledger = r1.ledger;
eq('a full day awards four pillars plus the bonus', totalXp(ledger), PILLAR_XP * 4 + FULL_DAY_XP);
eq('gained matches the award', r1.gained, PILLAR_XP * 4 + FULL_DAY_XP);
eq('five ledger rows', ledger.length, 5);

const r2 = reconcileDayXp(ledger, d1, fullDay(d1), goals);
eq('reconciling again changes nothing', r2.changed, false);
eq('reconciling again awards nothing', r2.gained, 0);
eq('XP is unchanged', totalXp(r2.ledger), PILLAR_XP * 4 + FULL_DAY_XP);

// Running it ten more times must not inflate the total.
let repeat = r2.ledger;
for (let i = 0; i < 10; i += 1) repeat = reconcileDayXp(repeat, d1, fullDay(d1), goals).ledger;
eq('ten more reconciles cannot duplicate XP', totalXp(repeat), PILLAR_XP * 4 + FULL_DAY_XP);
eq('the ledger is still five rows', repeat.length, 5);
check('every ledger id is unique', new Set(repeat.map((t) => t.id)).size === repeat.length);

const undone = dayWith(d1, { workout: true, meals: 3, sessions: 2, sleepMinutes: 420 });
const r3 = reconcileDayXp(repeat, d1, undone, goals);
eq('losing sleep withdraws its XP and the bonus', totalXp(r3.ledger), PILLAR_XP * 3);
eq('the ledger shrinks to three rows', r3.ledger.length, 3);

const r4 = reconcileDayXp(r3.ledger, d1, fullDay(d1), goals);
eq('restoring sleep restores the exact total', totalXp(r4.ledger), PILLAR_XP * 4 + FULL_DAY_XP);

const r5 = reconcileDayXp([], '2025-04-02', fullDay('2025-04-02'), goals, { isMilestoneDay: true });
eq('a milestone day adds its bonus', totalXp(r5.ledger), PILLAR_XP * 4 + FULL_DAY_XP + MILESTONE_XP);

const r6 = reconcileDayXp([], d1, undefined, goals);
eq('a missing day earns nothing', totalXp(r6.ledger), 0);

// A partial day must not attract the full-day bonus.
const r7 = reconcileDayXp([], d1, dayWith(d1, { workout: true, meals: 3 }), goals);
eq('a partial day earns only its pillars', totalXp(r7.ledger), PILLAR_XP * 2);

/* ---------------------------------------------------------------- Streaks */

console.log('Streaks');
const start = '2025-01-01';
const today = '2025-01-10';

function ctxFrom(pattern: boolean[], todayDate = today) {
  const days: Record<ISODate, DayRecord> = {};
  pattern.forEach((complete, i) => {
    const date = addDays(start, i);
    days[date] = complete ? fullDay(date) : emptyDay(date);
  });
  return { days, goals, startDate: start, today: todayDate, ledger: [] };
}

const allTen = ctxFrom(Array(10).fill(true));
eq('ten secured days is a ten day streak', computeStreaks(allTen).current, 10);
eq('longest matches', computeStreaks(allTen).longest, 10);
check('today is secured', computeStreaks(allTen).todaySecured);

const brokenMiddle = ctxFrom([true, true, true, false, true, true, true, true, true, true]);
eq('a gap resets the current streak', computeStreaks(brokenMiddle).current, 6);
eq('longest survives the gap', computeStreaks(brokenMiddle).longest, 6);

const openToday = ctxFrom([true, true, true, true, true, true, true, true, true, false]);
eq('an unfinished today measures to yesterday', computeStreaks(openToday).current, 9);
check('today is not secured', !computeStreaks(openToday).todaySecured);

const missedYesterday = ctxFrom([true, true, true, true, true, true, true, true, false, false]);
eq('a missed yesterday zeroes the streak', computeStreaks(missedYesterday).current, 0);
eq('longest is still remembered', computeStreaks(missedYesterday).longest, 8);

eq('no history means no streak', computeStreaks(ctxFrom([])).current, 0);

const longestEarly = ctxFrom([true, true, true, true, true, false, true, true, false, false]);
eq('longest comes from the earlier run', computeStreaks(longestEarly).longest, 5);

/* ------------------------------------------------------------ Day statuses */

console.log('Day status');
eq('a future day', dayStatusFor('2025-01-20', '2025-01-10', 0, start), 'future');
eq('a day before the arc', dayStatusFor('2024-12-20', '2025-01-10', 0, start), 'future');
eq('today, in progress', dayStatusFor('2025-01-10', '2025-01-10', 2, start), 'today');
eq('today, secured', dayStatusFor('2025-01-10', '2025-01-10', 4, start), 'complete');
eq('a past secured day', dayStatusFor('2025-01-05', '2025-01-10', 4, start), 'complete');
eq('a past partial day', dayStatusFor('2025-01-05', '2025-01-10', 2, start), 'partial');
eq('a past missed day', dayStatusFor('2025-01-05', '2025-01-10', 0, start), 'missed');

const summary = summariseRange(historyToDate(brokenMiddle));
eq('summary counts elapsed days', summary.days, 10);
eq('summary counts secured days', summary.completedDays, 9);
eq('summary counts missed days', summary.missedDays, 1);
eq('consistency is nine in ten', Math.round(summary.consistency * 100), 90);
eq('completion rate matches', Math.round(summary.completionRate * 100), 90);

/* ------------------------------------------------------------- Milestones */

console.log('Journey');
eq('day one of the arc', arcPosition('2025-01-01', '2025-01-01').dayNumber, 1);
eq('day ninety of the arc', arcPosition('2025-01-01', '2025-03-31').dayNumber, 90);
check('day ninety is not finished', !arcPosition('2025-01-01', '2025-03-31').finished);
check('day ninety-one is finished', arcPosition('2025-01-01', '2025-04-01').finished);
eq('progress on day one', Math.round(arcPosition('2025-01-01', '2025-01-01').progress * 100), 0);
eq('progress on day ninety-one is capped', arcPosition('2025-01-01', '2025-06-01').progress, 1);
eq('display day is clamped', arcPosition('2025-01-01', '2025-06-01').displayDay, 90);
eq('days remaining on day one', arcPosition('2025-01-01', '2025-01-01').daysRemaining, 90);
eq('days remaining on day ninety', arcPosition('2025-01-01', '2025-03-31').daysRemaining, 1);

check('day 30 is a milestone', isMilestoneDay('2025-01-01', arcDayToDate('2025-01-01', 30)));
check('day 60 is a milestone', isMilestoneDay('2025-01-01', arcDayToDate('2025-01-01', 60)));
check('day 90 is a milestone', isMilestoneDay('2025-01-01', arcDayToDate('2025-01-01', 90)));
check('day 29 is not', !isMilestoneDay('2025-01-01', arcDayToDate('2025-01-01', 29)));
check('day 61 is not', !isMilestoneDay('2025-01-01', arcDayToDate('2025-01-01', 61)));

const ms = milestonesFor('2025-01-01', arcDayToDate('2025-01-01', 45));
eq('day 30 is reached by day 45', ms[0].reached, true);
eq('day 60 is not reached by day 45', ms[1].reached, false);
eq('milestone 30 lands on the right date', ms[0].date, '2025-01-30');
eq('milestone 90 lands on the right date', ms[2].date, '2025-03-31');

const p0 = pointOnRoute(0);
const p1 = pointOnRoute(1);
check('the route starts low on the image', p0.y > 90, `y=${p0.y}`);
check('the route ends high on the image', p1.y < 15, `y=${p1.y}`);
check('the route stays inside the frame', [p0, p1].every((p) => p.x >= 0 && p.x <= 100));
check('route progress moves upward', pointOnRoute(0.5).y < p0.y && pointOnRoute(0.5).y > p1.y);

/* -------------------------------------------------------------------- Rank */

console.log('Rank');
eq('zero XP is level one', levelForXp(0), 1);
eq('just under the level two gate', levelForXp(LEVEL_THRESHOLDS[1] - 1), 1);
eq('exactly on the level two gate', levelForXp(LEVEL_THRESHOLDS[1]), 2);
eq('400 XP is level two', levelForXp(400), 2);
eq('huge XP is capped at max level', levelForXp(10_000_000), LEVEL_THRESHOLDS.length);

const rank400 = rankForXp(400);
eq('rank names the first tier', rank400.tier.name, 'Ice Seeker');
eq('next level gate is 600', rank400.nextLevelXp, 600);
eq('progress within level two', Math.round(rank400.progress * 100), 50);

const maxRank = rankForXp(10_000_000);
eq('max level has no next gate', maxRank.nextLevelXp, null);
eq('max level progress is full', maxRank.progress, 1);
eq('max level is the last tier', maxRank.tier.name, 'Winter Legend');

eq('negative XP is treated as zero', rankForXp(-50).xp, 0);
eq('negative XP is level one', rankForXp(-50).level, 1);

const rewardsAtZero = rewardsFor(0);
check('no rewards at zero XP', rewardsAtZero.every((r) => !r.unlocked));
const rewardsAt600 = rewardsFor(600);
check('the 500 XP reward unlocks', rewardsAt600.find((r) => r.id === 'quote-pack')?.unlocked === true);
check('the level 3 reward unlocks at 600 XP', rewardsAt600.find((r) => r.id === 'theme-pack')?.unlocked === true);
check('the level 5 reward is still locked', rewardsAt600.find((r) => r.id === 'profile-frame')?.unlocked === false);

/* ----------------------------------------------------- A full 90-day arc */

console.log('Full arc');
const arcStart = '2025-01-01';
const arcDays: Record<ISODate, DayRecord> = {};
let arcLedger: XPTransaction[] = [];
for (let i = 1; i <= 90; i += 1) {
  const date = arcDayToDate(arcStart, i);
  arcDays[date] = fullDay(date);
  arcLedger = reconcileDayXp(arcLedger, date, arcDays[date], goals, {
    isMilestoneDay: isMilestoneDay(arcStart, date),
  }).ledger;
}
const arcCtx = { days: arcDays, goals, startDate: arcStart, today: arcDayToDate(arcStart, 90), ledger: arcLedger };
eq('ninety perfect days is a ninety day streak', computeStreaks(arcCtx).current, 90);
eq(
  'ninety perfect days earns the expected XP',
  totalXp(arcLedger),
  90 * (PILLAR_XP * 4 + FULL_DAY_XP) + 3 * MILESTONE_XP,
);
eq('a perfect arc reaches the top tier', rankForXp(totalXp(arcLedger)).tier.name, 'Winter Legend');
eq('the arc summary covers ninety days', summariseRange(historyToDate(arcCtx)).days, 90);
eq('consistency is perfect', summariseRange(historyToDate(arcCtx)).consistency, 1);

/* ------------------------------------------------------------------ Report */

console.log('\n=====================================');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failures.length}`);
console.log('=====================================\n');
if (failures.length > 0) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
