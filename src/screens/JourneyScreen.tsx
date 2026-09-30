import { useMemo, useState } from 'react';
import { getAsset } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  BottomSheet,
  Chip,
  GlassCard,
  Icon,
  ProgressBar,
  ProgressRing,
  SecondaryButton,
  SegmentedTabs,
  Section,
} from '@/components/ui';
import { useNavigationStore } from '@/store/navigationStore';
import {
  useArcPosition,
  useHistoryContext,
  useMilestones,
  useNextMilestone,
  useToday,
} from '@/store/selectors';
import { useAppStore } from '@/store/appStore';
import { historyEntry } from '@/domain/history';
import { MILESTONE_ANCHORS, MILESTONE_DAYS, pointOnRoute } from '@/domain/journey';
import { ARC_LENGTH, arcDayToDate, formatLongDate, formatShortDate } from '@/utils/date';
import { formatPercent } from '@/utils/format';
import { DayDetail } from './CalendarScreen';
import type { DayStatus, ISODate } from '@/models';
import './screens.css';

type Tab = 'journey' | 'milestones';

export function JourneyScreen() {
  const [tab, setTab] = useState<Tab>('journey');
  const [selected, setSelected] = useState<ISODate | null>(null);

  const today = useToday();
  const arc = useArcPosition();
  const ctx = useHistoryContext();
  const milestones = useMilestones();
  const goTo = useNavigationStore((s) => s.goTo);
  const upcoming = useNextMilestone();
  const showNextMilestone = useAppStore((s) => s.settings.widgets.showNextMilestone);
  const art = getAsset('mountainJourney');

  const cells = useMemo(
    () =>
      Array.from({ length: ARC_LENGTH }, (_, i) => {
        const dayNumber = i + 1;
        const date = arcDayToDate(ctx.startDate, dayNumber);
        const entry = historyEntry(date, ctx);
        return { dayNumber, date, status: entry.status, completed: entry.completedPillars };
      }),
    [ctx],
  );

  const securedDays = cells.filter((c) => c.status === 'complete').length;
  const here = pointOnRoute(arc.progress);

  return (
    <Screen scrollKey={`journey-${tab}`}>
      <ScreenHeader title="90-Day Journey" subtitle="Small Steps. Massive Change." back={false} />

      <ScreenBody>
        <SegmentedTabs
          items={[
            { value: 'journey', label: 'Journey' },
            { value: 'milestones', label: 'Milestones' },
          ]}
          value={tab}
          onChange={setTab}
          label="Journey view"
        />
      </ScreenBody>

      {tab === 'journey' ? (
        <>
          <div className="jr__map" style={{ height: 320, marginTop: 'var(--sp-4)' }}>
            <img src={art.src} alt={art.alt} loading="lazy" decoding="async" />
            <span className="jr__mapScrim" aria-hidden="true" />

            <div
              className="jr__you"
              style={{ left: `${here.x}%`, top: `${here.y}%` }}
              aria-hidden="true"
            >
              <span className="jr__youPulse" />
              <span className="jr__youDot" />
            </div>
            <p className="sr-only">
              You are on day {arc.displayDay} of {ARC_LENGTH}, {formatPercent(arc.progress)} of the way
              along the route.
            </p>

            {MILESTONE_DAYS.map((dayNo) => {
              const anchor = MILESTONE_ANCHORS[dayNo];
              const milestone = milestones.find((m) => m.day === dayNo);
              if (!anchor || !milestone) return null;
              return (
                <div
                  key={dayNo}
                  className="jr__pin"
                  style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
                >
                  <span className={`jr__pinDot${milestone.reached ? ' jr__pinDot--reached' : ''}`}>
                    {milestone.reached ? (
                      <Icon name="check" size={14} strokeWidth={2.6} />
                    ) : (
                      <span className="jr__pinInner" />
                    )}
                  </span>
                  <span className="jr__pinText">
                    <span className="jr__pinDay">Day {dayNo}</span>
                    <span className="jr__pinName">{milestone.title}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <ScreenBody>
            <GlassCard className="jr__status" style={{ marginTop: 'var(--sp-4)' }}>
              <ProgressRing value={arc.progress} size={62} thickness={6} halo={false}>
                <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPercent(arc.progress)}
                </span>
              </ProgressRing>
              <div className="jr__statusBody">
                <p className="jr__statusTitle">
                  Day {arc.displayDay} of {ARC_LENGTH}
                </p>
                <p className="jr__statusNote">
                  {arc.finished
                    ? 'Arc complete. The standard remains.'
                    : `${arc.daysRemaining} ${arc.daysRemaining === 1 ? 'day' : 'days'} remaining. On track for greatness.`}
                </p>
              </div>
            </GlassCard>

            <div style={{ marginTop: 'var(--sp-3)' }}>
              <ProgressBar value={arc.progress} label="Arc progress" />
            </div>

            {showNextMilestone && upcoming ? (
              <GlassCard variant="soft" className="jr__status" style={{ marginTop: 'var(--sp-3)' }}>
                <span
                  aria-hidden="true"
                  style={{ color: 'var(--accent-cyan)', display: 'grid', placeItems: 'center' }}
                >
                  <Icon name="flag" size={24} />
                </span>
                <div className="jr__statusBody">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}>
                    Next: Day {upcoming.day}, {upcoming.title}
                  </p>
                  <p className="jr__statusNote">
                    {upcoming.day - arc.displayDay}{' '}
                    {upcoming.day - arc.displayDay === 1 ? 'day' : 'days'} away, on{' '}
                    {formatLongDate(upcoming.date)}
                  </p>
                </div>
              </GlassCard>
            ) : null}

            <Section title="Every day" meta={`${securedDays} secured`}>
              <GlassCard pad="sm">
                <div className="jr__grid">
                  {cells.map((cell) => (
                    <button
                      key={cell.dayNumber}
                      type="button"
                      className={cellClass(
                        cell.status,
                        MILESTONE_DAYS.includes(cell.dayNumber),
                        cell.date === today,
                      )}
                      onClick={() => setSelected(cell.date)}
                      aria-label={`Day ${cell.dayNumber}, ${formatShortDate(cell.date)}, ${statusLabel(cell.status)}`}
                    >
                      <span className="jr__mark">{cell.dayNumber}</span>
                    </button>
                  ))}
                </div>
                <div className="cal__legend" style={{ marginTop: 'var(--sp-4)' }}>
                  <Legend color="var(--accent-cyan)" label="Secured" />
                  <Legend color="var(--state-partial)" label="Partial" />
                  <Legend color="var(--state-missed)" label="Missed" />
                  <Legend color="rgba(120,190,255,.3)" label="Ahead" />
                </div>
              </GlassCard>
            </Section>
          </ScreenBody>
        </>
      ) : (
        <ScreenBody>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            {milestones.map((m) => (
              <GlassCard key={m.day} className="milestone-card">
                <span className={`milestone-card__badge${m.reached ? ' milestone-card__badge--on' : ''}`}>
                  {m.day}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="milestone-card__title">{m.title}</p>
                  <p className="milestone-card__desc">{m.description}</p>
                  <p className="milestone-card__meta">
                    {m.reached ? 'Reached' : 'Lands on'} {formatLongDate(m.date)}
                  </p>
                </div>
                {m.reached ? <Chip tone="complete" icon="check">Done</Chip> : null}
              </GlassCard>
            ))}
          </div>

          <Section title="What milestones do">
            <GlassCard variant="soft">
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Securing all four pillars on a milestone day awards a bonus 250 XP on top of the usual
                400. Milestones are fixed to days 30, 60 and 90 of your arc, counted from your start date.
              </p>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <SecondaryButton size="sm" onClick={() => goTo('rank')}>
                  See your rank
                </SecondaryButton>
              </div>
            </GlassCard>
          </Section>
        </ScreenBody>
      )}

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? formatLongDate(selected) : ''}
        description={selected === today ? 'Today' : undefined}
      >
        {selected ? <DayDetail date={selected} onClose={() => setSelected(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function cellClass(status: DayStatus, milestone: boolean, isToday: boolean): string {
  const base = ['jr__cell'];
  if (status === 'complete') base.push('jr__cell--complete');
  else if (status === 'partial') base.push('jr__cell--partial');
  else if (status === 'missed') base.push('jr__cell--missed');
  if (isToday) base.push('jr__cell--today');
  if (milestone) base.push('jr__cell--milestone');
  return base.join(' ');
}

function statusLabel(status: DayStatus): string {
  switch (status) {
    case 'complete':
      return 'secured';
    case 'partial':
      return 'partially complete';
    case 'missed':
      return 'missed';
    case 'today':
      return 'today, in progress';
    default:
      return 'ahead of you';
  }
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="cal__legendItem">
      <span className="cal__legendDot" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
