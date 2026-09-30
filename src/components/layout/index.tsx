import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, IconButton, type IconName } from '@/components/ui';
import {
  TABS,
  TAB_LABELS,
  useCanGoBack,
  useNavigationStore,
  type TabKey,
} from '@/store/navigationStore';
import './layout.css';

/* ------------------------------------------------------------- AppShell */

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>;
}

/* ---------------------------------------------------------------- Screen */

export interface ScreenProps {
  children: ReactNode;
  /** Resets the scroll position whenever this value changes. */
  scrollKey?: string;
  immersive?: boolean;
  className?: string;
}

export function Screen({ children, scrollKey, immersive = false, className = '' }: ScreenProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [scrollKey]);

  return (
    <div className={['screen', immersive ? 'screen--immersive' : '', className].filter(Boolean).join(' ')}>
      <div className="screen__scroll" ref={scrollRef} id="main" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

export function ScreenBody({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return <div className={flush ? 'screen__body screen__body--flush' : 'screen__body'}>{children}</div>;
}

/* --------------------------------------------------------- ScreenHeader */

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Shows the back affordance. Defaults to whether the stack can pop. */
  back?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  transparent?: boolean;
  titleIcon?: IconName;
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  actions,
  transparent = false,
  titleIcon,
}: ScreenHeaderProps) {
  const canGoBack = useCanGoBack();
  const pop = useNavigationStore((s) => s.pop);
  const showBack = back ?? canGoBack;

  return (
    <header className={['sheader', transparent ? 'sheader--transparent' : ''].filter(Boolean).join(' ')}>
      {showBack ? (
        <button
          type="button"
          className="sheader__back"
          onClick={onBack ?? pop}
          aria-label={`Back from ${title}`}
        >
          <Icon name="chevron-left" size={21} />
        </button>
      ) : null}
      <div className="sheader__titles">
        <h1 className="sheader__title">
          {titleIcon ? (
            <Icon
              name={titleIcon}
              size={20}
              style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }}
            />
          ) : null}
          {title}
        </h1>
        {subtitle ? <p className="sheader__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="sheader__actions">{actions}</div> : null}
    </header>
  );
}

/* ----------------------------------------------------- BottomNavigation */

const TAB_ICONS: Record<TabKey, IconName> = {
  today: 'home',
  journey: 'route',
  calendar: 'calendar',
  rank: 'crown',
  more: 'more',
};

export function BottomNavigation({ dayComplete = false }: { dayComplete?: boolean }) {
  const tab = useNavigationStore((s) => s.tab);
  const setTab = useNavigationStore((s) => s.setTab);

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((key) => {
        const active = key === tab;
        return (
          <button
            key={key}
            type="button"
            className="tabbar__item"
            aria-current={active ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            <span className="tabbar__icon" aria-hidden="true">
              <Icon name={TAB_ICONS[key]} size={21} filled={false} />
            </span>
            {TAB_LABELS[key]}
            {key === 'today' && dayComplete ? (
              <span className="tabbar__dot" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/* --------------------------------------------------------------- Banner */

export function Banner({
  message,
  icon = 'alert',
  onDismiss,
}: {
  message: string;
  icon?: IconName;
  onDismiss?: () => void;
}) {
  return (
    <div className="banner" role="status">
      <span className="banner__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss ? <IconButton icon="close" label="Dismiss message" size={16} onClick={onDismiss} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------- Boot splash */

export function BootSplash() {
  return (
    <div className="boot">
      <span className="boot__ring" aria-hidden="true" />
      <span className="boot__mark">WINTER ARC</span>
      <span className="sr-only">Loading your Winter Arc</span>
    </div>
  );
}
