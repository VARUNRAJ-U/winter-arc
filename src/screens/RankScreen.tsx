import { getAsset } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  Chip,
  GlassCard,
  Icon,
  ProgressBar,
  SecondaryButton,
  Section,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useRank, useRewards, useStreaks, useTotalXp } from '@/store/selectors';
import { RANK_TIERS, MAX_LEVEL } from '@/domain/rank';
import { recentTransactions, XP_LABELS } from '@/domain/xp';
import { useCountUp } from '@/hooks';
import { formatNumber } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import './screens.css';

export function RankScreen() {
  const xp = useTotalXp();
  const rank = useRank();
  const rewards = useRewards();
  const streaks = useStreaks();
  const ledger = useAppStore((s) => s.xpLedger);
  const goTo = useNavigationStore((s) => s.goTo);
  const art = getAsset('rankEmblem');

  const animatedXp = useCountUp(xp, 900);
  const log = recentTransactions(ledger, 12);

  return (
    <Screen scrollKey="rank">
      <ScreenHeader title="Your Rank" subtitle="Discipline Earns A Higher You" back={false} />

      <section className="rank__hero">
        <div className="rank__art">
          <img src={art.src} alt={art.alt} loading="eager" decoding="async" />
          <span className="rank__artScrim" aria-hidden="true" />
          <span className="rank__emblemGlow" aria-hidden="true" />
        </div>

        <div className="rank__current">
          <p className="rank__eyebrow">Current Rank</p>
          <h2 className="rank__name">{rank.tier.name}</h2>
          <p className="rank__level">Level {rank.level}</p>
        </div>

        <div style={{ marginTop: 'var(--sp-4)' }}>
          <ProgressBar value={rank.progress} label="Progress to the next level" />
          <p className="rank__xpLine">
            {formatNumber(animatedXp)}
            {rank.nextLevelXp === null
              ? ` XP · Max level ${MAX_LEVEL}`
              : ` / ${formatNumber(rank.nextLevelXp)} XP`}
          </p>
        </div>

        <div className="rank__tiers">
          {RANK_TIERS.map((tier, index) => {
            const state =
              index === rank.tierIndex ? 'on' : index < rank.tierIndex ? 'passed' : 'locked';
            return (
              <div
                key={tier.key}
                className={`rank__tier${state === 'on' ? ' rank__tier--on' : state === 'passed' ? ' rank__tier--passed' : ''}`}
              >
                <Icon name={state === 'locked' ? 'shield' : 'crown'} size={22} />
                <span className="rank__tierName">{tier.short}</span>
                <span className="rank__tierLvl">L{index + 1}</span>
              </div>
            );
          })}
        </div>
      </section>

      <ScreenBody>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Chip icon="flame" tone={streaks.current > 0 ? 'accent' : 'default'}>
            {streaks.current} day streak
          </Chip>
          <Chip icon="trophy">Longest {streaks.longest}</Chip>
          <Chip icon="bolt">{formatNumber(xp)} XP total</Chip>
        </div>

        <Section title="Next Rewards">
          <GlassCard>
            {rewards.map((r) => (
              <div className="reward-row" key={r.id}>
                <span className={`reward-row__tag${r.unlocked ? ' reward-row__tag--on' : ''}`}>
                  {r.label}
                </span>
                <span className="reward-row__desc">{r.description}</span>
                <Icon
                  name={r.unlocked ? 'check' : 'chevron-right'}
                  size={18}
                  style={{ color: r.unlocked ? 'var(--state-complete)' : 'var(--text-muted)' }}
                />
              </div>
            ))}
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)', lineHeight: 1.5 }}>
              Unlocked rewards apply straight away. Accent themes appear in Appearance, the quote pack
              expands the rotation on your dashboard, and the profile frame shows on your Settings card.
            </p>
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <SecondaryButton size="sm" onClick={() => goTo('settings-appearance')}>
                Open Appearance
              </SecondaryButton>
            </div>
          </GlassCard>
        </Section>

        <Section title="How XP works">
          <GlassCard variant="soft">
            <ul style={{ display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              <li>Each pillar secured: +50 XP</li>
              <li>All four pillars in one day: +200 XP bonus</li>
              <li>A milestone day secured: +250 XP bonus</li>
            </ul>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-3)', lineHeight: 1.5 }}>
              XP is recalculated from your actual records, so it can never be awarded twice, and it
              adjusts if you undo something.
            </p>
          </GlassCard>
        </Section>

        <Section title="Recent XP" meta={`${ledger.length} entries`}>
          <GlassCard>
            {log.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                No XP earned yet. Secure your first pillar today.
              </p>
            ) : (
              <div className="xp-log">
                {log.map((t) => (
                  <div className="xp-log__row" key={t.id}>
                    <span className="xp-log__label">
                      {XP_LABELS[t.source]}
                      <br />
                      <span className="xp-log__date">{formatShortDate(t.date)}</span>
                    </span>
                    <span className="xp-log__amt">+{t.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </Section>

        <Section title="Momentum">
          <GlassCard variant="soft">
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              See consistency, completion rate and how each pillar is holding up over time.
            </p>
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <SecondaryButton size="sm" iconLeft="bar-chart" onClick={() => goTo('momentum')}>
                Open Momentum
              </SecondaryButton>
            </div>
          </GlassCard>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
