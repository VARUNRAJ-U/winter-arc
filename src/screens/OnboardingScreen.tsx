import { useState } from 'react';
import { getAsset } from '@/assets';
import {
  Field,
  Icon,
  PrimaryButton,
  SecondaryButton,
  Stepper,
  ToggleRow,
  type IconName,
} from '@/components/ui';
import { goalPresets, type GoalPresetId } from '@/services/defaults';
import { useAppStore } from '@/store/appStore';
import { isValidISODate, todayISO } from '@/utils/date';
import type { Goals } from '@/models';
import './screens.css';

interface Feature {
  icon: IconName;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  { icon: 'target', title: '4 Core Pillars', description: 'Build a balanced, unbreakable you' },
  { icon: 'clock', title: 'Daily Progress', description: 'Small steps. Massive change.' },
  { icon: 'flag', title: '90 Day Transformation', description: 'Discipline compounds.' },
];

type StepIndex = 0 | 1 | 2 | 3;
const STEP_COUNT = 4;

export function OnboardingScreen({ onBack }: { onBack: () => void }) {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const pushToast = useAppStore((s) => s.pushToast);

  const [step, setStep] = useState<StepIndex>(0);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [dateError, setDateError] = useState<string | null>(null);
  const [preset, setPreset] = useState<GoalPresetId>('balanced');
  const [focusMinutes, setFocusMinutes] = useState(50);
  const [sleepHours, setSleepHours] = useState(8);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [studySessions, setStudySessions] = useState(2);
  const [notifications, setNotifications] = useState(true);
  const [ambient, setAmbient] = useState(true);

  const art = getAsset('snowMountains');

  const applyPreset = (id: GoalPresetId) => {
    setPreset(id);
    const found = goalPresets.find((p) => p.id === id);
    if (!found) return;
    setMealsPerDay(found.goals.mealsPerDay);
    setStudySessions(found.goals.studySessionsPerDay);
    setSleepHours(found.goals.sleepTargetHours);
  };

  const validateStep1 = (): boolean => {
    let ok = true;
    if (name.trim().length === 0) {
      setNameError('Tell us what to call you.');
      ok = false;
    } else {
      setNameError(null);
    }
    if (!isValidISODate(startDate)) {
      setDateError('Choose a valid start date.');
      ok = false;
    } else {
      setDateError(null);
    }
    return ok;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    if (step < STEP_COUNT - 1) setStep((step + 1) as StepIndex);
    else finish();
  };

  const back = () => {
    if (step === 0) onBack();
    else setStep((step - 1) as StepIndex);
  };

  const finish = () => {
    const goals: Partial<Goals> = {
      mealsPerDay,
      studySessionsPerDay: studySessions,
      focusSessionMinutes: focusMinutes,
      sleepTargetHours: sleepHours,
    };
    updateSettings({
      notifications: { enabled: notifications, dailyReminder: notifications },
      appearance: { ambientEffects: ambient },
    });
    completeOnboarding({ name, startDate }, goals);
    pushToast('Your Winter Arc has begun.', 'success');
  };

  const skip = () => {
    completeOnboarding({ name: name.trim() || 'Athlete', startDate: todayISO() }, {});
    pushToast('Defaults applied. You can change everything in Settings.', 'info');
  };

  return (
    <div className="onb">
      <div className="onb__art" aria-hidden="true">
        <img src={art.src} alt="" fetchPriority="high" decoding="async" />
        <span className="onb__scrim" />
      </div>

      <div className="onb__top">
        <button type="button" className="sheader__back" onClick={back} aria-label="Go back">
          <Icon name="chevron-left" size={21} />
        </button>
        <button type="button" className="onb__skip" onClick={skip}>
          Skip
        </button>
      </div>

      <div className="onb__scroll">
        <div className="onb__spacer" />

        {step === 0 ? (
          <div key="s0" className="wa-enter">
            <h1 className="onb__title">
              More Than Habits
              <br />
              A New Standard
            </h1>
            <p className="onb__lede">
              The Winter Arc is a focused 90-day journey to build discipline, eliminate distractions
              and become the strongest version of yourself.
            </p>
            <ul className="onb__features">
              {FEATURES.map((f, i) => (
                <li key={f.title} className={`onb__feature wa-enter wa-enter-${i + 2}`}>
                  <span className="onb__featureIcon" aria-hidden="true">
                    <Icon name={f.icon} size={24} />
                  </span>
                  <span>
                    <span className="onb__featureTitle">{f.title}</span>
                    <span className="onb__featureDesc">{f.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <div key="s1" className="wa-enter">
            <h1 className="onb__title">
              Who is
              <br />
              climbing?
            </h1>
            <p className="onb__lede">
              Your name appears across the app, and the start date sets Day 1 of your arc.
            </p>
            <div className="onb__form">
              <Field
                label="Your name"
                placeholder="e.g. Alex"
                value={name}
                error={nameError}
                autoComplete="given-name"
                maxLength={40}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
              />
              <Field
                label="Arc start date"
                type="date"
                value={startDate}
                error={dateError}
                hint="Start today, or backdate to a day you already began."
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (dateError) setDateError(null);
                }}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div key="s2" className="wa-enter">
            <h1 className="onb__title">
              Set your
              <br />
              standard
            </h1>
            <p className="onb__lede">Pick a starting shape. Every number stays editable later.</p>

            <div className="onb__presets">
              {goalPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="onb__preset"
                  aria-pressed={preset === p.id}
                  onClick={() => applyPreset(p.id)}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="onb__presetName">{p.name}</span>
                    <span className="onb__presetDesc">{p.description}</span>
                  </span>
                  {preset === p.id ? <Icon name="check" size={20} /> : null}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 'var(--sp-6)', display: 'grid', gap: 'var(--sp-4)' }}>
              <StepperRow label="Meals per day" value={mealsPerDay} min={1} max={6} onChange={setMealsPerDay} />
              <StepperRow
                label="Focus sessions per day"
                value={studySessions}
                min={1}
                max={8}
                onChange={setStudySessions}
              />
              <StepperRow
                label="Focus session length"
                value={focusMinutes}
                min={10}
                max={120}
                step={5}
                onChange={setFocusMinutes}
                format={(v) => `${v}m`}
              />
              <StepperRow
                label="Sleep target"
                value={sleepHours}
                min={5}
                max={12}
                step={0.5}
                onChange={setSleepHours}
                format={(v) => `${v}h`}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div key="s3" className="wa-enter">
            <h1 className="onb__title">
              Ready when
              <br />
              you are
            </h1>
            <p className="onb__lede">A last couple of preferences, then Day 1 begins.</p>
            <div style={{ marginTop: 'var(--sp-5)' }}>
              <ToggleRow
                title="Daily reminders"
                description="A nudge each morning to secure the day."
                checked={notifications}
                onChange={setNotifications}
              />
              <ToggleRow
                title="Ambient effects"
                description="Snowfall and atmospheric motion."
                checked={ambient}
                onChange={setAmbient}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="onb__foot">
        <div className="onb__dots" role="presentation">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={`onb__dot${i === step ? ' onb__dot--on' : ''}`} />
          ))}
        </div>
        <PrimaryButton block size="lg" iconRight={step === STEP_COUNT - 1 ? undefined : 'arrow-right'} onClick={next}>
          {step === STEP_COUNT - 1 ? 'Start Day 1' : 'Next'}
        </PrimaryButton>
        {step > 0 ? (
          <SecondaryButton block size="sm" style={{ marginTop: 'var(--sp-3)' }} onClick={back}>
            Back
          </SecondaryButton>
        ) : null}
      </div>
    </div>
  );
}

function StepperRow({
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-body)' }}>{label}</span>
      <Stepper value={value} onChange={onChange} min={min} max={max} step={step} label={label} format={format} />
    </div>
  );
}
