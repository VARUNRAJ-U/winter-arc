import { create } from 'zustand';

export const TABS = ['today', 'journey', 'calendar', 'rank', 'more'] as const;
export type TabKey = (typeof TABS)[number];

export type ScreenKey =
  | 'dashboard'
  | 'pillars'
  | 'workout'
  | 'diet'
  | 'studies'
  | 'sleep'
  | 'journey'
  | 'calendar'
  | 'rank'
  | 'settings'
  | 'settings-profile'
  | 'settings-goals'
  | 'settings-notifications'
  | 'settings-appearance'
  | 'settings-focus'
  | 'settings-widgets'
  | 'settings-data'
  | 'settings-help'
  | 'momentum';

export const TAB_ROOTS: Record<TabKey, ScreenKey> = {
  today: 'dashboard',
  journey: 'journey',
  calendar: 'calendar',
  rank: 'rank',
  more: 'settings',
};

export const TAB_LABELS: Record<TabKey, string> = {
  today: 'Today',
  journey: 'Journey',
  calendar: 'Calendar',
  rank: 'Rank',
  more: 'More',
};

/** Screens that own the full viewport and hide the tab bar. */
export const FULLSCREEN_SCREENS: ScreenKey[] = [];

interface NavigationState {
  tab: TabKey;
  /** One independent stack per tab, so tab state survives switching. */
  stacks: Record<TabKey, ScreenKey[]>;
  /** Direction hint for the screen transition. */
  direction: 1 | -1;
  setTab: (tab: TabKey) => void;
  push: (screen: ScreenKey) => void;
  pop: () => void;
  popToRoot: () => void;
  replace: (screen: ScreenKey) => void;
  /** Jump to a screen in whichever tab owns it. */
  goTo: (screen: ScreenKey) => void;
  reset: () => void;
}

const SCREEN_TAB: Partial<Record<ScreenKey, TabKey>> = {
  dashboard: 'today',
  pillars: 'today',
  workout: 'today',
  diet: 'today',
  studies: 'today',
  sleep: 'today',
  journey: 'journey',
  calendar: 'calendar',
  rank: 'rank',
  momentum: 'more',
  settings: 'more',
  'settings-profile': 'more',
  'settings-goals': 'more',
  'settings-notifications': 'more',
  'settings-appearance': 'more',
  'settings-focus': 'more',
  'settings-widgets': 'more',
  'settings-data': 'more',
  'settings-help': 'more',
};

const emptyStacks = (): Record<TabKey, ScreenKey[]> => ({
  today: [TAB_ROOTS.today],
  journey: [TAB_ROOTS.journey],
  calendar: [TAB_ROOTS.calendar],
  rank: [TAB_ROOTS.rank],
  more: [TAB_ROOTS.more],
});

export const useNavigationStore = create<NavigationState>()((set, get) => ({
  tab: 'today',
  stacks: emptyStacks(),
  direction: 1,

  setTab: (tab) => {
    const current = get().tab;
    if (current === tab) {
      // Tapping the active tab returns to its root, the standard mobile idiom.
      set((s) => ({ stacks: { ...s.stacks, [tab]: [TAB_ROOTS[tab]] }, direction: -1 }));
      return;
    }
    set({ tab, direction: 1 });
  },

  push: (screen) =>
    set((s) => {
      const stack = s.stacks[s.tab];
      if (stack[stack.length - 1] === screen) return s;
      return { stacks: { ...s.stacks, [s.tab]: [...stack, screen] }, direction: 1 };
    }),

  pop: () =>
    set((s) => {
      const stack = s.stacks[s.tab];
      if (stack.length <= 1) return s;
      return { stacks: { ...s.stacks, [s.tab]: stack.slice(0, -1) }, direction: -1 };
    }),

  popToRoot: () =>
    set((s) => ({ stacks: { ...s.stacks, [s.tab]: [TAB_ROOTS[s.tab]] }, direction: -1 })),

  replace: (screen) =>
    set((s) => {
      const stack = s.stacks[s.tab];
      return { stacks: { ...s.stacks, [s.tab]: [...stack.slice(0, -1), screen] }, direction: 1 };
    }),

  goTo: (screen) => {
    const tab = SCREEN_TAB[screen] ?? 'today';
    set((s) => {
      const root = TAB_ROOTS[tab];
      const stack = screen === root ? [root] : [root, screen];
      return { tab, stacks: { ...s.stacks, [tab]: stack }, direction: 1 };
    });
  },

  reset: () => set({ tab: 'today', stacks: emptyStacks(), direction: 1 }),
}));

export function useCurrentScreen(): ScreenKey {
  return useNavigationStore((s) => {
    const stack = s.stacks[s.tab];
    return stack[stack.length - 1];
  });
}

export function useCanGoBack(): boolean {
  return useNavigationStore((s) => s.stacks[s.tab].length > 1);
}
