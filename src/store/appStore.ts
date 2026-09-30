import { create } from 'zustand';
import type {
  AccentTheme,
  DayRecord,
  Goals,
  ISODate,
  Meal,
  MealSlot,
  Nutrition,
  PersistedState,
  Profile,
  Settings,
  SleepRecord,
  StudyNote,
  StudySession,
  StudyTask,
  WorkoutMode,
} from '@/models';
import {
  createBlankMeal,
  createDefaultMeals,
  createWorkoutSession,
  defaultGoals,
  templateForDay,
} from '@/services/defaults';
import {
  clearState,
  exportState,
  flushState,
  importState,
  loadState,
  saveState,
} from '@/services/persistence';
import { reconcileDayXp, totalXp } from '@/domain/xp';
import { emptyDay, isDayComplete } from '@/domain/pillars';
import { isMilestoneDay } from '@/domain/journey';
import { levelForXp } from '@/domain/rank';
import { arcDayNumber, sleepDurationMinutes, todayISO } from '@/utils/date';
import { clamp, safeNumber } from '@/utils/format';
import { createId } from '@/utils/id';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

export interface CelebrationPayload {
  date: ISODate;
  dayNumber: number;
  xpAwarded: number;
  streak: number;
}

export interface RankUpPayload {
  fromLevel: number;
  toLevel: number;
}

interface RuntimeState {
  hydrated: boolean;
  today: ISODate;
  storageWarning: string | null;
  toasts: Toast[];
  celebration: CelebrationPayload | null;
  rankUp: RankUpPayload | null;
  /** Rest timer, shared between the workout screen and the app shell. */
  restEndsAt: number | null;
}

export interface AppState extends PersistedState, RuntimeState {
  /* lifecycle */
  hydrate: () => void;
  setToday: (date: ISODate) => void;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  dismissCelebration: () => void;
  dismissRankUp: () => void;

  /* onboarding + profile */
  completeOnboarding: (profile: { name: string; startDate: ISODate }, goals: Partial<Goals>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateGoals: (patch: Partial<Goals>) => void;
  updateSettings: (patch: DeepPartial<Settings>) => void;
  setAccent: (accent: AccentTheme) => void;

  /* day access */
  setDayNote: (date: ISODate, note: string) => void;

  /* workout */
  startWorkout: (date: ISODate, mode: WorkoutMode) => void;
  setWorkoutMode: (date: ISODate, mode: WorkoutMode) => void;
  toggleWorkoutTimer: (date: ISODate) => void;
  resetWorkoutTimer: (date: ISODate) => void;
  toggleExercise: (date: ISODate, exerciseId: string) => void;
  toggleSet: (date: ISODate, exerciseId: string, setId: string) => void;
  updateSet: (date: ISODate, exerciseId: string, setId: string, patch: { reps?: number; weight?: number }) => void;
  addSet: (date: ISODate, exerciseId: string) => void;
  removeSet: (date: ISODate, exerciseId: string, setId: string) => void;
  addExercise: (date: ISODate, name: string, targetSets: number, targetReps: string) => void;
  removeExercise: (date: ISODate, exerciseId: string) => void;
  renameExercise: (date: ISODate, exerciseId: string, name: string) => void;
  completeWorkout: (date: ISODate) => void;
  reopenWorkout: (date: ISODate) => void;
  startRest: (seconds: number) => void;
  stopRest: () => void;

  /* diet */
  ensureMeals: (date: ISODate) => void;
  toggleMeal: (date: ISODate, mealId: string) => void;
  addMeal: (date: ISODate, slot: MealSlot) => string;
  updateMeal: (date: ISODate, mealId: string, patch: Partial<Omit<Meal, 'nutrition'>> & { nutrition?: Partial<Nutrition> }) => void;
  removeMeal: (date: ISODate, mealId: string) => void;

  /* studies */
  logStudySession: (date: ISODate, seconds: number, label: string, targetMinutes: number) => void;
  removeStudySession: (date: ISODate, sessionId: string) => void;
  addTask: (title: string, dueDate?: ISODate | null) => void;
  toggleTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<StudyTask>) => void;
  removeTask: (id: string) => void;
  addNote: (title: string, body: string) => string;
  updateNote: (id: string, patch: Partial<StudyNote>) => void;
  removeNote: (id: string) => void;

  /* sleep */
  logSleep: (date: ISODate, input: { bedTime: string; wakeTime: string; quality?: SleepRecord['quality']; note?: string }) => void;
  clearSleep: (date: ISODate) => void;

  /* data */
  exportData: () => string;
  importData: (json: string) => boolean;
  resetAll: () => void;
  resetProgressOnly: () => void;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/* ------------------------------------------------------------------------ */

const persistedKeys: (keyof PersistedState)[] = [
  'version',
  'onboarded',
  'profile',
  'goals',
  'settings',
  'days',
  'tasks',
  'notes',
  'xpLedger',
  'seenRankLevel',
  'lastActiveDate',
];

function pickPersisted(state: AppState): PersistedState {
  const out: Record<string, unknown> = {};
  for (const key of persistedKeys) {
    out[key] = state[key];
  }
  return out as unknown as PersistedState;
}

const initial = loadState();

export const useAppStore = create<AppState>()((set, get) => {
  /**
   * Every mutation funnels through here. It writes the day back, reconciles
   * the XP ledger for that day, detects rank-ups and full-day completion, and
   * schedules the save. Screens never touch XP, rank or streaks directly.
   */
  const commitDay = (date: ISODate, mutate: (day: DayRecord) => DayRecord | void) => {
    set((state) => {
      const previous = state.days[date] ?? emptyDay(date);
      // Deep enough that a mutating action can never reach into the previous
      // snapshot. Sharing objects across snapshots makes React miss updates.
      const draft: DayRecord = {
        ...previous,
        meals: previous.meals.map((m) => ({ ...m, nutrition: { ...m.nutrition } })),
        studySessions: previous.studySessions.map((s) => ({ ...s })),
        sleep: previous.sleep ? { ...previous.sleep } : null,
        workout: previous.workout
          ? {
              ...previous.workout,
              exercises: previous.workout.exercises.map((e) => ({
                ...e,
                sets: e.sets.map((s) => ({ ...s })),
              })),
            }
          : null,
      };
      const result = mutate(draft) ?? draft;

      const days = { ...state.days, [date]: result };
      const startDate = state.profile?.startDate ?? date;
      const wasComplete = isDayComplete(previous, state.goals);
      const nowComplete = isDayComplete(result, state.goals);

      const { ledger, gained } = reconcileDayXp(state.xpLedger, date, result, state.goals, {
        isMilestoneDay: isMilestoneDay(startDate, date),
      });

      const xpBefore = totalXp(state.xpLedger);
      const xpAfter = totalXp(ledger);
      const levelBefore = levelForXp(xpBefore);
      const levelAfter = levelForXp(xpAfter);

      let celebration = state.celebration;
      let nextDay = result;
      if (!wasComplete && nowComplete && result.celebratedAt === null) {
        nextDay = { ...result, celebratedAt: Date.now() };
        days[date] = nextDay;
        celebration = {
          date,
          dayNumber: arcDayNumber(startDate, date),
          xpAwarded: gained,
          streak: 0, // filled in by the overlay from live history
        };
      }

      const rankUp =
        levelAfter > levelBefore ? { fromLevel: levelBefore, toLevel: levelAfter } : state.rankUp;

      return {
        days,
        xpLedger: ledger,
        celebration,
        rankUp,
        seenRankLevel: Math.max(state.seenRankLevel, levelAfter),
      };
    });
    schedulePersist();
  };

  const schedulePersist = () => {
    const state = get();
    if (!state.hydrated) return;
    saveState(pickPersisted(state), (message) => set({ storageWarning: message }));
  };

  const mutate = (updater: (state: AppState) => Partial<AppState>) => {
    set(updater);
    schedulePersist();
  };

  return {
    ...initial.state,
    hydrated: false,
    today: todayISO(),
    storageWarning:
      initial.status === 'recovered' ? initial.reason : null,
    toasts: [],
    celebration: null,
    rankUp: null,
    restEndsAt: null,

    /* ------------------------------------------------------------ lifecycle */

    hydrate: () => {
      const today = todayISO();
      set({ hydrated: true, today, lastActiveDate: today });
      // Reconcile today's ledger once on boot so a goal change made on an
      // earlier session cannot leave stale XP behind.
      const state = get();
      if (state.profile) {
        const { ledger, changed } = reconcileDayXp(
          state.xpLedger,
          today,
          state.days[today],
          state.goals,
          { isMilestoneDay: isMilestoneDay(state.profile.startDate, today) },
        );
        if (changed) set({ xpLedger: ledger });
      }
      schedulePersist();
    },

    setToday: (date) => {
      if (get().today === date) return;
      set({ today: date, lastActiveDate: date, celebration: null });
      schedulePersist();
    },

    pushToast: (message, tone = 'info') => {
      const id = createId('toast');
      set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 3600);
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    dismissCelebration: () => set({ celebration: null }),
    dismissRankUp: () => set({ rankUp: null }),

    /* ---------------------------------------------------------- onboarding */

    completeOnboarding: (profile, goals) => {
      const startDate = profile.startDate;
      mutate((state) => ({
        onboarded: true,
        profile: {
          name: profile.name.trim() || 'Athlete',
          startDate,
          createdAt: Date.now(),
          avatarAsset: null,
        },
        goals: { ...state.goals, ...goals },
      }));
      get().ensureMeals(get().today);
    },

    updateProfile: (patch) =>
      mutate((state) => ({
        profile: state.profile ? { ...state.profile, ...patch } : state.profile,
      })),

    updateGoals: (patch) => {
      mutate((state) => ({ goals: { ...state.goals, ...patch } }));
      // Goal changes can flip pillar completion, so reconcile today's XP.
      const state = get();
      const today = state.today;
      const { ledger, changed } = reconcileDayXp(state.xpLedger, today, state.days[today], state.goals, {
        isMilestoneDay: state.profile ? isMilestoneDay(state.profile.startDate, today) : false,
      });
      if (changed) {
        set({ xpLedger: ledger });
        schedulePersist();
      }
    },

    updateSettings: (patch) =>
      mutate((state) => {
        const next = JSON.parse(JSON.stringify(state.settings)) as Settings;
        for (const group of Object.keys(patch) as (keyof Settings)[]) {
          Object.assign(next[group], patch[group]);
        }
        return { settings: next };
      }),

    setAccent: (accent) =>
      mutate((state) => ({
        settings: { ...state.settings, appearance: { ...state.settings.appearance, accent } },
      })),

    /* ---------------------------------------------------------------- days */

    setDayNote: (date, note) => commitDay(date, (day) => { day.note = note.slice(0, 2000); }),

    /* ------------------------------------------------------------- workout */

    startWorkout: (date, mode) => {
      const state = get();
      const dayNumber = state.profile ? arcDayNumber(state.profile.startDate, date) : 1;
      const template = templateForDay(mode, dayNumber);
      commitDay(date, (day) => {
        day.workout = createWorkoutSession(date, template);
      });
    },

    setWorkoutMode: (date, mode) => {
      const state = get();
      const dayNumber = state.profile ? arcDayNumber(state.profile.startDate, date) : 1;
      const template = templateForDay(mode, dayNumber);
      commitDay(date, (day) => {
        if (day.workout?.completed) return;
        const elapsed = day.workout?.elapsedSeconds ?? 0;
        day.workout = { ...createWorkoutSession(date, template), elapsedSeconds: elapsed };
      });
    },

    toggleWorkoutTimer: (date) =>
      commitDay(date, (day) => {
        const w = day.workout;
        if (!w || w.completed) return;
        if (w.runningSince === null) {
          w.runningSince = Date.now();
        } else {
          w.elapsedSeconds += Math.round((Date.now() - w.runningSince) / 1000);
          w.runningSince = null;
        }
      }),

    resetWorkoutTimer: (date) =>
      commitDay(date, (day) => {
        if (!day.workout || day.workout.completed) return;
        day.workout.elapsedSeconds = 0;
        day.workout.runningSince = null;
      }),

    toggleExercise: (date, exerciseId) =>
      commitDay(date, (day) => {
        const ex = day.workout?.exercises.find((e) => e.id === exerciseId);
        if (!ex) return;
        ex.done = !ex.done;
        ex.sets = ex.sets.map((s) => ({ ...s, done: ex.done }));
      }),

    toggleSet: (date, exerciseId, setId) =>
      commitDay(date, (day) => {
        const ex = day.workout?.exercises.find((e) => e.id === exerciseId);
        const set_ = ex?.sets.find((s) => s.id === setId);
        if (!ex || !set_) return;
        set_.done = !set_.done;
        ex.done = ex.sets.length > 0 && ex.sets.every((s) => s.done);
      }),

    updateSet: (date, exerciseId, setId, patch) =>
      commitDay(date, (day) => {
        const set_ = day.workout?.exercises.find((e) => e.id === exerciseId)?.sets.find((s) => s.id === setId);
        if (!set_) return;
        if (patch.reps !== undefined) set_.reps = clamp(Math.round(safeNumber(patch.reps)), 0, 999);
        if (patch.weight !== undefined) set_.weight = clamp(safeNumber(patch.weight), 0, 999);
      }),

    addSet: (date, exerciseId) =>
      commitDay(date, (day) => {
        const ex = day.workout?.exercises.find((e) => e.id === exerciseId);
        if (!ex) return;
        const last = ex.sets[ex.sets.length - 1];
        ex.sets.push({ id: createId('set'), reps: last?.reps ?? 10, weight: last?.weight ?? 0, done: false });
        ex.targetSets = ex.sets.length;
        ex.done = false;
      }),

    removeSet: (date, exerciseId, setId) =>
      commitDay(date, (day) => {
        const ex = day.workout?.exercises.find((e) => e.id === exerciseId);
        if (!ex || ex.sets.length <= 1) return;
        ex.sets = ex.sets.filter((s) => s.id !== setId);
        ex.targetSets = ex.sets.length;
        ex.done = ex.sets.every((s) => s.done);
      }),

    addExercise: (date, name, targetSets, targetReps) =>
      commitDay(date, (day) => {
        if (!day.workout) return;
        day.workout.exercises.push({
          id: createId('ex'),
          name: name.trim() || 'New exercise',
          targetSets,
          targetReps,
          done: false,
          sets: Array.from({ length: Math.max(1, targetSets) }, () => ({
            id: createId('set'),
            reps: 10,
            weight: 0,
            done: false,
          })),
        });
      }),

    removeExercise: (date, exerciseId) =>
      commitDay(date, (day) => {
        if (!day.workout) return;
        day.workout.exercises = day.workout.exercises.filter((e) => e.id !== exerciseId);
      }),

    renameExercise: (date, exerciseId, name) =>
      commitDay(date, (day) => {
        const ex = day.workout?.exercises.find((e) => e.id === exerciseId);
        if (ex) ex.name = name.trim().slice(0, 60) || ex.name;
      }),

    completeWorkout: (date) =>
      commitDay(date, (day) => {
        const w = day.workout;
        if (!w || w.completed) return;
        if (w.runningSince !== null) {
          w.elapsedSeconds += Math.round((Date.now() - w.runningSince) / 1000);
          w.runningSince = null;
        }
        w.completed = true;
        w.completedAt = Date.now();
      }),

    reopenWorkout: (date) =>
      commitDay(date, (day) => {
        const w = day.workout;
        if (!w) return;
        w.completed = false;
        w.completedAt = null;
      }),

    startRest: (seconds) => set({ restEndsAt: Date.now() + seconds * 1000 }),
    stopRest: () => set({ restEndsAt: null }),

    /* ---------------------------------------------------------------- diet */

    ensureMeals: (date) => {
      const state = get();
      const day = state.days[date];
      if (day && day.meals.length > 0) return;
      const meals = createDefaultMeals(date, state.goals.mealsPerDay);
      commitDay(date, (draft) => {
        if (draft.meals.length === 0) draft.meals = meals;
      });
    },

    toggleMeal: (date, mealId) =>
      commitDay(date, (day) => {
        const meal = day.meals.find((m) => m.id === mealId);
        if (!meal) return;
        meal.completed = !meal.completed;
        meal.completedAt = meal.completed ? Date.now() : null;
      }),

    addMeal: (date, slot) => {
      const meal = createBlankMeal(date, slot);
      commitDay(date, (day) => {
        day.meals = [...day.meals, meal];
      });
      return meal.id;
    },

    updateMeal: (date, mealId, patch) =>
      commitDay(date, (day) => {
        const index = day.meals.findIndex((m) => m.id === mealId);
        if (index < 0) return;
        const prev = day.meals[index];
        const { nutrition, ...rest } = patch;
        day.meals[index] = {
          ...prev,
          ...rest,
          nutrition: {
            calories: clamp(safeNumber(nutrition?.calories ?? prev.nutrition.calories), 0, 10000),
            protein: clamp(safeNumber(nutrition?.protein ?? prev.nutrition.protein), 0, 1000),
            carbs: clamp(safeNumber(nutrition?.carbs ?? prev.nutrition.carbs), 0, 1000),
            fats: clamp(safeNumber(nutrition?.fats ?? prev.nutrition.fats), 0, 1000),
          },
        };
      }),

    removeMeal: (date, mealId) =>
      commitDay(date, (day) => {
        day.meals = day.meals.filter((m) => m.id !== mealId);
      }),

    /* ------------------------------------------------------------- studies */

    logStudySession: (date, seconds, label, targetMinutes) => {
      const session: StudySession = {
        id: createId('study'),
        date,
        label,
        targetMinutes,
        seconds: Math.max(1, Math.round(seconds)),
        completedAt: Date.now(),
      };
      commitDay(date, (day) => {
        day.studySessions = [...day.studySessions, session];
      });
    },

    removeStudySession: (date, sessionId) =>
      commitDay(date, (day) => {
        day.studySessions = day.studySessions.filter((s) => s.id !== sessionId);
      }),

    addTask: (title, dueDate = null) =>
      mutate((state) => ({
        tasks: [
          {
            id: createId('task'),
            title: title.trim().slice(0, 140),
            createdAt: Date.now(),
            done: false,
            completedAt: null,
            dueDate,
          },
          ...state.tasks,
        ],
      })),

    toggleTask: (id) =>
      mutate((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : null } : t,
        ),
      })),

    updateTask: (id, patch) =>
      mutate((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),

    removeTask: (id) => mutate((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

    addNote: (title, body) => {
      const note: StudyNote = {
        id: createId('note'),
        title: title.trim().slice(0, 100) || 'Untitled note',
        body: body.slice(0, 5000),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mutate((state) => ({ notes: [note, ...state.notes] }));
      return note.id;
    },

    updateNote: (id, patch) =>
      mutate((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
      })),

    removeNote: (id) => mutate((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

    /* --------------------------------------------------------------- sleep */

    logSleep: (date, input) => {
      const minutes = sleepDurationMinutes(input.bedTime, input.wakeTime);
      const record: SleepRecord = {
        id: createId('sleep'),
        date,
        bedTime: input.bedTime,
        wakeTime: input.wakeTime,
        minutes,
        quality: input.quality ?? 4,
        note: input.note ?? '',
        loggedAt: Date.now(),
      };
      commitDay(date, (day) => {
        day.sleep = record;
      });
    },

    clearSleep: (date) => commitDay(date, (day) => { day.sleep = null; }),

    /* ---------------------------------------------------------------- data */

    exportData: () => exportState(pickPersisted(get())),

    importData: (json) => {
      const next = importState(json);
      if (!next) return false;
      set({ ...next, celebration: null, rankUp: null });
      flushState(next);
      return true;
    },

    resetAll: () => {
      clearState();
      const fresh = loadState().state;
      set({
        ...fresh,
        hydrated: true,
        today: todayISO(),
        toasts: [],
        celebration: null,
        rankUp: null,
        storageWarning: null,
        restEndsAt: null,
      });
      flushState(fresh);
    },

    resetProgressOnly: () => {
      mutate(() => ({ days: {}, xpLedger: [], seenRankLevel: 1 }));
    },
  };
});

/** Persist immediately when the tab is hidden or closed. */
export function installPersistenceGuards(): () => void {
  const flush = () => flushState(pickPersisted(useAppStore.getState()));
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('beforeunload', flush);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export const defaultGoalsRef = defaultGoals;
