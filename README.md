# Winter Arc

A 90-day discipline system built as a mobile-first web app. Four pillars — Workout,
Diet, Studies and Sleep — are tracked every day. Completing them earns XP, which
drives rank progression, streaks, milestones and a full-day celebration.

Everything runs on the device. There is no account, no server and no network call
after the first load.

---

## 1. Setup

Requires **Node.js 20.19+ or 22.12+** and npm.

```bash
cd winter-arc
npm install
```

That installs React 19, TypeScript, Vite, Zustand, and Playwright and esbuild for
the test suites.

If you intend to run the browser suites, also install the browser binary once:

```bash
npx playwright install chromium
```

## 2. Running

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload on http://localhost:5173 |
| `npm run build` | Type-checks, then builds to `dist/` |
| `npm run preview` | Serves the built app on http://localhost:4173 |
| `npm run typecheck` | TypeScript only, no emit |

Open the app on a phone-sized viewport. In desktop Chrome, use device emulation at
390 × 844 for the intended experience; the layout is capped at 460px and centred on
wider screens.

## 3. Environment variables

**There are none.** The app has no backend, no API keys and no analytics. The only
build-time value it reads is Vite's own `import.meta.env.BASE_URL`, used in
`src/assets/index.ts` so the artwork resolves correctly when the app is hosted under
a sub-path. To deploy under one, set `base` in `vite.config.ts`.

## 4. Project structure

```
winter-arc/
├── index.html                 Entry document, fonts, theme colour
├── vite.config.ts             Build config, "@" alias to src/
├── public/assets/             The eight supplied artworks
├── qa/                        Test suites (see section 11)
└── src/
    ├── main.tsx               Mounts the app
    ├── App.tsx                Shell, gate, router, overlays
    │
    ├── models/                Every persisted type, in one file
    ├── domain/                Pure business logic, no React
    │   ├── pillars.ts         What "complete" means for each pillar
    │   ├── xp.ts              The XP ledger and its reconciler
    │   ├── rank.ts            Levels, tiers, rewards
    │   ├── history.ts         Day statuses, streaks, range rollups
    │   ├── journey.ts         Arc position, milestones, the map route
    │   └── reminders.ts       In-app reminders from notification settings
    │
    ├── services/              Side-effecting boundaries
    │   ├── storage.ts         StorageService contract + adapters
    │   ├── persistence.ts     Load, migrate, save, export, import
    │   ├── defaults.ts        Seed goals, settings, workout and meal templates
    │   └── quotes.ts          The quote rotation
    │
    ├── store/
    │   ├── appStore.ts        The single source of truth
    │   ├── navigationStore.ts Tabs and per-tab screen stacks
    │   └── selectors.ts       Memoised derived state for screens
    │
    ├── hooks/                 Timers, day rollover, focus trap, motion, audio
    ├── utils/                 Date, format and id helpers
    ├── assets/index.ts        The central asset map
    ├── styles/                Tokens, base, animations
    │
    ├── components/
    │   ├── ui/                GlassCard, buttons, rings, bars, modals, sheets,
    │   │                      tabs, toggles, steppers, toasts, icons, heroes
    │   ├── layout/            AppShell, Screen, ScreenHeader, BottomNavigation,
    │   │                      Banner, ErrorBoundary
    │   ├── pillars/           PillarTile and PillarRow
    │   ├── stats/             BarChart
    │   └── celebration/       CelebrationOverlay and RankUpOverlay
    │
    └── screens/               One file per screen, plus screens.css
```

The rule the tree enforces: **`domain/` never imports React, and `screens/` never
computes.** A screen reads a selector and calls a store action; every calculation
that decides XP, rank, streaks or day status lives in `domain/` and is unit-tested
there.

## 5. Data model

Defined in [`src/models/index.ts`](src/models/index.ts). `ISODate` is always a local
calendar day (`YYYY-MM-DD`); timestamps are epoch milliseconds.

| Entity | Purpose |
| --- | --- |
| `Profile` | Name, arc start date, chosen avatar |
| `Goals` | What a complete day requires, plus timer lengths and nutrition targets |
| `Settings` | Notifications, appearance, focus mode, widgets |
| `DayRecord` | One day: its workout, meals, study sessions, sleep, note |
| `WorkoutSession` → `Exercise` → `ExerciseSet` | The training log |
| `Meal` + `Nutrition` | A planned or eaten meal and its macros |
| `StudySession`, `StudyTask`, `StudyNote` | Focus log, to-dos, notes |
| `SleepRecord` | Bed time, wake time, derived minutes, quality, note |
| `XPTransaction` | One row of the XP ledger |
| `RankState`, `RankTier`, `Reward` | Derived rank standing |
| `Milestone`, `DailyHistoryEntry`, `PillarProgress` | Derived views |
| `PersistedState` | The whole saved blob, versioned |

Days are keyed by date in a single map, so reading any day is O(1) and the calendar
and journey grids never need a scan.

## 6. State architecture

### One store, one write path

`src/store/appStore.ts` holds all persisted state and every action. Each action that
touches a day goes through a single internal `commitDay` function, which:

1. Deep-copies the previous day so no action can mutate an earlier snapshot.
2. Applies the change.
3. **Reconciles the XP ledger for that date.**
4. Detects a level-up and a newly completed day.
5. Schedules a debounced save.

Screens never add XP, never touch streaks and never write the ledger.

### XP cannot duplicate, by construction

XP is not incremented. Every transaction has the deterministic id
`` `${date}:${source}` ``, and `reconcileDayXp` rebuilds that date's rows from the
day's actual records. A pillar that is complete has exactly one row; a pillar that
stops being complete loses its row.

The consequences are all desirable and all tested:

- Running the reconciler a thousand times awards the same XP as running it once.
- Un-ticking a meal withdraws that pillar's 50 XP **and** the 200 XP day bonus.
- Re-ticking it restores exactly the previous total, never more.
- Raising a goal mid-day re-scores the day immediately.

Awards: 50 XP per pillar, 200 XP for all four in a day, 250 XP more on a milestone
day. A perfect day is 400 XP; a perfect milestone day is 650.

### Everything else is derived

Streaks, rank, level, day status, consistency and the charts are computed from
history on read, never stored. A stored streak counter can drift from the history it
claims to summarise; a derived one cannot.

```
complete a workout
   └─ commitDay
        ├─ day record updated
        ├─ XP ledger reconciled for that date
        ├─ level-up detected
        ├─ full-day completion detected
        └─ save scheduled
             ↓  (all of these read from the same state)
   Dashboard · Today · Rank · Streak · Calendar · Journey · Momentum · Celebration
```

### Persistence

`StorageService` in `src/services/storage.ts` is a four-method contract. The
localStorage adapter is used when available; otherwise an in-memory adapter keeps
the session working and the app shows a banner saying changes will not be saved.
Swapping in a backend means writing one more adapter.

Writes are debounced at 220ms and flushed immediately on `pagehide`,
`beforeunload` and tab hide. Reads run through a migrator that repairs or rejects
anything that does not match the current shape, so corrupted data produces a clean
start rather than a blank screen.

## 7. Navigation map

Five tabs, each with its own independent screen stack, so switching tabs preserves
where you were. Tapping the active tab returns it to its root.

```
TODAY      dashboard ⇄ pillars          (header button toggles the two views)
             ├─ workout
             ├─ diet
             ├─ studies
             └─ sleep
JOURNEY    journey                       (Journey / Milestones tabs)
CALENDAR   calendar                      (month grid → day detail sheet)
RANK       rank
MORE       settings
             ├─ momentum
             ├─ settings-profile
             ├─ settings-goals
             ├─ settings-notifications
             ├─ settings-appearance
             ├─ settings-focus
             ├─ settings-widgets
             ├─ settings-data
             └─ settings-help
```

Overlays sit outside the stacks: the celebration, the rank-up dialog, modals, bottom
sheets and toasts. The celebration takes priority over the rank-up so they never
stack visually.

## 8. Design system

Tokens live in [`src/styles/tokens.css`](src/styles/tokens.css): colour, glass
surfaces, accents, per-pillar identity, gradients, glow, shadow, blur, radius, a 4/8
spacing scale, type scale, motion durations and easings, and layout constants.

Four accent themes (Arctic Blue, Aurora, Ember, Violet) are token overrides on
`:root[data-accent]`; three of them unlock at Level 3. A high-contrast mode is a
second override layer. Both are applied to `<html>` so portals inherit them.

All motion is transform and opacity only. It is disabled three ways: the OS
`prefers-reduced-motion` setting, the in-app Reduce Motion toggle, and the Ambient
Effects toggle for snowfall and halos specifically.

## 9. Assets

The eight supplied artworks are referenced **only** through
[`src/assets/index.ts`](src/assets/index.ts). Each entry carries its file, its alt
text and an `object-position` tuned so crops never cut the subject. Replacing an
artwork is a one-line change; no component holds a file path.

Images are never recreated in CSS and never have text baked in. They are cropped,
scaled, scrimmed and drifted, but their identity is left intact. The journey map is
a case in point: the artwork already contains the glowing switchback trail, so the
app samples that route (`pointOnRoute` in `domain/journey.ts`) and places milestone
pins and a "you are here" marker on it rather than drawing a second, competing line.

## 10. Feature checklist

**Welcome and onboarding**
- [x] Cinematic welcome over the mountaineer artwork, with the 90 / 4 / 1 stats
- [x] Four-step onboarding: intro, identity, goals, preferences
- [x] Name, arc start date (any date, including backdated), goal presets, per-goal steppers
- [x] Skip applies sensible defaults; completion is persisted

**Today**
- [x] Dashboard: greeting, date, day ring, XP, quote, four pillar tiles, streak card
- [x] Pillar list view with per-pillar progress, detail and XP, toggled from the header
- [x] Reminder banner driven by the notification settings

**Workout**
- [x] Strength / HIIT / Mobility, with plans that rotate by arc day
- [x] Per-set reps and weight, editable and persisted
- [x] Add, rename and remove exercises; add and remove sets
- [x] Workout timer with start, pause, resume and reset, accurate across backgrounding
- [x] Automatic rest timer on ticking a set, with a configurable length
- [x] Complete and reopen

**Diet**
- [x] Breakfast, lunch, dinner and snacks, with the supplied food artwork
- [x] Add, edit, delete and complete meals
- [x] Per-meal macros and live daily totals against calorie and protein targets
- [x] Separate "eaten" and "planned" totals

**Studies**
- [x] Focus timer with start, pause, resume, reset, +5 minutes and partial logging
- [x] Break mode, optional auto-start, optional completion chime
- [x] Session log with per-session removal and a daily total
- [x] Tasks: add, edit, complete, delete
- [x] Notes: add, edit, delete

**Sleep**
- [x] Bed and wake time pickers with live duration, correct across midnight
- [x] Quality rating and a note
- [x] 14-night history with per-night bars and an average

**Journey, Calendar, Rank, Momentum**
- [x] 90-day map with milestone pins and a live position marker
- [x] Every-day grid: secured, partial, missed, today, ahead
- [x] Month calendar with real states and a day-detail sheet
- [x] Rank: tier, level, XP progress, tier track, rewards, XP ledger
- [x] Momentum: 7D / 30D / 90D / All, consistency, sessions, streaks, charts, breakdown

**Settings**
- [x] Profile: name, start date, avatar picker, standing
- [x] Goals: every daily target, timer length and nutrition target
- [x] Notifications: master switch, daily reminder and time, streak and milestone alerts
- [x] Appearance: accent themes, high contrast, reduce motion, ambient effects
- [x] Focus mode: hide completed, keep awake, chime, auto-break
- [x] Widgets: quote, streak, next milestone, macros
- [x] Data: export to file, import from file, clear progress, delete everything
- [x] Help: expandable answers and version information

**System**
- [x] Celebration on 4/4, once per day, with the milestone variant
- [x] Rank-up dialog on crossing a level
- [x] Midnight rollover with no reload
- [x] Full offline operation
- [x] Error boundary, storage fallback, corrupted-data recovery

## 11. Testing summary

Four suites. The browser suites need the preview server running
(`npm run preview`) in another terminal.

| Command | Covers | Result |
| --- | --- | --- |
| `npm run test:domain` | Pure logic: dates, clock, pillars, XP, streaks, statuses, journey, rank, a simulated 90-day arc | **126 checks, 0 failed** |
| `npm run test:journey` | The whole user journey in Chromium at 390 × 844, plus accessibility and layout audits on every screen | **0 failed, 0 console errors, 0 page errors** |
| `npm run test:edge` | Milestone days, day 90 and beyond, midnight rollover, corrupted storage, unknown state shape, storage unavailable, goal changes re-scoring | **0 failed, 0 page errors** |
| `npm run test:visual` | Seeds a realistic 12-day history and captures every screen for design comparison | 12 screens, 0 page errors |

`npm run qa` runs the build and the first three in sequence.

The journey suite audits **every screen it visits** for horizontal overflow, touch
targets below 44 × 44, and controls without an accessible name, at 390px, 360px and
430px. It also asserts real behaviour rather than presence: that the workout timer
advances and holds on pause, that a rest timer starts when a set is ticked, that
nutrition totals match the stored meals, that undoing a meal withdraws XP and redoing
it restores the exact prior total, and that a reload returns to the dashboard with
completion intact.

### Bugs this testing found and fixed

Worth recording, because each was invisible from reading the code:

- **The document scrolled, not the screen container.** `.app-shell` used
  `min-height: 100dvh`, so tall screens grew the shell and the per-screen scroll
  reset silently did nothing — you could open a screen already scrolled halfway.
- **Chart bars were invisible.** A CSS `fill: url(#wa-bar)` rule overrode each
  chart's own gradient id, so only the muted bars rendered.
- **Title and description ran together.** Stacked `<span>` pairs across six
  components had no `display: block`, producing "WorkoutPush Day in progress".
- **Shared objects across state snapshots.** `commitDay` shallow-copied the meals
  array, so mutating a meal reached into the previous snapshot and React could miss
  the update.
- **Today was never shown as complete.** `dayStatusFor` returned `today` before
  checking completion, so a fully secured today never got its calendar tick.
- **Touch targets under 44px** on steppers, small buttons, checkmark toggles,
  exercise rows, task rows and both date grids.

## 12. Known limitations

- **Storage is per-browser.** Data lives in this browser's localStorage. It does not
  sync across devices or browsers. Use Export and Import in Data & Privacy to move
  it. Clearing site data erases it.
- **Two open tabs can overwrite each other.** Each tab flushes its own in-memory
  state on unload, so the last tab to close wins. Use one tab.
- **Notifications are in-app only.** With no server and no service worker there is
  no push. The notification preferences drive the reminder banner on the dashboard
  instead, which is why every switch there still does something visible.
- **No service worker.** The app works offline once loaded in a live tab, but it is
  not installable and a hard reload with no network will not start it. Adding a
  service worker would close this.
- **Timezone changes shift the arc.** Day numbers are computed from the local
  calendar day. Travelling across timezones can make a day appear to start or end
  early. History is never lost, only re-dated.
- **The journey route is tuned to the supplied artwork.** Replacing
  `06_Mountain_Journey.png` with a different composition means re-sampling `ROUTE`
  in `src/domain/journey.ts`, since the pins follow the trail painted in the image.
- **Rest and focus timers do not survive a full reload.** The workout timer does,
  because its elapsed seconds are persisted, but a running countdown is held in
  component state and resets if the tab is closed mid-session.
- **One workout per day.** The day record holds a single session, so the Workout
  pillar is always 1/1 and has no goal control. Two-a-days would need the model to
  hold an array of sessions.
- **Charts are bars only.** Line and stacked forms were not needed for the three
  views the design calls for.
