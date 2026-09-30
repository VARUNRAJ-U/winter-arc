import { useMemo, useState } from 'react';
import { getAsset, type AssetKey } from '@/assets';
import { Banner, Screen, ScreenBody } from '@/components/layout';
import { GlassCard, Icon, IconButton, ProgressRing, XPBadge } from '@/components/ui';
import { PillarTile } from '@/components/pillars';
import { useNavigationStore, type ScreenKey } from '@/store/navigationStore';
import { useAppStore } from '@/store/appStore';
import {
  useArcPosition,
  useCompletedPillarCount,
  useDayXp,
  usePillars,
  useQuoteUnlocked,
  useStreaks,
  useToday,
} from '@/store/selectors';
import { quoteForDate } from '@/services/quotes';
import { buildReminders } from '@/domain/reminders';
import { isMilestoneDay, MILESTONE_DEFINITIONS } from '@/domain/journey';
import { formatLongDate, greetingFor, ARC_LENGTH } from '@/utils/date';
import { useCountUp, useTicker } from '@/hooks';
import type { PillarKey } from '@/models';
import './screens.css';

const PILLAR_SCREEN: Record<PillarKey, ScreenKey> = {
  workout: 'workout',
  diet: 'diet',
  studies: 'studies',
  sleep: 'sleep',
};

export function DashboardScreen({ onSwitchView }: { onSwitchView: () => void }) {
  const today = useToday();
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const push = useNavigationStore((s) => s.push);
  const goTo = useNavigationStore((s) => s.goTo);

  const pillars = usePillars(today);
  const completed = useCompletedPillarCount(today);
  const arc = useArcPosition();
  const dayXp = useDayXp(today);
  const streaks = useStreaks();
  const bonusQuotes = useQuoteUnlocked();

  const art = getAsset('snowMountains');
  const avatar = getAsset((profile?.avatarAsset as AssetKey) ?? 'mountaineer');
  const animatedXp = useCountUp(dayXp, 700);
  const ringValue = completed / pillars.length;

  // Re-evaluated each minute so a reminder appears at its configured time.
  const minuteTick = useTicker(60_000);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const reminders = useMemo(() => {
    const now = new Date(minuteTick);
    const startDate = profile?.startDate ?? today;
    const milestone = MILESTONE_DEFINITIONS.find(
      (m) => isMilestoneDay(startDate, today) && m.day === arc.dayNumber,
    );
    return buildReminders({
      settings,
      completed,
      totalPillars: pillars.length,
      currentStreak: streaks.current,
      isMilestoneDay: isMilestoneDay(startDate, today),
      milestoneDay: milestone?.day ?? null,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    }).filter((r) => !dismissed.includes(r.id));
  }, [settings, completed, pillars.length, streaks.current, profile?.startDate, today, arc.dayNumber, minuteTick, dismissed]);

  const firstName = (profile?.name ?? 'Athlete').split(' ')[0];
  const headline = completed === pillars.length ? 'Day secured.' : completed > 0 ? 'Keep going.' : `Let's move, ${firstName}.`;

  return (
    <Screen scrollKey="dashboard">
      <section className="dash__top" aria-label="Winter Arc progress">
        <div className="dash__topArt" aria-hidden="true">
          <img src={art.src} alt="" loading="eager" decoding="async" />
          <span className="dash__topScrim" />
        </div>

        <div className="dash__greet">
          <span className="dash__avatar" aria-hidden="true">
            <img src={avatar.src} alt="" loading="lazy" decoding="async" />
          </span>
          <div className="dash__greetText">
            <p className="dash__hello">{greetingFor()}</p>
            <p className="dash__name">{headline}</p>
            <p className="dash__date">{formatLongDate(today)}</p>
          </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <XPBadge xp={Math.round(animatedXp)} />
            <IconButton
              icon="bell"
              label="Notification settings"
              onClick={() => goTo('settings-notifications')}
            />
          </div>
        </div>

        <div className="dash__core">
          <div className="dash__coreInner">
            <div className="dash__ringWrap">
              <ProgressRing
                value={ringValue}
                size={210}
                thickness={11}
                label={`${completed} of ${pillars.length} pillars complete today`}
                halo={settings.appearance.ambientEffects}
              >
                <div>
                  <div className="dash__dayLabel">Day</div>
                  <div className="dash__dayValue">{arc.displayDay}</div>
                  <div className="dash__dayTotal">/ {ARC_LENGTH}</div>
                </div>
              </ProgressRing>
            </div>
            <p className="dash__wordmark">WINTER ARC</p>
          </div>
        </div>
      </section>

      {reminders.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Banner
            message={reminders[0].message}
            icon={reminders[0].icon}
            onDismiss={() => setDismissed((d) => [...d, reminders[0].id])}
          />
        </div>
      ) : null}

      {settings.widgets.showQuote ? (
        <GlassCard variant="soft" pad={false} className="dash__quote" style={{ marginTop: 'var(--sp-4)' }}>
          &ldquo;{quoteForDate(today, bonusQuotes)}&rdquo;
        </GlassCard>
      ) : null}

      <div className="pillar-grid">
        {pillars.map((p) => (
          <PillarTile key={p.key} pillar={p} onOpen={() => push(PILLAR_SCREEN[p.key])} />
        ))}
      </div>

      <ScreenBody>
        <GlassCard
          as="div"
          variant="soft"
          className="dash__summary"
          role="button"
          tabIndex={0}
          onClick={onSwitchView}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSwitchView();
            }
          }}
          aria-label={`Today's progress, ${completed} of ${pillars.length} pillars. Open the pillar list.`}
        >
          <ProgressRing value={ringValue} size={52} thickness={5} halo={false}>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {completed}
            </span>
          </ProgressRing>
          <span className="dash__summaryText">
            <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}>
              Today&rsquo;s Progress
            </span>
            <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
              {completed} of {pillars.length} pillars secured
            </span>
          </span>
          <Icon name="chevron-right" size={20} style={{ color: 'var(--text-muted)' }} />
        </GlassCard>

        {settings.widgets.showStreak && streaks.current > 0 ? (
          <GlassCard variant="soft" className="dash__summary" style={{ marginTop: 'var(--sp-3)' }}>
            <span style={{ color: 'var(--accent-amber)', filter: 'drop-shadow(0 0 8px rgba(245,165,36,.6))' }}>
              <Icon name="flame" size={26} />
            </span>
            <span className="dash__summaryText">
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}>
                {streaks.current} day streak
              </span>
              <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                Longest run: {streaks.longest} {streaks.longest === 1 ? 'day' : 'days'}
              </span>
            </span>
          </GlassCard>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
