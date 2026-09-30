import type { ISODate } from '@/models';

/** Number of days in a Winter Arc. */
export const ARC_LENGTH = 90;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day for a Date, as YYYY-MM-DD. Never uses UTC. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today in the device's local timezone. */
export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** Parse an ISO day into a local Date at midnight. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISODate(iso);
  return !Number.isNaN(d.getTime()) && toISODate(d) === iso;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole calendar days from `a` to `b`. Timezone- and DST-safe. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const da = fromISODate(a);
  const db = fromISODate(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 1-based Winter Arc day number for `date`. Days before the start are <= 0. */
export function arcDayNumber(startDate: ISODate, date: ISODate): number {
  return daysBetween(startDate, date) + 1;
}

/** The calendar day on which a given arc day falls. */
export function arcDayToDate(startDate: ISODate, dayNumber: number): ISODate {
  return addDays(startDate, dayNumber - 1);
}

/** Every day of the arc. */
export function arcDates(startDate: ISODate): ISODate[] {
  return Array.from({ length: ARC_LENGTH }, (_, i) => addDays(startDate, i));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const weekdayNames = WEEKDAYS;

/** "Tue, Jan 14, 2025" */
export function formatLongDate(iso: ISODate): string {
  const d = fromISODate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Jan 14" */
export function formatShortDate(iso: ISODate): string {
  const d = fromISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "January 2025" */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

/** "Jan 2025" */
export function formatMonthYearShort(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function relativeDayLabel(iso: ISODate, today: ISODate): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return formatShortDate(iso);
}

/* ----------------------------------------------------------------- Clock */

/** Minutes past midnight for "HH:mm". Returns null when unparseable. */
export function parseTimeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

/** "22:30" becomes "10:30 PM" */
export function formatTime12h(time: string): string {
  const mins = parseTimeToMinutes(time);
  if (mins === null) return time;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/**
 * Sleep duration in minutes between a bed time and a wake time.
 * A wake time at or before the bed time is treated as the next morning.
 */
export function sleepDurationMinutes(bedTime: string, wakeTime: string): number {
  const bed = parseTimeToMinutes(bedTime);
  const wake = parseTimeToMinutes(wakeTime);
  if (bed === null || wake === null) return 0;
  const diff = wake - bed;
  return diff > 0 ? diff : diff + 1440;
}

/* -------------------------------------------------------------- Calendar */

export interface CalendarCell {
  date: ISODate;
  day: number;
  inMonth: boolean;
}

/** A 6x7 grid of cells for a month, starting on Sunday. */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const cells: CalendarCell[] = [];
  const cursor = new Date(year, month, 1 - startOffset);
  for (let i = 0; i < 42; i += 1) {
    cells.push({
      date: toISODate(cursor),
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === month,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

/** Milliseconds until the next local midnight, used to roll the day over. */
export function msUntilMidnight(from: Date = new Date()): number {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 0, 0, 2, 0);
  return Math.max(1000, next.getTime() - from.getTime());
}

export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Still up.';
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  return 'Good evening.';
}
