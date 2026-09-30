import { useEffect, useMemo, useState } from 'react';
import { getAsset } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  EmptyState,
  GlassCard,
  Icon,
  IconButton,
  PrimaryButton,
  ProgressBar,
  ProgressRing,
  SecondaryButton,
  SegmentedTabs,
  Section,
  TextAreaField,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useDay, useHistoryContext, useToday } from '@/store/selectors';
import { PILLAR_TAGLINES } from '@/domain/pillars';
import { addDays, formatShortDate, formatTime12h, sleepDurationMinutes } from '@/utils/date';
import { clamp, formatDuration, formatDurationCompact } from '@/utils/format';
import type { SleepRecord } from '@/models';
import './screens.css';

type Tab = 'track' | 'insights';

export function SleepScreen() {
  const today = useToday();
  const day = useDay(today);
  const goals = useAppStore((s) => s.goals);
  const logSleep = useAppStore((s) => s.logSleep);
  const clearSleep = useAppStore((s) => s.clearSleep);
  const pushToast = useAppStore((s) => s.pushToast);

  const [tab, setTab] = useState<Tab>('track');
  const [bedTime, setBedTime] = useState(day.sleep?.bedTime ?? goals.bedTime);
  const [wakeTime, setWakeTime] = useState(day.sleep?.wakeTime ?? goals.wakeTime);
  const [quality, setQuality] = useState<SleepRecord['quality']>(day.sleep?.quality ?? 4);
  const [note, setNote] = useState(day.sleep?.note ?? '');

  // Re-sync the form whenever the stored record for this day changes.
  useEffect(() => {
    setBedTime(day.sleep?.bedTime ?? goals.bedTime);
    setWakeTime(day.sleep?.wakeTime ?? goals.wakeTime);
    setQuality(day.sleep?.quality ?? 4);
    setNote(day.sleep?.note ?? '');
  }, [day.sleep, goals.bedTime, goals.wakeTime]);

  const minutes = sleepDurationMinutes(bedTime, wakeTime);
  const targetMinutes = Math.round(goals.sleepTargetHours * 60);
  const progress = clamp(minutes / targetMinutes, 0, 1);
  const art = getAsset('snowMountains');
  const logged = !!day.sleep;

  const save = () => {
    logSleep(today, { bedTime, wakeTime, quality, note });
    pushToast(
      minutes >= targetMinutes ? 'Sleep secured. +50 XP' : `${formatDuration(minutes)} logged.`,
      minutes >= targetMinutes ? 'success' : 'info',
    );
  };

  return (
    <Screen scrollKey={`sleep-${tab}`}>
      <ScreenHeader
        title={`${formatHours(goals.sleepTargetHours)} Hours Sleep`}
        subtitle={PILLAR_TAGLINES.sleep}
        actions={
          logged ? (
            <IconButton
              icon="trash"
              label="Clear tonight's sleep log"
              bordered
              onClick={() => {
                if (window.confirm('Clear the sleep logged for today?')) {
                  clearSleep(today);
                  pushToast('Sleep log cleared.', 'info');
                }
              }}
            />
          ) : null
        }
      />

      <ScreenBody>
        <SegmentedTabs
          items={[
            { value: 'track', label: 'Track' },
            { value: 'insights', label: 'Insights' },
          ]}
          value={tab}
          onChange={setTab}
          label="Sleep view"
        />
      </ScreenBody>

      {tab === 'track' ? (
        <>
          <section className="sleep__dial">
            <div className="sleep__art" aria-hidden="true">
              <img src={art.src} alt="" loading="lazy" decoding="async" />
              <span className="sleep__scrim" />
            </div>
            <div className="sleep__inner">
              <ProgressRing value={progress} size={216} thickness={9} label="Sleep against target">
                <div>
                  <span className="sleep__moon" aria-hidden="true" style={{ display: 'grid', justifyContent: 'center' }}>
                    <Icon name="moon" size={26} filled />
                  </span>
                  <div className="sleep__value">{formatDuration(minutes)}</div>
                  <div className="sleep__target">Target: {formatHours(goals.sleepTargetHours)} hours</div>
                </div>
              </ProgressRing>
            </div>
          </section>

          <ScreenBody>
            <p className="sleep__caption">
              Good sleep builds
              <br />a stronger tomorrow.
            </p>

            <div className="sleep__times">
              <TimeField
                label="Bed Time"
                value={bedTime}
                onChange={setBedTime}
                icon="moon"
              />
              <TimeField
                label="Wake Time"
                value={wakeTime}
                onChange={setWakeTime}
                icon="sun"
              />
            </div>

            <Section title="How did you sleep?">
              <GlassCard>
                <div className="sleep__quality" role="group" aria-label="Sleep quality out of five">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`sleep__star${n <= quality ? ' sleep__star--on' : ''}`}
                      aria-label={`${n} out of 5`}
                      aria-pressed={n === quality}
                      onClick={() => setQuality(n as SleepRecord['quality'])}
                    >
                      <Icon name="star" size={22} filled={n <= quality} />
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 'var(--sp-4)' }}>
                  <TextAreaField
                    label="Note"
                    value={note}
                    rows={3}
                    placeholder="Anything that helped or hurt last night?"
                    onChange={setNote}
                  />
                </div>
              </GlassCard>
            </Section>

            <div style={{ marginTop: 'var(--sp-4)' }}>
              <PrimaryButton block size="lg" iconLeft="check" onClick={save}>
                {logged ? 'Update Sleep' : "I'm Awake · Complete Sleep"}
              </PrimaryButton>
              {logged ? (
                <p
                  style={{
                    textAlign: 'center',
                    marginTop: 'var(--sp-3)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Logged {formatDuration(day.sleep!.minutes)} ({formatTime12h(day.sleep!.bedTime)} to{' '}
                  {formatTime12h(day.sleep!.wakeTime)})
                </p>
              ) : null}
            </div>
          </ScreenBody>
        </>
      ) : (
        <SleepInsights targetMinutes={targetMinutes} />
      )}
    </Screen>
  );
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function TimeField({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  icon: 'moon' | 'sun';
}) {
  return (
    <label className="sleep__time" style={{ position: 'relative', cursor: 'pointer' }}>
      <span className="sleep__timeIcon" aria-hidden="true">
        <Icon name={icon} size={24} filled={icon === 'moon'} />
      </span>
      <span className="sleep__timeBody">
        <span className="sleep__timeLabel">{label}</span>
        <span className="sleep__timeValue">{formatTime12h(value)}</span>
      </span>
      <input
        className="sleep__timeInput"
        type="time"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value || value)}
      />
    </label>
  );
}

function SleepInsights({ targetMinutes }: { targetMinutes: number }) {
  const ctx = useHistoryContext();
  const today = useToday();
  const goTo = useNavigationStore((s) => s.goTo);

  const rows = useMemo(() => {
    const out: { date: string; minutes: number; quality: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const record = ctx.days[date]?.sleep;
      out.push({ date, minutes: record?.minutes ?? 0, quality: record?.quality ?? 0 });
    }
    return out;
  }, [ctx.days, today]);

  const logged = rows.filter((r) => r.minutes > 0);
  const average = logged.length ? logged.reduce((s, r) => s + r.minutes, 0) / logged.length : 0;
  const hitTarget = logged.filter((r) => r.minutes >= targetMinutes).length;
  const avgQuality = logged.length ? logged.reduce((s, r) => s + r.quality, 0) / logged.length : 0;

  return (
    <ScreenBody>
      {logged.length === 0 ? (
        <GlassCard variant="soft" style={{ marginTop: 'var(--sp-4)' }}>
          <EmptyState
            icon="moon"
            title="No sleep logged yet"
            description="Log a night on the Track tab and your history appears here."
          />
        </GlassCard>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
            <GlassCard variant="soft" pad="sm">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>
                {formatDurationCompact(average)}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Average night</div>
            </GlassCard>
            <GlassCard variant="soft" pad="sm">
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>
                {hitTarget}/{logged.length}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Nights at target</div>
            </GlassCard>
          </div>

          <Section title="Last 14 nights" meta={`Quality ${avgQuality.toFixed(1)}/5`}>
            <GlassCard>
              <div className="sleep-hist">
                {rows.map((r) => (
                  <div className="sleep-hist__row" key={r.date}>
                    <span className="sleep-hist__date">{formatShortDate(r.date)}</span>
                    <span className="sleep-hist__bar">
                      <ProgressBar
                        value={clamp(r.minutes / (targetMinutes * 1.25), 0, 1)}
                        size="sm"
                        label={`${formatShortDate(r.date)} sleep`}
                        tone={
                          r.minutes === 0
                            ? 'rgba(120,190,255,.2)'
                            : r.minutes >= targetMinutes
                              ? 'linear-gradient(90deg,#34e0a1,#7fe8c6)'
                              : undefined
                        }
                      />
                    </span>
                    <span className="sleep-hist__val">
                      {r.minutes === 0 ? '--' : formatDurationCompact(r.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </Section>

          <Section title="What this means">
            <GlassCard variant="soft">
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {average >= targetMinutes
                  ? 'You are averaging at or above your target. Recovery is holding up the other three pillars.'
                  : `You are averaging ${formatDurationCompact(targetMinutes - average)} short of your target. Moving bed time earlier is usually easier than moving wake time later.`}
              </p>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <SecondaryButton size="sm" onClick={() => goTo('settings-goals')}>
                  Adjust sleep target
                </SecondaryButton>
              </div>
            </GlassCard>
          </Section>
        </>
      )}
    </ScreenBody>
  );
}
