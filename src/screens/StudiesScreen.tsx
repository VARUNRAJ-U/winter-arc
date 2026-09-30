import { useCallback, useEffect, useRef, useState } from 'react';
import { getAsset } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  CheckMark,
  EmptyState,
  Field,
  GlassCard,
  Icon,
  IconButton,
  Modal,
  PrimaryButton,
  ProgressBar,
  ProgressRing,
  SecondaryButton,
  SegmentedTabs,
  Section,
  TextAreaField,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useDay, useToday } from '@/store/selectors';
import { useChime, useCountdown, useWakeLock } from '@/hooks';
import { formatCountdown, formatDurationCompact } from '@/utils/format';
import { PILLAR_TAGLINES } from '@/domain/pillars';
import { relativeDayLabel } from '@/utils/date';
import type { StudyNote } from '@/models';
import './screens.css';

type Tab = 'focus' | 'tasks' | 'notes';

/** Shortest run that is worth recording as a session. */
const MIN_LOGGABLE_SECONDS = 30;

export function StudiesScreen() {
  const [tab, setTab] = useState<Tab>('focus');

  return (
    <Screen scrollKey={`studies-${tab}`}>
      <ScreenHeader title="Studies" subtitle={PILLAR_TAGLINES.studies} />
      <ScreenBody>
        <SegmentedTabs
          items={[
            { value: 'focus', label: 'Focus' },
            { value: 'tasks', label: 'Tasks' },
            { value: 'notes', label: 'Notes' },
          ]}
          value={tab}
          onChange={setTab}
          label="Studies view"
        />
      </ScreenBody>

      {tab === 'focus' ? <FocusTab /> : null}
      {tab === 'tasks' ? <TasksTab /> : null}
      {tab === 'notes' ? <NotesTab /> : null}
    </Screen>
  );
}

/* ---------------------------------------------------------------- Focus */

function FocusTab() {
  const today = useToday();
  const day = useDay(today);
  const goals = useAppStore((s) => s.goals);
  const logStudySession = useAppStore((s) => s.logStudySession);
  const removeStudySession = useAppStore((s) => s.removeStudySession);
  const pushToast = useAppStore((s) => s.pushToast);
  const chimeOn = useAppStore((s) => s.settings.focusMode.chimeOnComplete);
  const autoBreak = useAppStore((s) => s.settings.focusMode.autoStartBreaks);
  const keepAwake = useAppStore((s) => s.settings.focusMode.keepScreenAwake);

  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [deepWork, setDeepWork] = useState(true);
  const [noDistractions, setNoDistractions] = useState(true);

  const chime = useChime();
  const targetMinutes = mode === 'focus' ? goals.focusSessionMinutes : goals.breakMinutes;
  const totalSeconds = targetMinutes * 60;

  // Held in a ref so the completion callback never captures a stale value.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const onComplete = useCallback(() => {
    if (chimeOn) chime();
    if (modeRef.current === 'focus') {
      logStudySession(today, goals.focusSessionMinutes * 60, sessionLabel(day.studySessions.length), goals.focusSessionMinutes);
      pushToast('Focus session logged.', 'success');
      if (autoBreak) setMode('break');
    } else {
      pushToast('Break over. Back to it.', 'info');
      setMode('focus');
    }
  }, [chime, chimeOn, logStudySession, today, goals.focusSessionMinutes, day.studySessions.length, pushToast, autoBreak]);

  const timer = useCountdown(totalSeconds, onComplete);
  useWakeLock(keepAwake && timer.running);

  const sessions = day.studySessions;
  const sessionsDone = sessions.length;
  const target = goals.studySessionsPerDay;
  const totalMinutes = Math.round(sessions.reduce((s, x) => s + x.seconds, 0) / 60);
  const art = getAsset('snowMountains');
  const progress = totalSeconds > 0 ? 1 - timer.remaining / totalSeconds : 0;

  const logPartial = () => {
    const elapsed = totalSeconds - timer.remaining;
    if (elapsed < MIN_LOGGABLE_SECONDS) {
      pushToast(`Run at least ${MIN_LOGGABLE_SECONDS} seconds before logging.`, 'warning');
      return;
    }
    logStudySession(today, elapsed, sessionLabel(sessions.length), targetMinutes);
    timer.reset(totalSeconds);
    pushToast(`Logged ${formatDurationCompact(elapsed / 60)}.`, 'success');
  };

  return (
    <>
      <section className="focus">
        <div className="focus__art" aria-hidden="true">
          <img src={art.src} alt="" loading="lazy" decoding="async" />
          <span className="focus__scrim" />
        </div>
        <div className="focus__inner">
          <div className="focus__ring">
            <ProgressRing
              value={progress}
              size={228}
              thickness={9}
              label={`${mode === 'focus' ? 'Focus' : 'Break'} session progress`}
            >
              <div>
                <div className="focus__value">{formatCountdown(timer.remaining)}</div>
                <div className="focus__label">{mode === 'focus' ? 'Focus Session' : 'Break'}</div>
              </div>
            </ProgressRing>
          </div>

          <div className="focus__controls">
            <button
              type="button"
              className="focus__side"
              onClick={() => timer.reset(totalSeconds)}
              aria-label="Reset timer"
            >
              <Icon name="rotate-ccw" size={20} />
            </button>
            <button
              type="button"
              className="focus__play"
              onClick={() => (timer.running ? timer.pause() : timer.start())}
              aria-label={timer.running ? 'Pause session' : 'Start session'}
            >
              <Icon name={timer.running ? 'pause' : 'play'} size={27} filled={!timer.running} />
            </button>
            <button
              type="button"
              className="focus__side"
              onClick={() => timer.addSeconds(300)}
              aria-label="Add five minutes"
            >
              <Icon name="rotate-cw" size={20} />
            </button>
          </div>
        </div>
      </section>

      <ScreenBody>
        <div className="focus__modes">
          <button
            type="button"
            className="focus__mode"
            aria-pressed={deepWork}
            onClick={() => setDeepWork(!deepWork)}
          >
            <Icon name="edit" size={17} />
            Deep Work
          </button>
          <button
            type="button"
            className="focus__mode"
            aria-pressed={noDistractions}
            onClick={() => setNoDistractions(!noDistractions)}
          >
            <Icon name="shield" size={17} />
            No Distractions
          </button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <SecondaryButton size="sm" onClick={logPartial} disabled={timer.remaining >= totalSeconds}>
            Log partial session
          </SecondaryButton>
          <SecondaryButton
            size="sm"
            onClick={() => {
              setMode(mode === 'focus' ? 'break' : 'focus');
            }}
          >
            Switch to {mode === 'focus' ? 'break' : 'focus'}
          </SecondaryButton>
        </div>

        <Section title="Today's Sessions" meta={`${sessionsDone}/${target}`}>
          <GlassCard>
            <ProgressBar
              value={target ? sessionsDone / target : 0}
              size="sm"
              label="Focus sessions completed"
            />
            <div style={{ marginTop: 'var(--sp-4)' }}>
              {sessions.length === 0 ? (
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                  No sessions yet today. Start the timer above.
                </p>
              ) : (
                <ul>
                  {sessions.map((s) => (
                    <li className="session-row" key={s.id}>
                      <CheckMark on small />
                      <span className="session-row__label">{s.label}</span>
                      <span className="session-row__len">{formatDurationCompact(s.seconds / 60)}</span>
                      <IconButton
                        icon="trash"
                        label={`Remove ${s.label}`}
                        size={16}
                        onClick={() => removeStudySession(today, s.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 'var(--sp-4)' }}>
              Total studied today: <strong>{formatDurationCompact(totalMinutes)}</strong>
            </p>
          </GlassCard>
        </Section>
      </ScreenBody>
    </>
  );
}

function sessionLabel(index: number): string {
  const names = ['Morning Session', 'Midday Session', 'Afternoon Session', 'Evening Session', 'Late Session'];
  return names[index] ?? `Session ${index + 1}`;
}

/* ---------------------------------------------------------------- Tasks */

function TasksTab() {
  const tasks = useAppStore((s) => s.tasks);
  const addTask = useAppStore((s) => s.addTask);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const removeTask = useAppStore((s) => s.removeTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const today = useToday();

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim().length === 0) return;
    addTask(draft);
    setDraft('');
  };

  return (
    <ScreenBody>
      <form onSubmit={submit} style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
        <label style={{ flex: 1, minWidth: 0 }}>
          <span className="sr-only">New task</span>
          <input
            value={draft}
            placeholder="Add a task"
            maxLength={140}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <PrimaryButton type="submit" disabled={draft.trim().length === 0} aria-label="Add task">
          <Icon name="plus" size={19} />
        </PrimaryButton>
      </form>

      <Section title="Open" meta={`${open.length}`}>
        <GlassCard>
          {open.length === 0 ? (
            <EmptyState icon="check" title="Nothing open" description="Every task is done. Add the next one above." />
          ) : (
            <ul>
              {open.map((t) => (
                <li className="task" key={t.id}>
                  <button
                    type="button"
                    className="task__btn"
                    onClick={() => toggleTask(t.id)}
                    aria-pressed={t.done}
                  >
                    <CheckMark on={t.done} small />
                    <span>
                      <span className="task__title">{t.title}</span>
                      {t.dueDate ? (
                        <span className="task__due">Due {relativeDayLabel(t.dueDate, today)}</span>
                      ) : null}
                    </span>
                  </button>
                  <IconButton
                    icon="edit"
                    label={`Edit ${t.title}`}
                    size={16}
                    onClick={() => {
                      setEditingId(t.id);
                      setEditText(t.title);
                    }}
                  />
                  <IconButton icon="trash" label={`Delete ${t.title}`} size={16} onClick={() => removeTask(t.id)} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </Section>

      {done.length > 0 ? (
        <Section title="Completed" meta={`${done.length}`}>
          <GlassCard variant="soft">
            <ul>
              {done.map((t) => (
                <li className="task" key={t.id}>
                  <button type="button" className="task__btn" onClick={() => toggleTask(t.id)} aria-pressed>
                    <CheckMark on small />
                    <span className="task__title task__title--done">{t.title}</span>
                  </button>
                  <IconButton icon="trash" label={`Delete ${t.title}`} size={16} onClick={() => removeTask(t.id)} />
                </li>
              ))}
            </ul>
          </GlassCard>
        </Section>
      ) : null}

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit task"
        footer={
          <>
            <SecondaryButton onClick={() => setEditingId(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={editText.trim().length === 0}
              onClick={() => {
                if (editingId) updateTask(editingId, { title: editText.trim() });
                setEditingId(null);
              }}
            >
              Save
            </PrimaryButton>
          </>
        }
      >
        <Field label="Task" value={editText} maxLength={140} onChange={(e) => setEditText(e.target.value)} />
      </Modal>
    </ScreenBody>
  );
}

/* ---------------------------------------------------------------- Notes */

function NotesTab() {
  const notes = useAppStore((s) => s.notes);
  const addNote = useAppStore((s) => s.addNote);
  const updateNote = useAppStore((s) => s.updateNote);
  const removeNote = useAppStore((s) => s.removeNote);

  const [editing, setEditing] = useState<StudyNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setBody(editing.body);
    } else if (creating) {
      setTitle('');
      setBody('');
    }
  }, [editing, creating]);

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = () => {
    if (editing) updateNote(editing.id, { title: title.trim() || 'Untitled note', body });
    else addNote(title, body);
    close();
  };

  return (
    <ScreenBody>
      <div style={{ marginTop: 'var(--sp-4)' }}>
        <PrimaryButton block iconLeft="plus" onClick={() => setCreating(true)}>
          New note
        </PrimaryButton>
      </div>

      <div style={{ marginTop: 'var(--sp-4)' }}>
        {notes.length === 0 ? (
          <GlassCard variant="soft">
            <EmptyState
              icon="note"
              title="No notes yet"
              description="Capture what you learned, what tripped you up, and what to revisit."
            />
          </GlassCard>
        ) : (
          notes.map((n) => (
            <GlassCard key={n.id} className="note-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
                <button
                  type="button"
                  style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
                  onClick={() => setEditing(n)}
                  aria-label={`Open note ${n.title}`}
                >
                  <span className="note-card__title">{n.title}</span>
                  {n.body ? <span className="note-card__body">{n.body}</span> : null}
                  <span className="note-card__meta">
                    Updated {new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </button>
                <IconButton
                  icon="trash"
                  label={`Delete note ${n.title}`}
                  size={17}
                  onClick={() => {
                    if (window.confirm(`Delete "${n.title}"?`)) removeNote(n.id);
                  }}
                />
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <Modal
        open={editing !== null || creating}
        onClose={close}
        title={editing ? 'Edit note' : 'New note'}
        footer={
          <>
            <SecondaryButton onClick={close}>Cancel</SecondaryButton>
            <PrimaryButton onClick={save} disabled={title.trim().length === 0 && body.trim().length === 0}>
              Save
            </PrimaryButton>
          </>
        }
      >
        <Field label="Title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Note" value={body} rows={8} onChange={setBody} />
      </Modal>
    </ScreenBody>
  );
}
