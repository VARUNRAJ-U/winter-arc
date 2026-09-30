/* =========================================================================
   WINTER ARC · DATA MODELS
   Every persisted entity is defined here. `ISODate` is a local calendar day
   (YYYY-MM-DD); every timestamp is epoch milliseconds.
   ========================================================================= */

export type ISODate = string;
export type Timestamp = number;
export type ID = string;

export const PILLARS = ['workout', 'diet', 'studies', 'sleep'] as const;
export type PillarKey = (typeof PILLARS)[number];

export type DayStatus = 'complete' | 'partial' | 'missed' | 'today' | 'future';

/* ------------------------------------------------------------------ User */

export interface Profile {
  name: string;
  startDate: ISODate;
  createdAt: Timestamp;
  avatarAsset: string | null;
}

export interface Goals {
  /** Meals required per day to complete the pillar. */
  mealsPerDay: number;
  /** Focus sessions required per day to complete the pillar. */
  studySessionsPerDay: number;
  /** Length of one focus session, minutes. */
  focusSessionMinutes: number;
  /** Length of one break, minutes. */
  breakMinutes: number;
  /** Sleep hours required to complete the pillar. */
  sleepTargetHours: number;
  /** Default schedule, "HH:mm". */
  bedTime: string;
  wakeTime: string;
  /** Daily calorie / protein targets used by the Nutrition tab. */
  calorieTarget: number;
  proteinTarget: number;
  /** Rest between sets, seconds. */
  restSeconds: number;
}

export type AccentTheme = 'arctic' | 'aurora' | 'ember' | 'violet';

export interface Settings {
  notifications: {
    enabled: boolean;
    dailyReminder: boolean;
    reminderTime: string;
    streakAlerts: boolean;
    milestoneAlerts: boolean;
  };
  appearance: {
    accent: AccentTheme;
    highContrast: boolean;
    reduceMotion: boolean;
    ambientEffects: boolean;
  };
  focusMode: {
    hideCompleted: boolean;
    keepScreenAwake: boolean;
    chimeOnComplete: boolean;
    autoStartBreaks: boolean;
  };
  widgets: {
    showQuote: boolean;
    showStreak: boolean;
    showNextMilestone: boolean;
    showMacros: boolean;
  };
}

/* --------------------------------------------------------------- Workout */

export type WorkoutMode = 'strength' | 'hiit' | 'mobility';

export interface ExerciseSet {
  id: ID;
  reps: number;
  weight: number;
  done: boolean;
}

export interface Exercise {
  id: ID;
  name: string;
  targetSets: number;
  targetReps: string;
  sets: ExerciseSet[];
  done: boolean;
}

export interface WorkoutSession {
  id: ID;
  date: ISODate;
  mode: WorkoutMode;
  title: string;
  focus: string;
  exercises: Exercise[];
  /** Accumulated active seconds. */
  elapsedSeconds: number;
  /** Epoch ms when the timer was last started, null when paused. */
  runningSince: Timestamp | null;
  completed: boolean;
  completedAt: Timestamp | null;
}

export interface WorkoutTemplate {
  mode: WorkoutMode;
  title: string;
  focus: string;
  asset: string;
  exercises: { name: string; targetSets: number; targetReps: string; weight: number; reps: number }[];
}

/* ------------------------------------------------------------------ Diet */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Meal {
  id: ID;
  date: ISODate;
  slot: MealSlot;
  title: string;
  items: string;
  note: string;
  time: string;
  nutrition: Nutrition;
  asset: string | null;
  completed: boolean;
  completedAt: Timestamp | null;
}

/* --------------------------------------------------------------- Studies */

export interface StudySession {
  id: ID;
  date: ISODate;
  label: string;
  /** Planned length in minutes. */
  targetMinutes: number;
  /** Actually completed seconds. */
  seconds: number;
  completedAt: Timestamp;
}

export interface StudyTask {
  id: ID;
  title: string;
  createdAt: Timestamp;
  done: boolean;
  completedAt: Timestamp | null;
  dueDate: ISODate | null;
}

export interface StudyNote {
  id: ID;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ----------------------------------------------------------------- Sleep */

export interface SleepRecord {
  id: ID;
  /** The day the sleep is credited to (the wake-up day). */
  date: ISODate;
  bedTime: string;
  wakeTime: string;
  /** Derived, kept denormalised for fast history reads. */
  minutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  note: string;
  loggedAt: Timestamp;
}

/* -------------------------------------------------------------------- XP */

export type XPSource = PillarKey | 'day' | 'milestone';

export interface XPTransaction {
  /** Deterministic: `${date}:${source}` — guarantees XP can never duplicate. */
  id: string;
  date: ISODate;
  source: XPSource;
  amount: number;
  label: string;
  awardedAt: Timestamp;
}

/* ------------------------------------------------------------------ Rank */

export interface RankTier {
  key: string;
  name: string;
  short: string;
  minLevel: number;
}

export interface RankState {
  xp: number;
  level: number;
  tier: RankTier;
  tierIndex: number;
  levelStartXp: number;
  nextLevelXp: number | null;
  progress: number;
}

export interface Reward {
  id: string;
  requirement: { type: 'level'; value: number } | { type: 'xp'; value: number };
  label: string;
  description: string;
  unlocked: boolean;
}

/* --------------------------------------------------------------- Journey */

export interface Milestone {
  day: number;
  title: string;
  description: string;
  reached: boolean;
  date: ISODate;
}

/* ---------------------------------------------------------- Day + history */

export interface PillarProgress {
  key: PillarKey;
  label: string;
  current: number;
  target: number;
  complete: boolean;
  detail: string;
  xp: number;
}

export interface DayRecord {
  date: ISODate;
  workout: WorkoutSession | null;
  meals: Meal[];
  studySessions: StudySession[];
  sleep: SleepRecord | null;
  note: string;
  celebratedAt: Timestamp | null;
}

export interface DailyHistoryEntry {
  date: ISODate;
  dayNumber: number;
  status: DayStatus;
  completedPillars: number;
  pillars: Record<PillarKey, boolean>;
  xp: number;
}

/* ------------------------------------------------------------ Persistence */

export interface PersistedState {
  version: number;
  onboarded: boolean;
  profile: Profile | null;
  goals: Goals;
  settings: Settings;
  days: Record<ISODate, DayRecord>;
  tasks: StudyTask[];
  notes: StudyNote[];
  xpLedger: XPTransaction[];
  seenRankLevel: number;
  lastActiveDate: ISODate | null;
}
