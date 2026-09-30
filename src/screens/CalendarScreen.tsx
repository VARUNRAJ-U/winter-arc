import { useMemo, useState } from 'react';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  BottomSheet,
  CheckMark,
  Chip,
  GlassCard,
  Icon,
  IconButton,
  SecondaryButton,
  Section,
  TextAreaField,
  XPBadge,
} from '@/components/ui';
import { pillarIcon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/appStore';
import { useHistoryContext, useQuoteUnlocked, useToday } from '@/store/selectors';
import { historyEntry } from '@/domain/history';
import { allPillarProgress, PILLAR_COLOR_VAR } from '@/domain/pillars';
import { quoteForDate } from '@/services/quotes';
import {
  buildMonthGrid,
  compareISO,
  daysBetween,
  formatLongDate,
  formatMonthYearShort,
  fromISODate,
  todayISO,
  weekdayNames,
} from '@/utils/date';
import { formatDuration } from '@/utils/format';
import { Legend } from './JourneyScreen';
import type { DayStatus, ISODate } from '@/models';
import './screens.css';

export function CalendarScreen() {
  const today = useToday();
  const ctx = useHistoryContext();
  const settings = useAppStore((s) => s.settings);
  const bonusQuotes = useQuoteUnlocked();

  const todayDate = fromISODate(today);
  const [cursor, setCursor] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [selected, setSelected] = useState<ISODate | null>(null);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const entries = useMemo(
    () => new Map(cells.map((c) => [c.date, historyEntry(c.date, ctx)])),
    [cells, ctx],
  );

  const monthSecured = cells.filter(
    (c) => c.inMonth && entries.get(c.date)?.completedPillars === 4,
  ).length;

  const shift = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const atCurrentMonth =
    cursor.year === todayDate.getFullYear() && cursor.month === todayDate.getMonth();

  return (
    <Screen scrollKey="calendar">
      <ScreenHeader
        title="Calendar"
        subtitle="Show Up. Stay Consistent."
        back={false}
        titleIcon="calendar"
        actions={
          atCurrentMonth ? null : (
            <IconButton
              icon="target"
              label="Jump to this month"
              bordered
              onClick={() => {
                const now = fromISODate(todayISO());
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
              }}
            />
          )
        }
      />

      <ScreenBody>
        <div className="cal__nav">
          <IconButton icon="chevron-left" label="Previous month" onClick={() => shift(-1)} />
          <span className="cal__month">{formatMonthYearShort(cursor.year, cursor.month)}</span>
          <IconButton icon="chevron-right" label="Next month" onClick={() => shift(1)} />
        </div>

        <GlassCard pad="sm" style={{ marginTop: 'var(--sp-4)' }}>
          <div className="cal__weekdays" role="presentation">
            {weekdayNames.map((d) => (
              <span className="cal__weekday" key={d}>
                {d}
              </span>
            ))}
          </div>

          <div className="cal__grid">
            {cells.map((cell) => {
              const entry = entries.get(cell.date);
              const status = entry?.status ?? 'future';
              const isToday = cell.date === today;
              const future = compareISO(cell.date, today) > 0;
              const beforeArc = compareISO(cell.date, ctx.startDate) < 0;
              return (
                <button
                  key={cell.date}
                  type="button"
                  className={calCellClass(status, cell.inMonth, isToday, cell.date === selected)}
                  disabled={future || beforeArc}
                  onClick={() => setSelected(cell.date)}
                  aria-label={`${formatLongDate(cell.date)}, ${calStatusLabel(status, beforeArc)}`}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <span className="cal__dot">
                    {status === 'complete' ? (
                      <Icon name="check" size={15} strokeWidth={2.6} />
                    ) : (
                      cell.day
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="cal__legend">
            <Legend color="var(--accent-cyan)" label="Completed" />
            <Legend color="var(--state-partial)" label="Partial" />
            <Legend color="var(--state-missed)" label="Missed" />
          </div>
        </GlassCard>

        <Section title="This month" meta={`${monthSecured} secured`}>
          <GlassCard variant="soft">
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Tap any past day to see exactly which pillars you secured, the XP it earned, and the note
              you left. Days before your arc started and days ahead of today are not selectable.
            </p>
          </GlassCard>
        </Section>

        {settings.widgets.showQuote ? (
          <p className="today__quote">&ldquo;{quoteForDate(today, bonusQuotes, 2)}&rdquo;</p>
        ) : null}
      </ScreenBody>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? formatLongDate(selected) : ''}
        description={
          selected
            ? selected === today
              ? 'Today'
              : `Day ${daysBetween(ctx.startDate, selected) + 1} of your arc`
            : undefined
        }
      >
        {selected ? <DayDetail date={selected} onClose={() => setSelected(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function calCellClass(
  status: DayStatus,
  inMonth: boolean,
  isToday: boolean,
  isSelected: boolean,
): string {
  const classes = ['cal__cell'];
  if (!inMonth) classes.push('cal__cell--out');
  if (status === 'complete') classes.push('cal__cell--complete');
  else if (status === 'partial') classes.push('cal__cell--partial');
  else if (status === 'missed') classes.push('cal__cell--missed');
  if (isToday) classes.push('cal__cell--today');
  if (isSelected) classes.push('cal__cell--selected');
  return classes.join(' ');
}

function calStatusLabel(status: DayStatus, beforeArc: boolean): string {
  if (beforeArc) return 'before your arc started';
  switch (status) {
    case 'complete':
      return 'all four pillars secured';
    case 'partial':
      return 'partially complete';
    case 'missed':
      return 'no pillars completed';
    case 'today':
      return 'today';
    default:
      return 'not yet reached';
  }
}

/* ------------------------------------------------------------ DayDetail */

/** Shared by the Calendar and the Journey grid. */
export function DayDetail({ date, onClose }: { date: ISODate; onClose: () => void }) {
  const ctx = useHistoryContext();
  const today = useToday();
  const day = useAppStore((s) => s.days[date]);
  const goals = useAppStore((s) => s.goals);
  const setDayNote = useAppStore((s) => s.setDayNote);

  const entry = historyEntry(date, ctx);
  const pillars = allPillarProgress(day, goals);
  const [note, setNote] = useState(day?.note ?? '');
  const editable = date === today;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <Chip tone={entry.completedPillars === 4 ? 'complete' : 'default'} icon="target">
          {entry.completedPillars}/4 pillars
        </Chip>
        <XPBadge xp={entry.xp} />
      </div>

      <div className="day-detail__pillars">
        {pillars.map((p) => (
          <div className="day-detail__row" key={p.key}>
            <span style={{ color: PILLAR_COLOR_VAR[p.key], display: 'grid' }} aria-hidden="true">
              <Icon name={pillarIcon[p.key]} size={19} />
            </span>
            <span className="day-detail__rowName">{p.label}</span>
            <span className="day-detail__rowVal">
              {p.key === 'sleep'
                ? p.current > 0
                  ? formatDuration(p.current)
                  : 'Not logged'
                : `${p.current}/${p.target}`}
            </span>
            <CheckMark on={p.complete} small />
          </div>
        ))}
      </div>

      {day?.workout ? (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          {day.workout.title} &middot; {day.workout.focus}
        </p>
      ) : null}

      <div style={{ marginTop: 'var(--sp-4)' }}>
        {editable ? (
          <>
            <TextAreaField
              label="Day note"
              value={note}
              rows={3}
              placeholder="What made today hard or easy?"
              onChange={setNote}
            />
            <SecondaryButton
              block
              onClick={() => {
                setDayNote(date, note);
                onClose();
              }}
            >
              Save note
            </SecondaryButton>
          </>
        ) : day?.note ? (
          <GlassCard variant="soft" pad="sm">
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>Note</p>
            <p style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'pre-wrap' }}>{day.note}</p>
          </GlassCard>
        ) : (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>No note for this day.</p>
        )}
      </div>
    </div>
  );
}
