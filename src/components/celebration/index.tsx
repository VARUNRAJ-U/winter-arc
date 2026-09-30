import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getAsset } from '@/assets';
import { Icon, Modal, PrimaryButton, SecondaryButton } from '@/components/ui';
import { pillarIcon } from '@/components/ui/Icon';
import { PILLARS } from '@/models';
import { PILLAR_LABELS } from '@/domain/pillars';
import { FULL_DAY_XP, MILESTONE_XP } from '@/domain/xp';
import { rankForXp } from '@/domain/rank';
import { celebrationQuote } from '@/services/quotes';
import { useChime, useCountUp, usePrefersReducedMotion, useScrollLock, useEscapeKey } from '@/hooks';
import { formatNumber } from '@/utils/format';
import type { CelebrationPayload, RankUpPayload } from '@/store/appStore';
import '@/screens/screens.css';

export interface CelebrationOverlayProps {
  payload: CelebrationPayload;
  streak: number;
  isMilestone: boolean;
  bonusQuotes: boolean;
  chimeEnabled: boolean;
  ambient: boolean;
  onDismiss: () => void;
}

export function CelebrationOverlay({
  payload,
  streak,
  isMilestone,
  bonusQuotes,
  chimeEnabled,
  ambient,
  onDismiss,
}: CelebrationOverlayProps) {
  const art = getAsset('summitClimber');
  const reduced = usePrefersReducedMotion();
  const chime = useChime();
  const bonus = isMilestone ? FULL_DAY_XP + MILESTONE_XP : FULL_DAY_XP;
  const animatedXp = useCountUp(bonus, 1100);

  useScrollLock(true);
  useEscapeKey(true, onDismiss);

  useEffect(() => {
    if (chimeEnabled) chime();
    // Fires once when the overlay mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const embers = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: 6 + Math.random() * 88,
        delay: Math.random() * 3.5,
        duration: 3.2 + Math.random() * 3,
        x: `${(Math.random() - 0.5) * 90}px`,
        y: `${-140 - Math.random() * 220}px`,
        size: 2 + Math.random() * 3.5,
      })),
    [],
  );

  return createPortal(
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={`Day ${payload.dayNumber} complete`}>
      <div className="celebrate__art" aria-hidden="true">
        <img src={art.src} alt="" decoding="async" />
        <span className="celebrate__scrim" />
      </div>

      {ambient && !reduced ? (
        <div className="embers" aria-hidden="true">
          {embers.map((e) => (
            <span
              key={e.id}
              className="ember"
              style={{
                left: `${e.left}%`,
                width: e.size,
                height: e.size,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.duration}s`,
                ['--ember-x' as string]: e.x,
                ['--ember-y' as string]: e.y,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="celebrate__inner">
        <p className="celebrate__eyebrow wa-enter">Day {payload.dayNumber} Complete</p>
        <h1 className="celebrate__title wa-enter wa-enter-1">
          Another Day
          <br />
          Secured
        </h1>
        <p className="celebrate__sub wa-enter wa-enter-2">4 / 4 Pillars Completed</p>

        <div className="celebrate__pillars">
          {PILLARS.map((key, i) => (
            <span
              key={key}
              className="celebrate__pillar"
              style={{ animationDelay: `${120 + i * 90}ms` }}
              aria-hidden="true"
            >
              <Icon name={pillarIcon[key]} size={23} />
            </span>
          ))}
          <span className="sr-only">
            {PILLARS.map((k) => PILLAR_LABELS[k]).join(', ')} all complete
          </span>
        </div>

        <div className="celebrate__spacer" />

        <div className="celebrate__rewards wa-enter wa-enter-4">
          <div className="celebrate__reward">
            <div>
              <div className="celebrate__rewardValue">+{formatNumber(animatedXp)} XP</div>
              <div className="celebrate__rewardLabel">
                {isMilestone ? 'Milestone bonus' : 'Daily bonus'}
              </div>
            </div>
          </div>
          <div className="celebrate__reward">
            <span className="celebrate__flame" aria-hidden="true">
              <Icon name="flame" size={26} />
            </span>
            <div>
              <div className="celebrate__rewardValue">{streak}</div>
              <div className="celebrate__rewardLabel">Day Streak</div>
            </div>
          </div>
        </div>

        <p className="celebrate__quote wa-enter wa-enter-5">
          &ldquo;{celebrationQuote(payload.date, bonusQuotes)}&rdquo;
        </p>

        <PrimaryButton block size="lg" iconRight="arrow-right" onClick={onDismiss} className="wa-enter wa-enter-6">
          On to Day {payload.dayNumber + 1}
        </PrimaryButton>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- Rank up */

export function RankUpOverlay({
  payload,
  totalXp,
  onDismiss,
}: {
  payload: RankUpPayload;
  totalXp: number;
  onDismiss: () => void;
}) {
  const rank = rankForXp(totalXp);
  const chime = useChime();

  useEffect(() => {
    chime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      open
      onClose={onDismiss}
      title="Rank up"
      description={`Level ${payload.fromLevel} to Level ${payload.toLevel}`}
      footer={
        <>
          <SecondaryButton onClick={onDismiss}>Close</SecondaryButton>
          <PrimaryButton onClick={onDismiss}>Keep climbing</PrimaryButton>
        </>
      }
    >
      <div className="rankup">
        <span className="rankup__badge">
          <span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--fs-micro)',
                letterSpacing: 'var(--ls-wide)',
                color: 'var(--text-secondary)',
              }}
            >
              LEVEL
            </span>
            <span className="rankup__level">{payload.toLevel}</span>
          </span>
        </span>
        <p className="rankup__title">{rank.tier.name}</p>
        <p className="rankup__desc">
          {formatNumber(totalXp)} XP earned.{' '}
          {rank.nextLevelXp === null
            ? 'You have reached the highest level.'
            : `${formatNumber(rank.nextLevelXp - totalXp)} XP to Level ${payload.toLevel + 1}.`}
        </p>
      </div>
    </Modal>
  );
}
