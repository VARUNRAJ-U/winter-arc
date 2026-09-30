import type {
  Goals,
  ISODate,
  Meal,
  MealSlot,
  PersistedState,
  Settings,
  WorkoutMode,
  WorkoutSession,
  WorkoutTemplate,
} from '@/models';
import { createId } from '@/utils/id';
import { todayISO } from '@/utils/date';

export const STATE_VERSION = 1;

export const defaultGoals: Goals = {
  mealsPerDay: 3,
  studySessionsPerDay: 2,
  focusSessionMinutes: 50,
  breakMinutes: 10,
  sleepTargetHours: 8,
  bedTime: '22:30',
  wakeTime: '06:30',
  calorieTarget: 2200,
  proteinTarget: 150,
  restSeconds: 90,
};

export const defaultSettings: Settings = {
  notifications: {
    enabled: true,
    dailyReminder: true,
    reminderTime: '07:00',
    streakAlerts: true,
    milestoneAlerts: true,
  },
  appearance: {
    accent: 'arctic',
    highContrast: false,
    reduceMotion: false,
    ambientEffects: true,
  },
  focusMode: {
    hideCompleted: false,
    keepScreenAwake: true,
    chimeOnComplete: true,
    autoStartBreaks: false,
  },
  widgets: {
    showQuote: true,
    showStreak: true,
    showNextMilestone: true,
    showMacros: true,
  },
};

export function createInitialState(): PersistedState {
  return {
    version: STATE_VERSION,
    onboarded: false,
    profile: null,
    goals: { ...defaultGoals },
    settings: structuredCloneSafe(defaultSettings),
    days: {},
    tasks: [],
    notes: [],
    xpLedger: [],
    seenRankLevel: 1,
    lastActiveDate: todayISO(),
  };
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/* ------------------------------------------------------------- Workouts */

export const workoutTemplates: Record<WorkoutMode, WorkoutTemplate[]> = {
  strength: [
    {
      mode: 'strength',
      title: 'Push Day',
      focus: 'Chest · Shoulders · Triceps',
      asset: 'workout',
      exercises: [
        { name: 'Bench Press', targetSets: 4, targetReps: '8-10', weight: 60, reps: 8 },
        { name: 'Incline Dumbbell Press', targetSets: 4, targetReps: '10', weight: 22, reps: 10 },
        { name: 'Shoulder Press', targetSets: 3, targetReps: '10', weight: 40, reps: 10 },
        { name: 'Tricep Dips', targetSets: 3, targetReps: '12', weight: 0, reps: 12 },
        { name: 'Cable Pushdown', targetSets: 3, targetReps: '12', weight: 25, reps: 12 },
      ],
    },
    {
      mode: 'strength',
      title: 'Pull Day',
      focus: 'Back · Biceps · Rear Delts',
      asset: 'workout',
      exercises: [
        { name: 'Deadlift', targetSets: 4, targetReps: '5', weight: 100, reps: 5 },
        { name: 'Pull Ups', targetSets: 4, targetReps: '8', weight: 0, reps: 8 },
        { name: 'Barbell Row', targetSets: 3, targetReps: '10', weight: 50, reps: 10 },
        { name: 'Face Pull', targetSets: 3, targetReps: '15', weight: 20, reps: 15 },
        { name: 'Hammer Curl', targetSets: 3, targetReps: '12', weight: 14, reps: 12 },
      ],
    },
    {
      mode: 'strength',
      title: 'Leg Day',
      focus: 'Quads · Hamstrings · Calves',
      asset: 'workout',
      exercises: [
        { name: 'Back Squat', targetSets: 4, targetReps: '6-8', weight: 80, reps: 8 },
        { name: 'Romanian Deadlift', targetSets: 3, targetReps: '10', weight: 60, reps: 10 },
        { name: 'Walking Lunge', targetSets: 3, targetReps: '12', weight: 16, reps: 12 },
        { name: 'Leg Curl', targetSets: 3, targetReps: '12', weight: 35, reps: 12 },
        { name: 'Standing Calf Raise', targetSets: 4, targetReps: '15', weight: 40, reps: 15 },
      ],
    },
  ],
  hiit: [
    {
      mode: 'hiit',
      title: 'Engine Builder',
      focus: 'Conditioning · Core · Power',
      asset: 'workout',
      exercises: [
        { name: 'Assault Bike Sprint', targetSets: 6, targetReps: '30s', weight: 0, reps: 30 },
        { name: 'Burpee', targetSets: 5, targetReps: '12', weight: 0, reps: 12 },
        { name: 'Kettlebell Swing', targetSets: 5, targetReps: '20', weight: 24, reps: 20 },
        { name: 'Mountain Climber', targetSets: 4, targetReps: '40s', weight: 0, reps: 40 },
        { name: 'Plank Hold', targetSets: 3, targetReps: '60s', weight: 0, reps: 60 },
      ],
    },
  ],
  mobility: [
    {
      mode: 'mobility',
      title: 'Recovery Flow',
      focus: 'Hips · Spine · Shoulders',
      asset: 'snowMountains',
      exercises: [
        { name: 'World Greatest Stretch', targetSets: 3, targetReps: '8/side', weight: 0, reps: 8 },
        { name: 'Cat Cow', targetSets: 3, targetReps: '12', weight: 0, reps: 12 },
        { name: 'Couch Stretch', targetSets: 2, targetReps: '60s', weight: 0, reps: 60 },
        { name: 'Thoracic Rotation', targetSets: 3, targetReps: '10/side', weight: 0, reps: 10 },
        { name: 'Deep Squat Hold', targetSets: 3, targetReps: '45s', weight: 0, reps: 45 },
      ],
    },
  ],
};

/** Rotate templates by arc day so the plan varies without any manual setup. */
export function templateForDay(mode: WorkoutMode, dayNumber: number): WorkoutTemplate {
  const list = workoutTemplates[mode];
  const index = ((Math.max(1, dayNumber) - 1) % list.length + list.length) % list.length;
  return list[index];
}

export function createWorkoutSession(
  date: ISODate,
  template: WorkoutTemplate,
): WorkoutSession {
  return {
    id: createId('workout'),
    date,
    mode: template.mode,
    title: template.title,
    focus: template.focus,
    exercises: template.exercises.map((ex) => ({
      id: createId('ex'),
      name: ex.name,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      done: false,
      sets: Array.from({ length: ex.targetSets }, () => ({
        id: createId('set'),
        reps: ex.reps,
        weight: ex.weight,
        done: false,
      })),
    })),
    elapsedSeconds: 0,
    runningSince: null,
    completed: false,
    completedAt: null,
  };
}

/* ----------------------------------------------------------------- Meals */

export const mealSlotOrder: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const mealSlotLabels: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

interface MealTemplate {
  slot: MealSlot;
  title: string;
  items: string;
  note: string;
  time: string;
  asset: string | null;
  nutrition: { calories: number; protein: number; carbs: number; fats: number };
}

export const mealTemplates: MealTemplate[] = [
  {
    slot: 'breakfast',
    title: 'Breakfast',
    items: 'Oats, berries, banana',
    note: 'High protein, clean carbs',
    time: '07:30',
    asset: 'breakfast',
    nutrition: { calories: 520, protein: 32, carbs: 58, fats: 14 },
  },
  {
    slot: 'lunch',
    title: 'Lunch',
    items: 'Chicken, rice, vegetables',
    note: 'Whole foods, clean fuel',
    time: '12:30',
    asset: 'lunch',
    nutrition: { calories: 540, protein: 45, carbs: 60, fats: 16 },
  },
  {
    slot: 'dinner',
    title: 'Dinner',
    items: 'Salmon, quinoa, greens',
    note: 'Recover and rebuild',
    time: '19:00',
    asset: 'lunch',
    nutrition: { calories: 610, protein: 42, carbs: 48, fats: 24 },
  },
];

export function createDefaultMeals(date: ISODate, mealsPerDay: number): Meal[] {
  const count = Math.max(1, Math.min(mealTemplates.length, mealsPerDay));
  return mealTemplates.slice(0, count).map((t) => ({
    id: createId('meal'),
    date,
    slot: t.slot,
    title: t.title,
    items: t.items,
    note: t.note,
    time: t.time,
    nutrition: { ...t.nutrition },
    asset: t.asset,
    completed: false,
    completedAt: null,
  }));
}

export function createBlankMeal(date: ISODate, slot: MealSlot): Meal {
  return {
    id: createId('meal'),
    date,
    slot,
    title: mealSlotLabels[slot],
    items: '',
    note: '',
    time: slot === 'breakfast' ? '07:30' : slot === 'lunch' ? '12:30' : slot === 'dinner' ? '19:00' : '16:00',
    nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 },
    asset: slot === 'breakfast' ? 'breakfast' : slot === 'snack' ? null : 'lunch',
    completed: false,
    completedAt: null,
  };
}

/* ------------------------------------------------------------- Onboarding */

export const goalPresets = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'One session of everything, every day.',
    goals: { mealsPerDay: 3, studySessionsPerDay: 2, sleepTargetHours: 8 },
  },
  {
    id: 'athlete',
    name: 'Athlete',
    description: 'Training leads. Recovery is non-negotiable.',
    goals: { mealsPerDay: 4, studySessionsPerDay: 1, sleepTargetHours: 8.5 },
  },
  {
    id: 'scholar',
    name: 'Scholar',
    description: 'Deep work first, the body keeps up.',
    goals: { mealsPerDay: 3, studySessionsPerDay: 3, sleepTargetHours: 7.5 },
  },
] as const;

export type GoalPresetId = (typeof goalPresets)[number]['id'];
