import { getAsset } from '@/assets';
import { PrimaryButton, Snowfall } from '@/components/ui';
import { ARC_LENGTH } from '@/utils/date';
import './screens.css';

export function WelcomeScreen({ onBegin }: { onBegin: () => void }) {
  const art = getAsset('mountaineer');

  return (
    <div className="welcome">
      <div className="welcome__art" aria-hidden="true">
        <img src={art.src} alt="" fetchPriority="high" decoding="async" />
        <span className="welcome__scrim" />
      </div>
      <Snowfall count={18} />

      <div className="welcome__inner">
        <h1 className="welcome__brand wa-enter">
          WINTER
          <br />
          ARC
        </h1>
        <p className="welcome__tagline wa-enter wa-enter-2">
          Discipline today
          <br />
          A stronger you tomorrow
        </p>

        <div className="welcome__spacer" />

        <div className="welcome__stats wa-enter wa-enter-4">
          <div className="welcome__stat">
            <b className="numeric">{ARC_LENGTH}</b>
            <span>Days</span>
          </div>
          <div className="welcome__stat">
            <b className="numeric">4</b>
            <span>Pillars</span>
          </div>
          <div className="welcome__stat">
            <b className="numeric">1</b>
            <span>Mission</span>
          </div>
        </div>

        <div className="wa-enter wa-enter-5">
          <PrimaryButton block size="lg" iconRight="arrow-right" onClick={onBegin}>
            Begin Your Journey
          </PrimaryButton>
          <p className="welcome__foot">Harder days create a stronger you.</p>
        </div>
      </div>
    </div>
  );
}
