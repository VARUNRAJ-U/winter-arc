import { useEffect, useMemo, useState } from 'react';
import { workoutModeAsset } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  Button,
  CheckMark,
  Chip,
  EmptyState,
  Field,
  GlassCard,
  Icon,
  IconButton,
  ImageHero,
  Modal,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SegmentedTabs,
  Section,
  Stepper,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useDay, useToday } from '@/store/selectors';
import { useNavigationStore } from '@/store/navigationStore';
import { useChime, useTicker, useWakeLock } from '@/hooks';
import { formatClock, formatCountdown } from '@/utils/format';
import { PILLAR_TAGLINES } from '@/domain/pillars';
import type { Exercise, WorkoutMode } from '@/models';
import './screens.css';

const MODE_TABS: { value: WorkoutMode; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'mobility', label: 'Mobility' },
];

export function WorkoutScreen() {
  const today = useToday();
  const day = useDay(today);
  const goals = useAppStore((s) => s.goals);
  const restSeconds = goals.restSeconds;

  const startWorkout = useAppStore((s) => s.startWorkout);
  const setWorkoutMode = useAppStore((s) => s.setWorkoutMode);
  const toggleWorkoutTimer = useAppStore((s) => s.toggleWorkoutTimer);
  const resetWorkoutTimer = useAppStore((s) => s.resetWorkoutTimer);
  const toggleExercise = useAppStore((s) => s.toggleExercise);
  const toggleSet = useAppStore((s) => s.toggleSet);
  const updateSet = useAppStore((s) => s.updateSet);
  const addSet = useAppStore((s) => s.addSet);
  const removeSet = useAppStore((s) => s.removeSet);
  const addExercise = useAppStore((s) => s.addExercise);
  const removeExercise = useAppStore((s) => s.removeExercise);
  const renameExercise = useAppStore((s) => s.renameExercise);
  const completeWorkout = useAppStore((s) => s.completeWorkout);
  const reopenWorkout = useAppStore((s) => s.reopenWorkout);
  const startRest = useAppStore((s) => s.startRest);
  const stopRest = useAppStore((s) => s.stopRest);
  const restEndsAt = useAppStore((s) => s.restEndsAt);
  const pushToast = useAppStore((s) => s.pushToast);
  const keepAwake = useAppStore((s) => s.settings.focusMode.keepScreenAwake);
  const chimeOn = useAppStore((s) => s.settings.focusMode.chimeOnComplete);
  const pop = useNavigationStore((s) => s.pop);

  const [mode, setMode] = useState<WorkoutMode>(day.workout?.mode ?? 'strength');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [newName, setNewName] = useState('');
  const [newSets, setNewSets] = useState(3);
  const [newReps, setNewReps] = useState('10');

  const workout = day.workout;
  const running = workout?.runningSince !== null && workout?.runningSince !== undefined;
  const chime = useChime();

  useWakeLock(keepAwake && !!running);

  // Live clock only while something is actually counting.
  const tick = useTicker(1000, running || restEndsAt !== null);

  const elapsed = useMemo(() => {
    if (!workout) return 0;
    const live = workout.runningSince === null ? 0 : Math.round((tick - workout.runningSince) / 1000);
    return workout.elapsedSeconds + Math.max(0, live);
  }, [workout, tick]);

  const restRemaining = restEndsAt === null ? 0 : Math.max(0, (restEndsAt - tick) / 1000);

  useEffect(() => {
    if (restEndsAt !== null && restRemaining <= 0) {
      stopRest();
      if (chimeOn) chime();
      pushToast('Rest complete. Next set.', 'success');
    }
  }, [restEndsAt, restRemaining, stopRest, chime, chimeOn, pushToast]);

  useEffect(() => {
    if (day.workout?.mode && day.workout.mode !== mode) setMode(day.workout.mode);
    // Only syncs when the stored workout changes, not on every local tab tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.workout?.id]);

  const onModeChange = (next: WorkoutMode) => {
    setMode(next);
    if (!workout) return;
    if (workout.completed) {
      pushToast('Reopen the workout to change its type.', 'warning');
      return;
    }
    const hasProgress = workout.exercises.some((e) => e.sets.some((s) => s.done));
    if (hasProgress && !window.confirm('Switching type replaces the exercise list. Continue?')) {
      setMode(workout.mode);
      return;
    }
    setWorkoutMode(today, next);
  };

  const onComplete = () => {
    completeWorkout(today);
    stopRest();
    if (chimeOn) chime();
    pushToast('Workout secured. +50 XP', 'success');
  };

  const doneSets = workout?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) ?? 0;
  const totalSets = workout?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const doneExercises = workout?.exercises.filter((e) => e.done).length ?? 0;

  return (
    <Screen scrollKey="workout">
      <ScreenHeader
        title="Workout"
        subtitle={PILLAR_TAGLINES.workout}
        actions={
          workout ? (
            <IconButton icon="plus" label="Add exercise" bordered onClick={() => setAddOpen(true)} />
          ) : null
        }
      />

      <ScreenBody>
        <SegmentedTabs items={MODE_TABS} value={mode} onChange={onModeChange} label="Workout type" />
      </ScreenBody>

      {!workout ? (
        <ScreenBody>
          <EmptyState
            icon="dumbbell"
            title="No session started"
            description="Pick a type above and start today's workout. The plan rotates automatically as your arc progresses."
            action={
              <PrimaryButton style={{ marginTop: 'var(--sp-3)' }} onClick={() => startWorkout(today, mode)}>
                Start {MODE_TABS.find((m) => m.value === mode)?.label} session
              </PrimaryButton>
            }
          />
        </ScreenBody>
      ) : (
        <>
          <div className="wk__hero">
            <ImageHero asset={workoutModeAsset[mode] as 'workout'} height={230} scrim="bottom" drift>
              <div className="wk__heroText">
                <h2 className="wk__heroTitle">{workout.title}</h2>
                <p className="wk__heroFocus">{workout.focus}</p>
              </div>
            </ImageHero>
          </div>

          <ScreenBody>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
              <Chip icon="check" tone={doneExercises === workout.exercises.length ? 'complete' : 'default'}>
                {doneExercises}/{workout.exercises.length} exercises
              </Chip>
              <Chip icon="bar-chart">
                {doneSets}/{totalSets} sets
              </Chip>
              {workout.completed ? <Chip tone="complete">Completed</Chip> : null}
            </div>

            <GlassCard>
              <ul className="ex-list">
                {workout.exercises.map((exercise) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    expanded={expanded === exercise.id}
                    locked={workout.completed}
                    onToggleExpand={() => setExpanded(expanded === exercise.id ? null : exercise.id)}
                    onToggleDone={() => toggleExercise(today, exercise.id)}
                    onToggleSet={(setId) => {
                      toggleSet(today, exercise.id, setId);
                      const wasDone = exercise.sets.find((s) => s.id === setId)?.done;
                      if (!wasDone && !workout.completed) startRest(restSeconds);
                    }}
                    onUpdateSet={(setId, patch) => updateSet(today, exercise.id, setId, patch)}
                    onAddSet={() => addSet(today, exercise.id)}
                    onRemoveSet={(setId) => removeSet(today, exercise.id, setId)}
                    onRename={() => {
                      setRenamingId(exercise.id);
                      setRenameText(exercise.name);
                    }}
                    onRemove={() => {
                      if (window.confirm(`Remove ${exercise.name} from this workout?`)) {
                        removeExercise(today, exercise.id);
                      }
                    }}
                  />
                ))}
              </ul>

              {workout.exercises.length === 0 ? (
                <EmptyState
                  icon="dumbbell"
                  title="No exercises yet"
                  description="Add the movements you are training today."
                />
              ) : null}
            </GlassCard>

            {restEndsAt !== null ? (
              <div className="rest-bar" role="timer" aria-live="off">
                <Icon name="clock" size={20} />
                <span style={{ flex: 1 }}>Rest</span>
                <span className="rest-bar__value">{formatCountdown(restRemaining)}</span>
                <IconButton icon="close" label="Skip rest" size={17} onClick={stopRest} />
              </div>
            ) : null}

            <div className="wk__timer">
              <span className="wk__timerIcon" aria-hidden="true">
                <Icon name="spark" size={22} />
              </span>
              <div className="wk__timerBody">
                <div className="wk__timerValue">{formatClock(elapsed)}</div>
                <div className="wk__timerLabel">Workout Time</div>
              </div>
              <button
                type="button"
                className="wk__timerBtn"
                onClick={() => toggleWorkoutTimer(today)}
                disabled={workout.completed}
                aria-label={running ? 'Pause workout timer' : 'Start workout timer'}
              >
                <Icon name={running ? 'pause' : 'play'} size={21} filled={!running} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <SecondaryButton
                size="sm"
                iconLeft="rotate-ccw"
                onClick={() => resetWorkoutTimer(today)}
                disabled={workout.completed || elapsed === 0}
              >
                Reset timer
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                iconLeft="clock"
                onClick={() => startRest(restSeconds)}
                disabled={workout.completed}
              >
                Rest {restSeconds}s
              </SecondaryButton>
            </div>

            <div style={{ marginTop: 'var(--sp-4)' }}>
              <ProgressBar
                value={totalSets ? doneSets / totalSets : 0}
                label="Sets completed"
                size="sm"
              />
            </div>

            <div style={{ marginTop: 'var(--sp-4)' }}>
              {workout.completed ? (
                <SecondaryButton block onClick={() => reopenWorkout(today)}>
                  Reopen workout
                </SecondaryButton>
              ) : (
                <PrimaryButton block size="lg" onClick={onComplete}>
                  Complete Workout
                </PrimaryButton>
              )}
            </div>

            <Section title="Session notes">
              <GlassCard variant="soft">
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tap an exercise to open its sets. Log the reps and weight you actually hit, tick each
                  set as you finish it, and a rest timer starts automatically.
                </p>
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <Button variant="ghost" size="sm" iconLeft="chevron-left" onClick={pop}>
                    Back to today
                  </Button>
                </div>
              </GlassCard>
            </Section>
          </ScreenBody>
        </>
      )}

      <Modal
        open={renamingId !== null}
        onClose={() => setRenamingId(null)}
        title="Rename exercise"
        footer={
          <>
            <SecondaryButton onClick={() => setRenamingId(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={renameText.trim().length === 0}
              onClick={() => {
                if (renamingId) renameExercise(today, renamingId, renameText);
                setRenamingId(null);
              }}
            >
              Save
            </PrimaryButton>
          </>
        }
      >
        <Field
          label="Exercise name"
          value={renameText}
          maxLength={60}
          onChange={(e) => setRenameText(e.target.value)}
        />
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add exercise"
        description="It joins today's session only."
        footer={
          <>
            <SecondaryButton onClick={() => setAddOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={newName.trim().length === 0}
              onClick={() => {
                addExercise(today, newName, newSets, newReps);
                setNewName('');
                setNewSets(3);
                setNewReps('10');
                setAddOpen(false);
              }}
            >
              Add
            </PrimaryButton>
          </>
        }
      >
        <Field
          label="Exercise name"
          placeholder="e.g. Lateral Raise"
          value={newName}
          maxLength={60}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Field
          label="Target reps"
          placeholder="e.g. 12 or 30s"
          value={newReps}
          maxLength={12}
          onChange={(e) => setNewReps(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{ flex: 1 }}>Sets</span>
          <Stepper value={newSets} onChange={setNewSets} min={1} max={10} label="Sets" />
        </div>
      </Modal>
    </Screen>
  );
}

/* --------------------------------------------------------------- Row */

function ExerciseRow({
  exercise,
  expanded,
  locked,
  onToggleExpand,
  onToggleDone,
  onToggleSet,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onRename,
  onRemove,
}: {
  exercise: Exercise;
  expanded: boolean;
  locked: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onToggleSet: (setId: string) => void;
  onUpdateSet: (setId: string, patch: { reps?: number; weight?: number }) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const panelId = `sets-${exercise.id}`;

  return (
    <li>
      <div className="ex-row">
        <button
          type="button"
          className="ex-row__check"
          onClick={onToggleDone}
          disabled={locked}
          aria-pressed={exercise.done}
          aria-label={`Mark ${exercise.name} ${exercise.done ? 'incomplete' : 'complete'}`}
        >
          <CheckMark on={exercise.done} />
        </button>
        <button
          type="button"
          className="ex-row__name"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          style={{ textAlign: 'left' }}
        >
          <span className={exercise.done ? 'ex-row__name--done' : undefined}>{exercise.name}</span>
        </button>
        <span className="ex-row__target">
          {exercise.sets.length} &times; {exercise.targetReps}
        </span>
        <span className="ex-row__expand">
          <IconButton
            icon={expanded ? 'chevron-down' : 'chevron-right'}
            label={expanded ? `Hide sets for ${exercise.name}` : `Show sets for ${exercise.name}`}
            size={18}
            onClick={onToggleExpand}
          />
        </span>
      </div>

      {expanded ? (
        <div id={panelId} className="ex-sets">
          {exercise.sets.map((set, index) => (
            <div className="ex-set" key={set.id}>
              <button
                type="button"
                className="ex-set__index"
                onClick={() => onToggleSet(set.id)}
                disabled={locked}
                aria-label={`Set ${index + 1}, ${set.done ? 'done' : 'not done'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckMark on={set.done} small />
              </button>
              <label className="ex-set__field">
                <span className="sr-only">{`Set ${index + 1} reps for ${exercise.name}`}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  value={set.reps}
                  disabled={locked}
                  onChange={(e) => onUpdateSet(set.id, { reps: Number(e.target.value) })}
                />
                <span className="ex-set__unit">reps</span>
              </label>
              <label className="ex-set__field">
                <span className="sr-only">{`Set ${index + 1} weight for ${exercise.name}`}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={999}
                  step={0.5}
                  value={set.weight}
                  disabled={locked}
                  onChange={(e) => onUpdateSet(set.id, { weight: Number(e.target.value) })}
                />
                <span className="ex-set__unit">kg</span>
              </label>
              <IconButton
                icon="minus"
                label={`Remove set ${index + 1}`}
                size={16}
                disabled={locked || exercise.sets.length <= 1}
                onClick={() => onRemoveSet(set.id)}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            <Button variant="ghost" size="sm" iconLeft="plus" onClick={onAddSet} disabled={locked}>
              Add set
            </Button>
            <Button variant="ghost" size="sm" iconLeft="edit" onClick={onRename} disabled={locked}>
              Rename
            </Button>
            <Button variant="ghost" size="sm" iconLeft="trash" onClick={onRemove} disabled={locked}>
              Remove exercise
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
