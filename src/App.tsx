import { useEffect, useState } from 'react';
import { AppShell, Banner, BootSplash, BottomNavigation, Screen, ScreenBody } from '@/components/layout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { MountainBackground, Snowfall, ToastStack } from '@/components/ui';
import { CelebrationOverlay, RankUpOverlay } from '@/components/celebration';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { TodayScreen } from '@/screens/TodayScreen';
import { WorkoutScreen } from '@/screens/WorkoutScreen';
import { DietScreen } from '@/screens/DietScreen';
import { StudiesScreen } from '@/screens/StudiesScreen';
import { SleepScreen } from '@/screens/SleepScreen';
import { JourneyScreen } from '@/screens/JourneyScreen';
import { CalendarScreen } from '@/screens/CalendarScreen';
import { RankScreen } from '@/screens/RankScreen';
import { MomentumScreen } from '@/screens/MomentumScreen';
import {
  AppearanceSettingsScreen,
  DataSettingsScreen,
  FocusSettingsScreen,
  GoalsSettingsScreen,
  HelpSettingsScreen,
  NotificationSettingsScreen,
  ProfileSettingsScreen,
  SettingsScreen,
  WidgetSettingsScreen,
} from '@/screens/SettingsScreen';
import { installPersistenceGuards, useAppStore } from '@/store/appStore';
import { useCurrentScreen, useNavigationStore, type ScreenKey } from '@/store/navigationStore';
import {
  useCompletedPillarCount,
  useQuoteUnlocked,
  useStreaks,
  useToday,
  useTotalXp,
} from '@/store/selectors';
import { useDayRollover, usePrefersReducedMotion } from '@/hooks';
import { isMilestoneDay } from '@/domain/journey';
import { preloadCriticalAssets } from '@/assets';
import { PILLARS } from '@/models';

type Gate = 'welcome' | 'onboarding' | 'app';

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  );
}

function AppRoot() {
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);
  const onboarded = useAppStore((s) => s.onboarded);
  const settings = useAppStore((s) => s.settings);
  const storageWarning = useAppStore((s) => s.storageWarning);
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  const [gate, setGate] = useState<Gate>('welcome');
  const [warningDismissed, setWarningDismissed] = useState(false);

  useDayRollover();

  useEffect(() => {
    hydrate();
    preloadCriticalAssets();
  }, [hydrate]);

  // Theme tokens and motion preference are applied to <html> so portals,
  // overlays and the scroll background all inherit them.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = settings.appearance.accent;
    root.dataset.contrast = settings.appearance.highContrast ? 'high' : 'normal';
    root.dataset.motion = settings.appearance.reduceMotion ? 'off' : 'on';
  }, [settings.appearance.accent, settings.appearance.highContrast, settings.appearance.reduceMotion]);

  useEffect(() => installPersistenceGuards(), []);

  if (!hydrated) return <BootSplash />;

  if (!onboarded) {
    if (gate === 'onboarding') return <OnboardingScreen onBack={() => setGate('welcome')} />;
    return <WelcomeScreen onBegin={() => setGate('onboarding')} />;
  }

  return (
    <>
      <MountainBackground />
      {settings.appearance.ambientEffects ? <AmbientSnow /> : null}

      <AppShell>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {storageWarning && !warningDismissed ? (
          <Banner message={storageWarning} onDismiss={() => setWarningDismissed(true)} />
        ) : null}
        <Router />
      </AppShell>

      <TabBarWithState />
      <Overlays />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function AmbientSnow() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return <Snowfall count={22} />;
}

function TabBarWithState() {
  const today = useToday();
  const completed = useCompletedPillarCount(today);
  return <BottomNavigation dayComplete={completed === PILLARS.length} />;
}

/* --------------------------------------------------------------- Router */

function Router() {
  const screen = useCurrentScreen();
  const tab = useNavigationStore((s) => s.tab);
  const replace = useNavigationStore((s) => s.replace);

  return (
    <div key={`${tab}:${screen}`} className="screen-fade" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {renderScreen(screen, replace)}
    </div>
  );
}

function renderScreen(screen: ScreenKey, replace: (s: ScreenKey) => void) {
  switch (screen) {
    case 'dashboard':
      return <DashboardScreen onSwitchView={() => replace('pillars')} />;
    case 'pillars':
      return <TodayScreen onSwitchView={() => replace('dashboard')} />;
    case 'workout':
      return <WorkoutScreen />;
    case 'diet':
      return <DietScreen />;
    case 'studies':
      return <StudiesScreen />;
    case 'sleep':
      return <SleepScreen />;
    case 'journey':
      return <JourneyScreen />;
    case 'calendar':
      return <CalendarScreen />;
    case 'rank':
      return <RankScreen />;
    case 'momentum':
      return <MomentumScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'settings-profile':
      return <ProfileSettingsScreen />;
    case 'settings-goals':
      return <GoalsSettingsScreen />;
    case 'settings-notifications':
      return <NotificationSettingsScreen />;
    case 'settings-appearance':
      return <AppearanceSettingsScreen />;
    case 'settings-focus':
      return <FocusSettingsScreen />;
    case 'settings-widgets':
      return <WidgetSettingsScreen />;
    case 'settings-data':
      return <DataSettingsScreen />;
    case 'settings-help':
      return <HelpSettingsScreen />;
    default:
      return <UnknownScreen />;
  }
}

function UnknownScreen() {
  const popToRoot = useNavigationStore((s) => s.popToRoot);
  return (
    <Screen>
      <ScreenBody>
        <div style={{ paddingTop: 'calc(var(--safe-top) + var(--sp-9))', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>Screen not found</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-3)' }}>
            That view does not exist any more.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 'var(--sp-5)' }}
            onClick={popToRoot}
          >
            Back to start
          </button>
        </div>
      </ScreenBody>
    </Screen>
  );
}

/* ------------------------------------------------------------- Overlays */

function Overlays() {
  const celebration = useAppStore((s) => s.celebration);
  const rankUp = useAppStore((s) => s.rankUp);
  const dismissCelebration = useAppStore((s) => s.dismissCelebration);
  const dismissRankUp = useAppStore((s) => s.dismissRankUp);
  const startDate = useAppStore((s) => s.profile?.startDate);
  const chimeEnabled = useAppStore((s) => s.settings.focusMode.chimeOnComplete);
  const ambient = useAppStore((s) => s.settings.appearance.ambientEffects);
  const streaks = useStreaks();
  const totalXp = useTotalXp();
  const bonusQuotes = useQuoteUnlocked();

  return (
    <>
      {celebration ? (
        <CelebrationOverlay
          payload={celebration}
          streak={streaks.current}
          isMilestone={startDate ? isMilestoneDay(startDate, celebration.date) : false}
          bonusQuotes={bonusQuotes}
          chimeEnabled={chimeEnabled}
          ambient={ambient}
          onDismiss={dismissCelebration}
        />
      ) : null}

      {!celebration && rankUp ? (
        <RankUpOverlay payload={rankUp} totalXp={totalXp} onDismiss={dismissRankUp} />
      ) : null}
    </>
  );
}
