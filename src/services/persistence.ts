import type { PersistedState } from '@/models';
import { getStorage } from './storage';
import { createInitialState, defaultGoals, defaultSettings, STATE_VERSION } from './defaults';
import { isValidISODate, todayISO } from '@/utils/date';

export const STORAGE_KEY = 'winter-arc:state:v1';

export type LoadResult =
  | { status: 'fresh'; state: PersistedState }
  | { status: 'loaded'; state: PersistedState }
  | { status: 'recovered'; state: PersistedState; reason: string };

/**
 * Read persisted state, repairing anything that does not match the current
 * shape. A corrupted blob never blocks the app: it is replaced by a fresh
 * state and the caller is told why, so the UI can surface it.
 */
export function loadState(): LoadResult {
  const storage = getStorage();
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'recovered', state: createInitialState(), reason: 'Storage could not be read.' };
  }

  if (!raw) return { status: 'fresh', state: createInitialState() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: 'recovered',
      state: createInitialState(),
      reason: 'Saved data was unreadable and has been reset.',
    };
  }

  const migrated = migrate(parsed);
  if (!migrated) {
    return {
      status: 'recovered',
      state: createInitialState(),
      reason: 'Saved data was in an unknown format and has been reset.',
    };
  }
  return { status: 'loaded', state: migrated };
}

/** Bring any earlier shape up to the current version, or return null. */
function migrate(input: unknown): PersistedState | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<PersistedState> & Record<string, unknown>;
  const base = createInitialState();

  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > STATE_VERSION) return null;

  const rawProfile = isObject(raw.profile) ? raw.profile : null;
  const rawStart = String(rawProfile?.startDate ?? '');
  const profile = rawProfile
    ? {
        name: String(rawProfile.name ?? 'Athlete').slice(0, 40),
        startDate: isValidISODate(rawStart) ? rawStart : todayISO(),
        createdAt: Number(rawProfile.createdAt) || Date.now(),
        avatarAsset: typeof rawProfile.avatarAsset === 'string' ? rawProfile.avatarAsset : null,
      }
    : null;

  return {
    version: STATE_VERSION,
    onboarded: Boolean(raw.onboarded) && profile !== null,
    profile,
    goals: { ...defaultGoals, ...(isObject(raw.goals) ? raw.goals : {}) },
    settings: mergeSettings(raw.settings),
    days: isObject(raw.days) ? (raw.days as PersistedState['days']) : {},
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as PersistedState['tasks']) : [],
    notes: Array.isArray(raw.notes) ? (raw.notes as PersistedState['notes']) : [],
    xpLedger: Array.isArray(raw.xpLedger) ? dedupeLedger(raw.xpLedger as PersistedState['xpLedger']) : [],
    seenRankLevel: typeof raw.seenRankLevel === 'number' ? raw.seenRankLevel : base.seenRankLevel,
    lastActiveDate:
      typeof raw.lastActiveDate === 'string' && isValidISODate(raw.lastActiveDate)
        ? raw.lastActiveDate
        : todayISO(),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeSettings(raw: unknown): PersistedState['settings'] {
  if (!isObject(raw)) return JSON.parse(JSON.stringify(defaultSettings));
  const merged = JSON.parse(JSON.stringify(defaultSettings)) as PersistedState['settings'];
  for (const group of Object.keys(merged) as (keyof PersistedState['settings'])[]) {
    const incoming = raw[group as string];
    if (isObject(incoming)) Object.assign(merged[group], incoming);
  }
  return merged;
}

/** Guard against any historical duplicate ledger rows. */
function dedupeLedger(ledger: PersistedState['xpLedger']): PersistedState['xpLedger'] {
  const seen = new Map<string, PersistedState['xpLedger'][number]>();
  for (const t of ledger) {
    if (!t || typeof t.id !== 'string') continue;
    seen.set(t.id, t);
  }
  return [...seen.values()];
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;

/** Debounced write. Timer state lives here so the store stays pure. */
export function saveState(state: PersistedState, onError?: (message: string) => void): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(state));
      lastError = null;
    } catch (error) {
      const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
      lastError = quota
        ? 'Device storage is full, so recent changes may not be saved.'
        : 'Changes could not be saved to this device.';
      onError?.(lastError);
    }
  }, 220);
}

/** Immediate write, used before unload and by the export flow. */
export function flushState(state: PersistedState): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Already surfaced through saveState. */
  }
}

export function clearState(): void {
  try {
    getStorage().removeItem(STORAGE_KEY);
  } catch {
    /* Nothing further to do. */
  }
}

export function exportState(state: PersistedState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): PersistedState | null {
  try {
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}
