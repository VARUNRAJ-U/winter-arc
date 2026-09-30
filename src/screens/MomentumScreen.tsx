import { useMemo, useState } from 'react';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import { GlassCard, Icon, ProgressBar, SegmentedTabs, Section, StatCard } from '@/components/ui';
import { pillarIcon } from '@/components/ui/Icon';
import { BarChart, type BarDatum } from '@/components/stats/BarChart';
import { useRangeSummary, useStreaks, useTotalXp } from '@/store/selectors';
import { PILLAR_COLOR_VAR, PILLAR_LABELS } from '@/domain/pillars';
import { formatNumber, formatPercent } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import './screens.css';

type Range = '7' | '30' | '90' | 'all';

const RANGE_TABS: { value: Range; label: string }[] = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: 'all', label: 'All' },
];

export function MomentumScreen() {
  const [range, setRange] = useState<Range>('30');
  const windowDays = range === 'all' ? ('all' as const) : Number(range);
  const { summary, consistencyDelta, sessionsDelta } = useRangeSummary(windowDays);
  const streaks = useStreaks();
  const totalXp = useTotalXp();

  const chartData: BarDatum[] = useMemo(
    () =>
      summary.entries
        .filter((e) => e.status !== 'future')
        .map((e) => ({
          label: formatShortDate(e.date),
          fullLabel: formatShortDate(e.date),
          value: (e.completedPillars / 4) * 100,
          muted: e.status === 'today' && e.completedPillars < 4,
        })),
    [summary.entries],
  );

  const weekly = useMemo(() => {
    const elapsed = summary.entries.filter((e) => e.status !== 'future');
    const buckets: BarDatum[] = [];
    for (let i = 0; i < elapsed.length; i += 7) {
      const chunk = elapsed.slice(i, i + 7);
      if (chunk.length === 0) continue;
      const rate =
        (chunk.reduce((sum, e) => sum + e.completedPillars, 0) / (chunk.length * 4)) * 100;
      buckets.push({
        label: formatShortDate(chunk[0].date),
        fullLabel: `Week of ${formatShortDate(chunk[0].date)}`,
        value: rate,
      });
    }
    return buckets;
  }, [summary.entries]);

  const hasData = summary.days > 0;

  return (
    <Screen scrollKey={`momentum-${range}`}>
      <ScreenHeader title="Your Momentum" subtitle="Proof of a Stronger You" />

      <ScreenBody>
        <SegmentedTabs items={RANGE_TABS} value={range} onChange={setRange} label="Time range" />

        <div className="mom__stats" style={{ marginTop: 'var(--sp-4)' }}>
          <StatCard
            icon="bar-chart"
            value={formatPercent(summary.consistency)}
            label="Consistency"
            delta={consistencyDelta ?? undefined}
          />
          <StatCard
            icon="bolt"
            value={formatNumber(summary.totalSessions)}
            label="Total Sessions"
            delta={sessionsDelta ?? undefined}
            deltaSuffix=""
          />
        </div>

        <div className="mom__stats" style={{ marginTop: 'var(--sp-3)' }}>
          <StatCard icon="flame" value={String(streaks.current)} label="Current Streak" />
          <StatCard icon="trophy" value={String(streaks.longest)} label="Longest Streak" />
        </div>

        <Section title="Daily Completion Rate" meta={formatPercent(summary.completionRate)}>
          <GlassCard>
            <BarChart
              data={chartData}
              caption={`Daily completion rate over the last ${summary.days} days`}
              unit="%"
            />
          </GlassCard>
        </Section>

        <Section title="Pillar Breakdown">
          <GlassCard>
            {hasData ? (
              <div className="breakdown">
                {summary.pillarRates.map((p) => (
                  <div className="breakdown__row" key={p.key}>
                    <span
                      className="breakdown__icon"
                      style={{ color: PILLAR_COLOR_VAR[p.key] }}
                      aria-hidden="true"
                    >
                      <Icon name={pillarIcon[p.key]} size={18} />
                    </span>
                    <span className="breakdown__name">{PILLAR_LABELS[p.key]}</span>
                    <span className="breakdown__bar">
                      <ProgressBar
                        value={p.rate}
                        size="sm"
                        label={`${PILLAR_LABELS[p.key]} completion rate`}
                        tone={`linear-gradient(90deg, ${PILLAR_COLOR_VAR[p.key]}, var(--accent-ice))`}
                      />
                    </span>
                    <span className="breakdown__pct">{formatPercent(p.rate)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                No elapsed days in this range yet.
              </p>
            )}
          </GlassCard>
        </Section>

        <Section title="Weekly Progress">
          <GlassCard>
            <BarChart
              data={weekly}
              caption="Average completion rate per week"
              unit="%"
            />
          </GlassCard>
        </Section>

        <Section title="In this range">
          <GlassCard variant="soft">
            <dl style={{ display: 'grid', gap: 'var(--sp-3)', margin: 0 }}>
              <SummaryRow label="Days elapsed" value={formatNumber(summary.days)} />
              <SummaryRow label="Days fully secured" value={formatNumber(summary.completedDays)} />
              <SummaryRow label="Partial days" value={formatNumber(summary.partialDays)} />
              <SummaryRow label="Missed days" value={formatNumber(summary.missedDays)} />
              <SummaryRow label="XP earned" value={formatNumber(summary.totalXp)} />
              <SummaryRow label="XP all time" value={formatNumber(totalXp)} />
            </dl>
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
      <dt style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </dd>
    </div>
  );
}
