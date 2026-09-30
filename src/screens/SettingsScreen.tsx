import { useRef, useState } from 'react';
import { assets, getAsset, type AssetKey } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  Button,
  Field,
  GlassCard,
  Icon,
  ListRow,
  Modal,
  PrimaryButton,
  SecondaryButton,
  Section,
  Stepper,
  ToggleRow,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useNavigationStore, type ScreenKey } from '@/store/navigationStore';
import { useQuoteUnlocked, useRank, useRewards, useTotalXp } from '@/store/selectors';
import { isRewardUnlocked } from '@/domain/rank';
import { quoteForDate } from '@/services/quotes';
import { isStorageDurable } from '@/services/storage';
import { ARC_LENGTH, formatLongDate, isValidISODate, todayISO } from '@/utils/date';
import { formatNumber } from '@/utils/format';
import type { AccentTheme } from '@/models';
import './screens.css';

/** Artworks offered as a profile picture. */
const AVATAR_CHOICES: AssetKey[] = [
  'mountaineer',
  'summitClimber',
  'snowMountains',
  'mountainJourney',
  'rankEmblem',
  'workout',
];

const ACCENTS: { value: AccentTheme; label: string; color: string }[] = [
  { value: 'arctic', label: 'Arctic Blue', color: 'linear-gradient(135deg,#bfe9ff,#2f8fff)' },
  { value: 'aurora', label: 'Aurora', color: 'linear-gradient(135deg,#c8fff0,#3fb6f5)' },
  { value: 'ember', label: 'Ember', color: 'linear-gradient(135deg,#ffe6cf,#ff7a59)' },
  { value: 'violet', label: 'Violet', color: 'linear-gradient(135deg,#e4dcff,#7c6af0)' },
];

/* ------------------------------------------------------------- Root menu */

export function SettingsScreen() {
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const push = useNavigationStore((s) => s.push);
  const rank = useRank();
  const xp = useTotalXp();
  const bonusQuotes = useQuoteUnlocked();
  const framed = isRewardUnlocked(xp, 'profile-frame');
  const art = getAsset((profile?.avatarAsset as AssetKey) ?? 'mountaineer');

  const go = (screen: ScreenKey) => () => push(screen);

  return (
    <Screen scrollKey="settings">
      <ScreenHeader title="Settings" subtitle="Customise Your Journey" back={false} />

      <ScreenBody>
        <GlassCard>
          <button type="button" className="set__profile" onClick={go('settings-profile')}>
            <span className={`set__avatar${framed ? ' set__avatar--framed' : ''}`}>
              <img src={art.src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            </span>
            <span className="set__profileBody">
              <span className="set__profileName">{profile?.name ?? 'Athlete'}</span>
              <span className="set__profileMeta">
                {rank.tier.name} &middot; Level {rank.level}
              </span>
              <span className="set__profileXp">{formatNumber(xp)} XP</span>
            </span>
            <Icon name="chevron-right" size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </GlassCard>

        <GlassCard style={{ marginTop: 'var(--sp-4)' }}>
          <ListRow icon="target" title="Goals & Preferences" onClick={go('settings-goals')} />
          <ListRow
            icon="bell"
            title="Notifications"
            value={settings.notifications.enabled ? 'On' : 'Off'}
            onClick={go('settings-notifications')}
          />
          <ListRow
            icon="palette"
            title="Appearance"
            value={ACCENTS.find((a) => a.value === settings.appearance.accent)?.label}
            onClick={go('settings-appearance')}
          />
          <ListRow icon="focus" title="Focus Mode" onClick={go('settings-focus')} />
          <ListRow icon="grid" title="Widgets" onClick={go('settings-widgets')} />
          <ListRow icon="shield" title="Data & Privacy" onClick={go('settings-data')} />
          <ListRow icon="help" title="Help & Support" onClick={go('settings-help')} />
        </GlassCard>

        <GlassCard style={{ marginTop: 'var(--sp-4)' }}>
          <ListRow icon="bar-chart" title="Momentum" description="Statistics and trends" onClick={go('momentum')} />
        </GlassCard>

        <p className="set__quote">&ldquo;{quoteForDate(todayISO(), bonusQuotes, 4)}&rdquo;</p>
      </ScreenBody>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Profile */

export function ProfileSettingsScreen() {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const pushToast = useAppStore((s) => s.pushToast);
  const xp = useTotalXp();
  const rank = useRank();

  const [name, setName] = useState(profile?.name ?? '');
  const [startDate, setStartDate] = useState(profile?.startDate ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const framed = isRewardUnlocked(xp, 'profile-frame');
  const currentAvatar = (profile?.avatarAsset as AssetKey) ?? 'mountaineer';

  const save = () => {
    if (name.trim().length === 0) {
      setError('Your name cannot be empty.');
      return;
    }
    if (!isValidISODate(startDate)) {
      setError('Choose a valid start date.');
      return;
    }
    updateProfile({ name: name.trim(), startDate });
    setError(null);
    pushToast('Profile updated.', 'success');
  };

  const changed = name !== (profile?.name ?? '') || startDate !== (profile?.startDate ?? '');

  return (
    <Screen scrollKey="settings-profile">
      <ScreenHeader title="Profile" subtitle="Who is climbing" />
      <ScreenBody>
        <GlassCard>
          <div style={{ display: 'grid', justifyItems: 'center', marginBottom: 'var(--sp-5)' }}>
            <span
              className={`set__avatar${framed ? ' set__avatar--framed' : ''}`}
              style={{ width: 92, height: 92 }}
            >
              <img src={getAsset(currentAvatar).src} alt="" aria-hidden="true" />
            </span>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
              {framed ? 'Frame unlocked at Level 5' : 'Reach Level 5 to unlock the frame'}
            </p>
          </div>

          <div className="field">
            <span className="field__label">Profile picture</span>
            <div className="avatar-grid" role="group" aria-label="Profile picture">
              {AVATAR_CHOICES.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="avatar-choice"
                  aria-pressed={currentAvatar === key}
                  aria-label={assets[key].alt}
                  onClick={() => updateProfile({ avatarAsset: key })}
                >
                  <img src={assets[key].src} alt="" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Name"
            value={name}
            maxLength={40}
            error={error && name.trim().length === 0 ? error : null}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Arc start date"
            type="date"
            value={startDate}
            hint={`Day 1 of your ${ARC_LENGTH}-day arc. Changing this re-dates your whole history.`}
            error={error && !isValidISODate(startDate) ? error : null}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <PrimaryButton block disabled={!changed} onClick={save}>
            Save changes
          </PrimaryButton>
        </GlassCard>

        <Section title="Standing">
          <GlassCard variant="soft">
            <ListRow title="Rank" value={rank.tier.name} chevron={false} />
            <ListRow title="Level" value={String(rank.level)} chevron={false} />
            <ListRow title="Total XP" value={formatNumber(xp)} chevron={false} />
            <ListRow
              title="Started"
              value={profile ? formatLongDate(profile.startDate) : '--'}
              chevron={false}
            />
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

/* ------------------------------------------------------------------ Goals */

export function GoalsSettingsScreen() {
  const goals = useAppStore((s) => s.goals);
  const updateGoals = useAppStore((s) => s.updateGoals);

  return (
    <Screen scrollKey="settings-goals">
      <ScreenHeader title="Goals & Preferences" subtitle="What a complete day means" />
      <ScreenBody>
        <Section title="Daily targets">
          <GlassCard>
            <GoalStepper
              label="Meals per day"
              value={goals.mealsPerDay}
              min={1}
              max={6}
              onChange={(v) => updateGoals({ mealsPerDay: v })}
            />
            <GoalStepper
              label="Focus sessions per day"
              value={goals.studySessionsPerDay}
              min={1}
              max={8}
              onChange={(v) => updateGoals({ studySessionsPerDay: v })}
            />
            <GoalStepper
              label="Sleep target"
              value={goals.sleepTargetHours}
              min={5}
              max={12}
              step={0.5}
              format={(v) => `${v}h`}
              onChange={(v) => updateGoals({ sleepTargetHours: v })}
            />
          </GlassCard>
        </Section>

        <Section title="Timers">
          <GlassCard>
            <GoalStepper
              label="Focus session length"
              value={goals.focusSessionMinutes}
              min={10}
              max={120}
              step={5}
              format={(v) => `${v}m`}
              onChange={(v) => updateGoals({ focusSessionMinutes: v })}
            />
            <GoalStepper
              label="Break length"
              value={goals.breakMinutes}
              min={3}
              max={30}
              step={1}
              format={(v) => `${v}m`}
              onChange={(v) => updateGoals({ breakMinutes: v })}
            />
            <GoalStepper
              label="Rest between sets"
              value={goals.restSeconds}
              min={30}
              max={300}
              step={15}
              format={(v) => `${v}s`}
              onChange={(v) => updateGoals({ restSeconds: v })}
            />
          </GlassCard>
        </Section>

        <Section title="Nutrition targets">
          <GlassCard>
            <GoalStepper
              label="Daily calories"
              value={goals.calorieTarget}
              min={1200}
              max={5000}
              step={50}
              format={(v) => formatNumber(v)}
              onChange={(v) => updateGoals({ calorieTarget: v })}
            />
            <GoalStepper
              label="Daily protein"
              value={goals.proteinTarget}
              min={40}
              max={400}
              step={5}
              format={(v) => `${v}g`}
              onChange={(v) => updateGoals({ proteinTarget: v })}
            />
          </GlassCard>
        </Section>

        <Section title="Schedule">
          <GlassCard>
            <div className="field-row">
              <Field
                label="Default bed time"
                type="time"
                value={goals.bedTime}
                onChange={(e) => updateGoals({ bedTime: e.target.value || goals.bedTime })}
              />
              <Field
                label="Default wake time"
                type="time"
                value={goals.wakeTime}
                onChange={(e) => updateGoals({ wakeTime: e.target.value || goals.wakeTime })}
              />
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              These pre-fill the sleep tracker. Changing a daily target immediately re-evaluates today,
              including the XP it has earned.
            </p>
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function GoalStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <div
      className="toggle-row"
      style={{ cursor: 'default' }}
    >
      <span className="toggle-row__text">
        <span className="toggle-row__title">{label}</span>
      </span>
      <Stepper value={value} onChange={onChange} min={min} max={max} step={step} label={label} format={format} />
    </div>
  );
}

/* ---------------------------------------------------------- Notifications */

export function NotificationSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const n = settings.notifications;

  return (
    <Screen scrollKey="settings-notifications">
      <ScreenHeader title="Notifications" subtitle="When the app should nudge you" />
      <ScreenBody>
        <GlassCard>
          <ToggleRow
            title="Notifications"
            description="Master switch for every reminder."
            checked={n.enabled}
            onChange={(v) => updateSettings({ notifications: { enabled: v } })}
          />
          <ToggleRow
            title="Daily reminder"
            description="A morning nudge to secure the day."
            checked={n.dailyReminder}
            disabled={!n.enabled}
            onChange={(v) => updateSettings({ notifications: { dailyReminder: v } })}
          />
          <ToggleRow
            title="Streak alerts"
            description="Warn when a streak is about to break."
            checked={n.streakAlerts}
            disabled={!n.enabled}
            onChange={(v) => updateSettings({ notifications: { streakAlerts: v } })}
          />
          <ToggleRow
            title="Milestone alerts"
            description="Celebrate days 30, 60 and 90."
            checked={n.milestoneAlerts}
            disabled={!n.enabled}
            onChange={(v) => updateSettings({ notifications: { milestoneAlerts: v } })}
          />
        </GlassCard>

        <Section title="Reminder time">
          <GlassCard>
            <Field
              label="Send the daily reminder at"
              type="time"
              value={n.reminderTime}
              disabled={!n.enabled || !n.dailyReminder}
              onChange={(e) => updateSettings({ notifications: { reminderTime: e.target.value || n.reminderTime } })}
            />
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Winter Arc runs entirely on your device and does not send push notifications from a
              server. These preferences are stored and applied by the in-app reminder banner.
            </p>
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

/* ------------------------------------------------------------- Appearance */

export function AppearanceSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setAccent = useAppStore((s) => s.setAccent);
  const pushToast = useAppStore((s) => s.pushToast);
  const rewards = useRewards();
  const themesUnlocked = rewards.find((r) => r.id === 'theme-pack')?.unlocked ?? false;

  return (
    <Screen scrollKey="settings-appearance">
      <ScreenHeader title="Appearance" subtitle="How Winter Arc looks" />
      <ScreenBody>
        <Section title="Accent">
          <GlassCard>
            <div className="accent-grid">
              {ACCENTS.map((a) => {
                const locked = a.value !== 'arctic' && !themesUnlocked;
                return (
                  <button
                    key={a.value}
                    type="button"
                    className="accent-swatch"
                    aria-pressed={settings.appearance.accent === a.value}
                    onClick={() => {
                      if (locked) {
                        pushToast('Reach Level 3 to unlock more themes.', 'warning');
                        return;
                      }
                      setAccent(a.value);
                    }}
                  >
                    <span
                      className="accent-swatch__dot"
                      style={{ background: a.color, opacity: locked ? 0.35 : 1 }}
                      aria-hidden="true"
                    />
                    {locked ? 'Locked' : a.label}
                  </button>
                );
              })}
            </div>
            {!themesUnlocked ? (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)' }}>
                Extra accents unlock at Level 3.
              </p>
            ) : null}
          </GlassCard>
        </Section>

        <Section title="Display">
          <GlassCard>
            <ToggleRow
              title="High contrast"
              description="Brighter text and stronger borders."
              checked={settings.appearance.highContrast}
              onChange={(v) => updateSettings({ appearance: { highContrast: v } })}
            />
            <ToggleRow
              title="Reduce motion"
              description="Turn off drift, glow pulses and snowfall."
              checked={settings.appearance.reduceMotion}
              onChange={(v) => updateSettings({ appearance: { reduceMotion: v } })}
            />
            <ToggleRow
              title="Ambient effects"
              description="Snowfall and the breathing halo behind rings."
              checked={settings.appearance.ambientEffects}
              onChange={(v) => updateSettings({ appearance: { ambientEffects: v } })}
            />
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

/* ------------------------------------------------------------- Focus Mode */

export function FocusSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const f = settings.focusMode;

  return (
    <Screen scrollKey="settings-focus">
      <ScreenHeader title="Focus Mode" subtitle="How sessions behave" />
      <ScreenBody>
        <GlassCard>
          <ToggleRow
            title="Hide completed pillars"
            description="Keep the Today list down to what is left."
            checked={f.hideCompleted}
            onChange={(v) => updateSettings({ focusMode: { hideCompleted: v } })}
          />
          <ToggleRow
            title="Keep screen awake"
            description="Hold the screen on while a timer runs."
            checked={f.keepScreenAwake}
            onChange={(v) => updateSettings({ focusMode: { keepScreenAwake: v } })}
          />
          <ToggleRow
            title="Chime on completion"
            description="A short tone when a timer finishes."
            checked={f.chimeOnComplete}
            onChange={(v) => updateSettings({ focusMode: { chimeOnComplete: v } })}
          />
          <ToggleRow
            title="Auto-start breaks"
            description="Roll straight into a break after each focus session."
            checked={f.autoStartBreaks}
            onChange={(v) => updateSettings({ focusMode: { autoStartBreaks: v } })}
          />
        </GlassCard>
      </ScreenBody>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Widgets */

export function WidgetSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const w = settings.widgets;

  return (
    <Screen scrollKey="settings-widgets">
      <ScreenHeader title="Widgets" subtitle="What appears on your dashboard" />
      <ScreenBody>
        <GlassCard>
          <ToggleRow
            title="Daily quote"
            description="Show the rotating quote card."
            checked={w.showQuote}
            onChange={(v) => updateSettings({ widgets: { showQuote: v } })}
          />
          <ToggleRow
            title="Streak card"
            description="Show your current streak on the dashboard."
            checked={w.showStreak}
            onChange={(v) => updateSettings({ widgets: { showStreak: v } })}
          />
          <ToggleRow
            title="Next milestone"
            description="Show the next milestone on the Journey tab."
            checked={w.showNextMilestone}
            onChange={(v) => updateSettings({ widgets: { showNextMilestone: v } })}
          />
          <ToggleRow
            title="Macro summary"
            description="Show macros on each meal card."
            checked={w.showMacros}
            onChange={(v) => updateSettings({ widgets: { showMacros: v } })}
          />
        </GlassCard>
      </ScreenBody>
    </Screen>
  );
}

/* ----------------------------------------------------------- Data privacy */

export function DataSettingsScreen() {
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const resetAll = useAppStore((s) => s.resetAll);
  const resetProgressOnly = useAppStore((s) => s.resetProgressOnly);
  const pushToast = useAppStore((s) => s.pushToast);
  const days = useAppStore((s) => s.days);
  const ledger = useAppStore((s) => s.xpLedger);
  const reset = useNavigationStore((s) => s.reset);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const download = () => {
    try {
      const blob = new Blob([exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `winter-arc-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast('Export downloaded.', 'success');
    } catch {
      pushToast('Export failed on this device.', 'warning');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (importData(text)) {
        pushToast('Data imported.', 'success');
        reset();
      } else {
        pushToast('That file is not a Winter Arc export.', 'warning');
      }
    } catch {
      pushToast('That file could not be read.', 'warning');
    }
  };

  return (
    <Screen scrollKey="settings-data">
      <ScreenHeader title="Data & Privacy" subtitle="Your records stay on this device" />
      <ScreenBody>
        <GlassCard>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Winter Arc stores everything locally in your browser. Nothing is uploaded, there is no
            account, and no analytics are collected.
          </p>
          <div style={{ marginTop: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-2)' }}>
            <ListRow title="Days recorded" value={formatNumber(Object.keys(days).length)} chevron={false} />
            <ListRow title="XP entries" value={formatNumber(ledger.length)} chevron={false} />
            <ListRow
              title="Storage"
              value={isStorageDurable() ? 'Saved on device' : 'This session only'}
              chevron={false}
            />
          </div>
        </GlassCard>

        <Section title="Backup">
          <GlassCard>
            <SecondaryButton block iconLeft="download" onClick={download}>
              Export my data
            </SecondaryButton>
            <div style={{ height: 'var(--sp-3)' }} />
            <SecondaryButton block iconLeft="upload" onClick={() => fileRef.current?.click()}>
              Import from a file
            </SecondaryButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </GlassCard>
        </Section>

        <Section title="Danger zone">
          <GlassCard>
            <Button
              variant="danger"
              block
              onClick={() => {
                if (window.confirm('Clear all daily records and XP but keep your profile and goals?')) {
                  resetProgressOnly();
                  pushToast('Progress cleared.', 'info');
                }
              }}
            >
              Clear progress only
            </Button>
            <div style={{ height: 'var(--sp-3)' }} />
            <Button variant="danger" block onClick={() => setConfirmReset(true)}>
              Delete everything
            </Button>
          </GlassCard>
        </Section>
      </ScreenBody>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Delete everything?"
        description="Your profile, goals, history and XP will be permanently removed from this device. This cannot be undone."
        footer={
          <>
            <SecondaryButton onClick={() => setConfirmReset(false)}>Cancel</SecondaryButton>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReset(false);
                resetAll();
                reset();
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          Export your data first if you want a copy.
        </p>
      </Modal>
    </Screen>
  );
}

/* ------------------------------------------------------------------- Help */

export function HelpSettingsScreen() {
  const [open, setOpen] = useState<string | null>(null);

  const faqs = [
    {
      id: 'complete',
      q: 'What counts as a complete day?',
      a: 'All four pillars hit their daily target: the workout marked complete, your meal count reached, your focus sessions logged, and sleep at or above your target. Targets live in Goals and Preferences.',
    },
    {
      id: 'xp',
      q: 'Why did my XP go down?',
      a: 'XP is recalculated from your records rather than added up as you go. If you undo a completed pillar or raise a target, the XP that pillar earned is withdrawn. That is also why XP can never be awarded twice.',
    },
    {
      id: 'missed',
      q: 'I missed a day. Is my arc ruined?',
      a: 'No. The arc always runs 90 days from your start date. A missed day breaks the current streak but your longest streak, total XP and rank are all kept.',
    },
    {
      id: 'backdate',
      q: 'Can I start from an earlier date?',
      a: 'Yes. Set your arc start date in Profile. Days between that date and today become part of your history and appear as missed until you log them.',
    },
    {
      id: 'offline',
      q: 'Does it work offline?',
      a: 'Yes. Everything runs on your device with no network calls, so workouts, meals, focus sessions and sleep all work with no connection.',
    },
  ];

  return (
    <Screen scrollKey="settings-help">
      <ScreenHeader title="Help & Support" subtitle="How the arc works" />
      <ScreenBody>
        <GlassCard>
          {faqs.map((f) => (
            <div key={f.id}>
              <button
                type="button"
                className="list-row"
                aria-expanded={open === f.id}
                onClick={() => setOpen(open === f.id ? null : f.id)}
              >
                <span className="list-row__body">
                  <span className="list-row__title">{f.q}</span>
                </span>
                <span className="list-row__chev" aria-hidden="true">
                  <Icon name={open === f.id ? 'chevron-down' : 'chevron-right'} size={18} />
                </span>
              </button>
              {open === f.id ? (
                <p
                  style={{
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    padding: '0 0 var(--sp-4)',
                  }}
                >
                  {f.a}
                </p>
              ) : null}
            </div>
          ))}
        </GlassCard>

        <Section title="About">
          <GlassCard variant="soft">
            <ListRow title="Winter Arc" value="Version 1.0.0" chevron={false} />
            <ListRow title="Arc length" value={`${ARC_LENGTH} days`} chevron={false} />
            <ListRow title="Pillars" value="Workout, Diet, Studies, Sleep" chevron={false} />
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
