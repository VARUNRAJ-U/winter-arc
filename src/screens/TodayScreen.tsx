import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import { Chip, GlassCard, IconButton, ProgressBar } from '@/components/ui';
import { PillarRow } from '@/components/pillars';
import { useNavigationStore, type ScreenKey } from '@/store/navigationStore';
import { useAppStore } from '@/store/appStore';
import {
  useArcPosition,
  useCompletedPillarCount,
  usePillars,
  useQuoteUnlocked,
  useToday,
} from '@/store/selectors';
import { quoteForDate } from '@/services/quotes';
import { formatLongDate } from '@/utils/date';
import type { PillarKey } from '@/models';
import './screens.css';

const PILLAR_SCREEN: Record<PillarKey, ScreenKey> = {
  workout: 'workout',
  diet: 'diet',
  studies: 'studies',
  sleep: 'sleep',
};

const ENCOURAGEMENT: Record<number, string> = {
  0: 'Nothing secured yet. Pick one pillar and start there.',
  1: 'One down. Momentum starts with the second.',
  2: 'Halfway. The back half is where days are won.',
  3: "Stay consistent. You're building something greater.",
  4: 'Every pillar secured. This is what the arc is made of.',
};

export function TodayScreen({ onSwitchView }: { onSwitchView: () => void }) {
  const today = useToday();
  const push = useNavigationStore((s) => s.push);
  const pillars = usePillars(today);
  const completed = useCompletedPillarCount(today);
  const arc = useArcPosition();
  const settings = useAppStore((s) => s.settings);
  const bonusQuotes = useQuoteUnlocked();

  const visible = settings.focusMode.hideCompleted ? pillars.filter((p) => !p.complete) : pillars;

  return (
    <Screen scrollKey="today">
      <ScreenHeader
        title="Today"
        subtitle="Four Pillars, One Stronger You"
        back={false}
        actions={
          <IconButton
            icon="layout-grid"
            label="Switch to dashboard view"
            bordered
            onClick={onSwitchView}
          />
        }
      />

      <ScreenBody>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--sp-3)',
            marginBottom: 'var(--sp-4)',
          }}
        >
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            {formatLongDate(today)}
          </span>
          <Chip tone="accent">Day {arc.displayDay}</Chip>
        </div>

        <GlassCard className="today__progress">
          <div className="today__progressHead">
            <h2 className="today__progressTitle">Today&rsquo;s Progress</h2>
            <span className="today__progressCount">
              {completed}/{pillars.length}
            </span>
          </div>
          <ProgressBar value={completed / pillars.length} label="Today's pillar progress" />
          <p className="today__progressNote">{ENCOURAGEMENT[completed] ?? ENCOURAGEMENT[0]}</p>
        </GlassCard>

        <ul className="today__list">
          {visible.map((p) => (
            <li key={p.key}>
              <PillarRow pillar={p} onOpen={() => push(PILLAR_SCREEN[p.key])} />
            </li>
          ))}
        </ul>

        {visible.length === 0 ? (
          <GlassCard variant="soft" style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}>
              All four pillars secured
            </p>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
              Completed items are hidden by Focus Mode.
            </p>
          </GlassCard>
        ) : null}

        {settings.widgets.showQuote ? (
          <p className="today__quote">&ldquo;{quoteForDate(today, bonusQuotes, 1)}&rdquo;</p>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
