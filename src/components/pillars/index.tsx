import type { PillarProgress } from '@/models';
import { CheckMark, Icon, ProgressBar } from '@/components/ui';
import { pillarIcon } from '@/components/ui/Icon';
import { PILLAR_COLOR_VAR } from '@/domain/pillars';
import { clamp, formatDuration } from '@/utils/format';

function progressValue(p: PillarProgress): number {
  return clamp(p.target > 0 ? p.current / p.target : 0, 0, 1);
}

/** The short status shown on the compact dashboard tile. */
function tileStatus(p: PillarProgress): string {
  if (p.key === 'sleep') {
    if (p.complete) return formatDuration(p.current);
    return p.current > 0 ? formatDuration(p.current) : 'In Progress';
  }
  return `${p.current}/${p.target}`;
}

export function PillarTile({
  pillar,
  onOpen,
}: {
  pillar: PillarProgress;
  onOpen: () => void;
}) {
  const value = progressValue(pillar);
  const status = tileStatus(pillar);

  return (
    <button
      type="button"
      className={`ptile${pillar.complete ? ' ptile--done' : ''}`}
      style={{ ['--tile-color' as string]: PILLAR_COLOR_VAR[pillar.key] }}
      onClick={onOpen}
      aria-label={`${pillar.label}. ${pillar.detail}. Open ${pillar.label}.`}
    >
      <div className="ptile__top">
        <span className="ptile__icon" aria-hidden="true">
          <Icon name={pillarIcon[pillar.key]} size={22} />
        </span>
        <CheckMark on={pillar.complete} small />
      </div>
      <span className="ptile__row">
        <span className="ptile__name">{pillar.label}</span>
        <span className="ptile__meta">
          <span className={pillar.complete ? 'ptile__count' : 'ptile__count ptile__count--pending'}>
            {status}
          </span>
        </span>
      </span>
      <ProgressBar className="ptile__bar" value={value} size="sm" label={`${pillar.label} progress`} />
    </button>
  );
}

export function PillarRow({
  pillar,
  onOpen,
}: {
  pillar: PillarProgress;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`prow${pillar.complete ? ' prow--done' : ''}`}
      style={{ ['--tile-color' as string]: PILLAR_COLOR_VAR[pillar.key] }}
      onClick={onOpen}
      aria-label={`${pillar.label}. ${pillar.detail}. Open ${pillar.label}.`}
    >
      <span className="prow__icon" aria-hidden="true">
        <Icon name={pillarIcon[pillar.key]} size={24} />
      </span>
      <span className="prow__body">
        <span className="prow__title">{pillar.key === 'sleep' ? sleepTitle(pillar) : pillar.label}</span>
        <span className="prow__desc">{pillar.detail}</span>
        {pillar.complete ? <span className="prow__xp">+{pillar.xp} XP</span> : null}
      </span>
      <CheckMark on={pillar.complete} />
    </button>
  );
}

function sleepTitle(p: PillarProgress): string {
  const hours = p.target / 60;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${label} Hours Sleep`;
}
