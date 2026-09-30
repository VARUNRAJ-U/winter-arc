/**
 * Winter Arc edge-case drive.
 *
 * Covers the situations the happy path cannot reach: milestone days, the
 * midnight rollover, the end of the arc, corrupted storage and storage that
 * refuses to write.
 *
 *   node qa/edge.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = path.resolve('qa/edge');

const failures = [];
const pageErrors = [];

const fail = (m) => {
  failures.push(m);
  console.log(`  FAIL  ${m}`);
};
const pass = (m) => console.log(`  ok    ${m}`);

const STORAGE_KEY = 'winter-arc:state:v1';

/** Builds a state whose arc start places today on `dayNumber`. */
function makeSeed({ dayNumber, securedBefore, todayPillars }) {
  return function seed() {
    const cfg = window.__WA_SEED__;
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (cfg.dayNumber - 1));

    const days = {};
    const ledger = [];
    const mk = (date, pillars) => {
      const d = {
        date,
        workout:
          pillars >= 1
            ? { id: 'w' + date, date, mode: 'strength', title: 'Push Day', focus: 'Chest', exercises: [], elapsedSeconds: 60, runningSince: null, completed: true, completedAt: 1 }
            : null,
        meals: Array.from({ length: pillars >= 2 ? 3 : 0 }, (_, i) => ({
          id: `m${date}${i}`, date, slot: 'breakfast', title: 'Meal', items: '', note: '', time: '08:00',
          nutrition: { calories: 500, protein: 30, carbs: 50, fats: 15 }, asset: null, completed: true, completedAt: 1,
        })),
        studySessions: Array.from({ length: pillars >= 3 ? 2 : 0 }, (_, i) => ({
          id: `s${date}${i}`, date, label: 'Session', targetMinutes: 50, seconds: 3000, completedAt: 1,
        })),
        sleep:
          pillars >= 4
            ? { id: 'sl' + date, date, bedTime: '22:30', wakeTime: '06:30', minutes: 480, quality: 4, note: '', loggedAt: 1 }
            : null,
        note: '',
        celebratedAt: pillars >= 4 ? 1 : null,
      };
      const sources = [];
      if (pillars >= 1) sources.push('workout');
      if (pillars >= 2) sources.push('diet');
      if (pillars >= 3) sources.push('studies');
      if (pillars >= 4) sources.push('sleep');
      for (const s of sources) ledger.push({ id: `${date}:${s}`, date, source: s, amount: 50, label: 'Seeded', awardedAt: 1 });
      if (pillars >= 4) ledger.push({ id: `${date}:day`, date, source: 'day', amount: 200, label: 'Full day secured', awardedAt: 1 });
      return d;
    };

    for (let i = 0; i < cfg.dayNumber - 1; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days[iso(d)] = mk(iso(d), cfg.securedBefore ? 4 : 0);
    }
    days[iso(today)] = mk(iso(today), cfg.todayPillars);

    localStorage.setItem(
      'winter-arc:state:v1',
      JSON.stringify({
        version: 1,
        onboarded: true,
        profile: { name: 'Alex Carter', startDate: iso(start), createdAt: 1, avatarAsset: null, frameUnlocked: false },
        goals: {
          mealsPerDay: 3, studySessionsPerDay: 2, focusSessionMinutes: 50,
          breakMinutes: 10, sleepTargetHours: 8, bedTime: '22:30', wakeTime: '06:30',
          calorieTarget: 2200, proteinTarget: 150, restSeconds: 90,
        },
        settings: {
          notifications: { enabled: true, dailyReminder: true, reminderTime: '07:00', streakAlerts: true, milestoneAlerts: true },
          appearance: { accent: 'arctic', highContrast: false, reduceMotion: false, ambientEffects: false },
          focusMode: { hideCompleted: false, keepScreenAwake: false, chimeOnComplete: false, autoStartBreaks: false },
          widgets: { showQuote: true, showStreak: true, showNextMilestone: true, showMacros: true },
        },
        days,
        tasks: [],
        notes: [],
        xpLedger: ledger,
        seenRankLevel: 20,
        lastActiveDate: iso(today),
      }),
    );
  };
}

async function newSeededPage(browser, cfg, extraInit) {
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript((c) => {
    window.__WA_SEED__ = c;
  }, cfg);
  if (extraInit) await context.addInitScript(extraInit);
  await context.addInitScript(makeSeed(cfg));
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  return { context, page };
}

const readXp = (page) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (!raw) return 0;
    return JSON.parse(raw).xpLedger.reduce((s, t) => s + t.amount, 0);
  }, STORAGE_KEY);

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  console.log(`\nWinter Arc edge cases -> ${BASE}\n`);

  /* -------------------------------------------- 1. Milestone day 30 bonus */
  console.log('1. Milestone day 30');
  {
    const { context, page } = await newSeededPage(browser, {
      dayNumber: 30,
      securedBefore: true,
      todayPillars: 3, // everything but sleep
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.dash__dayValue', { timeout: 15000 });
    const day = (await page.locator('.dash__dayValue').textContent())?.trim();
    if (day !== '30') fail(`Milestone: expected Day 30, saw ${day}`);
    else pass('Milestone: the arc reports day 30');

    const before = await readXp(page);

    await page.getByRole('button', { name: /^Sleep\./ }).click();
    await page.waitForSelector('text=Recover. Reset. Dominate.');
    await page.getByRole('button', { name: /Complete Sleep/i }).click();
    await page.waitForTimeout(1200);

    if (!(await page.locator('.celebrate').isVisible())) {
      fail('Milestone: celebration did not appear');
    } else {
      pass('Milestone: celebration appeared');
      const label = await page.locator('.celebrate__rewardLabel').first().textContent();
      if (!/Milestone bonus/i.test(label ?? '')) fail(`Milestone: reward reads "${label?.trim()}"`);
      else pass('Milestone: the overlay names the milestone bonus');
      const value = await page.locator('.celebrate__rewardValue').first().textContent();
      if (!/450/.test(value ?? '')) fail(`Milestone: bonus shows "${value?.trim()}", expected 450`);
      else pass('Milestone: the bonus is 450 XP');
      await page.screenshot({ path: path.join(OUT, '01-milestone-celebration.png') });
    }

    const after = await readXp(page);
    // Sleep (50) + full day (200) + milestone (250).
    if (after - before !== 500) fail(`Milestone: XP rose by ${after - before}, expected 500`);
    else pass('Milestone: XP rose by 500');

    const streak = await page.locator('.celebrate__rewardValue').nth(1).textContent();
    if (streak?.trim() !== '30') fail(`Milestone: streak shows ${streak?.trim()}, expected 30`);
    else pass('Milestone: the streak reads 30');

    await context.close();
  }

  /* ---------------------------------------------------- 2. Day 90 and past */
  console.log('2. End of the arc');
  {
    const { context, page } = await newSeededPage(browser, { dayNumber: 90, securedBefore: true, todayPillars: 4 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.dash__dayValue');
    const day = (await page.locator('.dash__dayValue').textContent())?.trim();
    if (day !== '90') fail(`Arc end: expected Day 90, saw ${day}`);
    else pass('Arc end: the dashboard reports day 90');

    await page.locator('.tabbar__item', { hasText: 'Journey' }).click();
    await page.waitForTimeout(700);
    const status = await page.locator('.jr__statusNote').textContent();
    if (!/1 day remaining/i.test(status ?? '')) fail(`Arc end: journey says "${status?.trim()}"`);
    else pass('Arc end: journey shows one day remaining');
    const reachedPins = await page.locator('.jr__pinDot--reached').count();
    if (reachedPins !== 3) fail(`Arc end: ${reachedPins} milestone pins reached, expected 3`);
    else pass('Arc end: all three milestones are marked reached');
    await page.screenshot({ path: path.join(OUT, '02-day-90.png') });
    await context.close();
  }

  {
    const { context, page } = await newSeededPage(browser, { dayNumber: 95, securedBefore: true, todayPillars: 4 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.dash__dayValue');
    const day = (await page.locator('.dash__dayValue').textContent())?.trim();
    if (day !== '90') fail(`Past the arc: day should clamp to 90, saw ${day}`);
    else pass('Past the arc: the day number clamps at 90');
    await page.locator('.tabbar__item', { hasText: 'Journey' }).click();
    await page.waitForTimeout(600);
    const status = await page.locator('.jr__statusNote').textContent();
    if (!/Arc complete/i.test(status ?? '')) fail(`Past the arc: journey says "${status?.trim()}"`);
    else pass('Past the arc: journey reports the arc is complete');
    await page.screenshot({ path: path.join(OUT, '03-arc-complete.png') });
    await context.close();
  }

  /* ------------------------------------------------- 3. Midnight rollover */
  console.log('3. Midnight rollover');
  {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
      viewport: { width: 390, height: 844 },
    });
    // Freeze the clock just before midnight, with the arc on day 5.
    const fixed = new Date();
    fixed.setHours(23, 58, 0, 0);
    await context.clock.install({ time: fixed });
    await context.addInitScript((c) => {
      window.__WA_SEED__ = c;
    }, { dayNumber: 5, securedBefore: true, todayPillars: 4 });
    await context.addInitScript(makeSeed({ dayNumber: 5, securedBefore: true, todayPillars: 4 }));
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.dash__dayValue');
    const before = (await page.locator('.dash__dayValue').textContent())?.trim();
    if (before !== '5') fail(`Rollover: expected Day 5 before midnight, saw ${before}`);
    else pass('Rollover: day 5 before midnight');

    const beforeCount = await page.evaluate(() =>
      document.querySelectorAll('.ptile .checkmark--on').length,
    );
    if (beforeCount !== 4) fail(`Rollover: expected 4 secured pillars, saw ${beforeCount}`);
    else pass('Rollover: all four pillars secured before midnight');

    // Cross midnight.
    await context.clock.fastForward('00:05:00');
    await page.waitForTimeout(1500);

    const after = (await page.locator('.dash__dayValue').textContent())?.trim();
    if (after !== '6') fail(`Rollover: expected Day 6 after midnight, saw ${after}`);
    else pass('Rollover: the day advanced to 6 without a reload');

    const afterCount = await page.evaluate(() =>
      document.querySelectorAll('.ptile .checkmark--on').length,
    );
    if (afterCount !== 0) fail(`Rollover: new day should start empty, saw ${afterCount} secured`);
    else pass('Rollover: the new day starts with nothing secured');

    await page.screenshot({ path: path.join(OUT, '04-after-midnight.png') });

    // Yesterday must still be intact. The calendar may have rolled into a new
    // month, so count secured days across this month and the previous one.
    await page.locator('.tabbar__item', { hasText: 'Calendar' }).click();
    await page.waitForTimeout(700);
    const thisMonth = await page.locator('.cal__cell--complete').count();
    await page.screenshot({ path: path.join(OUT, '05-after-midnight-calendar.png') });
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.waitForTimeout(500);
    const prevMonth = await page.locator('.cal__cell--complete').count();
    // Days sitting in both grids are counted once by taking the larger view.
    const storedSecured = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('winter-arc:state:v1'));
      return Object.values(raw.days).filter(
        (d) =>
          d.workout?.completed &&
          d.meals.filter((m) => m.completed).length >= 3 &&
          d.studySessions.length >= 2 &&
          (d.sleep?.minutes ?? 0) >= 480,
      ).length;
    });
    if (storedSecured !== 5) fail(`Rollover: stored history has ${storedSecured} secured days, expected 5`);
    else pass('Rollover: all five earlier days survived in storage');
    if (Math.max(thisMonth, prevMonth) < 4) {
      fail(`Rollover: calendar shows too few secured days (${thisMonth}/${prevMonth})`);
    } else {
      pass(`Rollover: the calendar still renders the secured days (${thisMonth} this month, ${prevMonth} previous)`);
    }

    await context.close();
  }

  /* -------------------------------------------------- 4. Corrupted storage */
  console.log('4. Corrupted storage');
  {
    const context = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('winter-arc:state:v1', '{ this is not json ');
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    if (await page.locator('text=Begin Your Journey').isVisible()) {
      pass('Corrupted storage: recovered to the welcome screen instead of crashing');
    } else {
      fail('Corrupted storage: the app did not recover');
    }
    await page.screenshot({ path: path.join(OUT, '06-corrupt-recovery.png') });
    await context.close();
  }

  /* ------------------------------------------------- 5. Unknown state shape */
  console.log('5. Unknown state shape');
  {
    const context = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('winter-arc:state:v1', JSON.stringify({ version: 99, onboarded: true }));
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    if (await page.locator('text=Begin Your Journey').isVisible()) {
      pass('Future version: refused the unknown shape and started clean');
    } else {
      fail('Future version: did not fall back to a clean start');
    }
    await context.close();
  }

  /* ------------------------------------------------- 6. Storage unavailable */
  console.log('6. Storage unavailable');
  {
    const context = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      // Emulate a browser with site data blocked.
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Access denied', 'SecurityError');
        },
      });
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    if (await page.locator('text=Begin Your Journey').isVisible()) {
      pass('No storage: the app still runs');
    } else {
      fail('No storage: the app failed to start');
    }
    // And onboarding must still complete in memory.
    await page.getByRole('button', { name: /Begin Your Journey/i }).click();
    await page.waitForSelector('text=More Than Habits');
    await page.getByRole('button', { name: /Skip/i }).click();
    await page.waitForTimeout(900);
    if (await page.locator('.dash__dayValue').isVisible()) {
      pass('No storage: onboarding completes and the dashboard renders');
    } else {
      fail('No storage: could not get past onboarding');
    }
    await page.screenshot({ path: path.join(OUT, '07-no-storage.png') });
    await context.close();
  }

  /* --------------------------------------------- 7. Goal change re-scores */
  console.log('7. Changing a goal re-scores today');
  {
    const { context, page } = await newSeededPage(browser, { dayNumber: 4, securedBefore: true, todayPillars: 3 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.dash__dayValue');
    const before = await readXp(page);

    await page.locator('.tabbar__item', { hasText: 'More' }).click();
    await page.waitForSelector('text=Customise Your Journey');
    await page.getByRole('button', { name: /^Goals & Preferences/ }).click();
    await page.waitForSelector('text=What a complete day means');
    // Dropping the focus-session goal to 1 leaves Studies already satisfied,
    // so nothing should change; raising meals to 4 must revoke Diet's XP.
    for (let i = 0; i < 1; i += 1) {
      await page.getByRole('button', { name: 'Increase Meals per day' }).click();
      await page.waitForTimeout(300);
    }
    const after = await readXp(page);
    if (after >= before) fail(`Goal change: XP did not fall (${before} -> ${after})`);
    else pass(`Goal change: raising the meal goal revoked that XP (${before} -> ${after})`);

    await page.getByRole('button', { name: 'Decrease Meals per day' }).click();
    await page.waitForTimeout(400);
    const restored = await readXp(page);
    if (restored !== before) fail(`Goal change: XP did not return exactly (${before} vs ${restored})`);
    else pass('Goal change: reverting the goal restores the exact XP');
    await context.close();
  }

  await browser.close();

  console.log('\n--- Page errors ---');
  if (pageErrors.length === 0) console.log('  none');
  else pageErrors.slice(0, 10).forEach((e) => console.log(`  ${e}`));

  console.log('\n=====================================');
  console.log(`Checks failed: ${failures.length}`);
  console.log(`Page errors: ${pageErrors.length}`);
  console.log('=====================================\n');
  if (failures.length) failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(failures.length + pageErrors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\nEdge run crashed:', e);
  process.exit(2);
});
