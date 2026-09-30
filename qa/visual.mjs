/**
 * Seeds a realistic multi-week history straight into storage, then captures
 * every screen at phone size so the design can be compared to the references.
 *
 *   node qa/visual.mjs [baseUrl] [outDir]
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? path.resolve('qa/visual');

const pageErrors = [];

function seedScript() {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 11); // puts us on day 12, as in the reference

  const days = {};
  const ledger = [];
  const uid = (p, i) => `${p}_${i}`;

  for (let i = 0; i < 12; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = iso(d);
    const isToday = i === 11;
    // A believable mix: mostly secured, a couple of partial days, one missed.
    const pattern = [4, 4, 3, 4, 4, 4, 2, 4, 4, 4, 4, isToday ? 3 : 4][i];

    const meals = [
      { slot: 'breakfast', title: 'Breakfast', items: 'Oats, berries, banana', note: 'High protein, clean carbs', time: '07:30', asset: 'breakfast', n: [520, 32, 58, 14] },
      { slot: 'lunch', title: 'Lunch', items: 'Chicken, rice, vegetables', note: 'Whole foods, clean fuel', time: '12:30', asset: 'lunch', n: [540, 45, 60, 16] },
      { slot: 'dinner', title: 'Dinner', items: 'Salmon, quinoa, greens', note: 'Recover and rebuild', time: '19:00', asset: 'lunch', n: [610, 42, 48, 24] },
    ].map((m, mi) => ({
      id: uid(`meal${i}`, mi),
      date,
      slot: m.slot,
      title: m.title,
      items: m.items,
      note: m.note,
      time: m.time,
      nutrition: { calories: m.n[0], protein: m.n[1], carbs: m.n[2], fats: m.n[3] },
      asset: m.asset,
      completed: pattern >= 2,
      completedAt: pattern >= 2 ? Date.now() : null,
    }));

    const exercises = [
      ['Bench Press', 4, '8-10', 60, 8],
      ['Incline Dumbbell Press', 4, '10', 22, 10],
      ['Shoulder Press', 3, '10', 40, 10],
      ['Tricep Dips', 3, '12', 0, 12],
      ['Cable Pushdown', 3, '12', 25, 12],
    ].map((e, ei) => ({
      id: uid(`ex${i}`, ei),
      name: e[0],
      targetSets: e[1],
      targetReps: e[2],
      done: pattern >= 1 && (!isToday || ei === 0),
      sets: Array.from({ length: e[1] }, (_, si) => ({
        id: uid(`set${i}_${ei}`, si),
        reps: e[4],
        weight: e[3],
        done: pattern >= 1 && (!isToday || ei === 0),
      })),
    }));

    days[date] = {
      date,
      workout:
        pattern >= 1
          ? {
              id: uid('w', i),
              date,
              mode: 'strength',
              title: 'Push Day',
              focus: 'Chest · Shoulders · Triceps',
              exercises,
              elapsedSeconds: isToday ? 2712 : 3180,
              runningSince: null,
              completed: !isToday,
              completedAt: isToday ? null : Date.now(),
            }
          : null,
      meals,
      studySessions:
        pattern >= 3
          ? [
              { id: uid('s1', i), date, label: 'Morning Session', targetMinutes: 50, seconds: 3000, completedAt: Date.now() },
              { id: uid('s2', i), date, label: 'Evening Session', targetMinutes: 50, seconds: 3000, completedAt: Date.now() },
            ]
          : [],
      sleep:
        pattern === 4
          ? { id: uid('sl', i), date, bedTime: '22:30', wakeTime: '06:30', minutes: 480, quality: 4, note: '', loggedAt: Date.now() }
          : null,
      note: i === 6 ? 'Travel day. Kept the food clean, lost the gym.' : '',
      celebratedAt: pattern === 4 ? Date.now() : null,
    };

    // Ledger mirrors what the reconciler would have produced.
    const earned = [];
    if (pattern >= 1) earned.push('workout');
    if (pattern >= 2) earned.push('diet');
    if (pattern >= 3) earned.push('studies');
    if (pattern === 4) earned.push('sleep');
    for (const source of earned) {
      ledger.push({ id: `${date}:${source}`, date, source, amount: 50, label: 'Seeded', awardedAt: Date.now() });
    }
    if (pattern === 4) {
      ledger.push({ id: `${date}:day`, date, source: 'day', amount: 200, label: 'Full day secured', awardedAt: Date.now() });
    }
  }

  const state = {
    version: 1,
    onboarded: true,
    profile: { name: 'Alex Carter', startDate: iso(start), createdAt: Date.now(), avatarAsset: null, frameUnlocked: false },
    goals: {
      mealsPerDay: 3, studySessionsPerDay: 2, focusSessionMinutes: 50,
      breakMinutes: 10, sleepTargetHours: 8, bedTime: '22:30', wakeTime: '06:30',
      calorieTarget: 2200, proteinTarget: 150, restSeconds: 90,
    },
    settings: {
      notifications: { enabled: true, dailyReminder: true, reminderTime: '07:00', streakAlerts: true, milestoneAlerts: true },
      appearance: { accent: 'arctic', highContrast: false, reduceMotion: false, ambientEffects: true },
      focusMode: { hideCompleted: false, keepScreenAwake: true, chimeOnComplete: true, autoStartBreaks: false },
      widgets: { showQuote: true, showStreak: true, showNextMilestone: true, showMacros: true },
    },
    days,
    tasks: [
      { id: 't1', title: 'Finish thermodynamics problem set', createdAt: Date.now(), done: false, completedAt: null, dueDate: null },
      { id: 't2', title: 'Review lecture notes for week 2', createdAt: Date.now(), done: false, completedAt: null, dueDate: null },
      { id: 't3', title: 'Plan next block of training', createdAt: Date.now(), done: true, completedAt: Date.now(), dueDate: null },
    ],
    notes: [
      { id: 'n1', title: 'Week 1 review', body: 'Bench moved well at 60kg. Sleep is the weak link, bed time keeps slipping past midnight on weekends.', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 'n2', title: 'Focus blocks', body: 'Two 50 minute sessions before noon works far better than four scattered ones.', createdAt: Date.now(), updatedAt: Date.now() },
    ],
    xpLedger: ledger,
    seenRankLevel: 20,
    lastActiveDate: iso(today),
  };

  localStorage.setItem('winter-arc:state:v1', JSON.stringify(state));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  // Seed before the app's first evaluation. Seeding afterwards loses the
  // write, because the app flushes its in-memory state on page unload.
  await context.addInitScript(seedScript);
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(opts.settle ?? 700);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.full });
    const scroll = await page.evaluate(() => document.querySelector('.screen__scroll')?.scrollTop ?? -1);
    console.log(`  ${name}  (scrollTop ${scroll})`);
  };

  const tab = async (label) => {
    await page.locator('.tabbar__item', { hasText: label }).click();
    await page.waitForTimeout(500);
  };

  console.log('\nCapturing seeded screens:\n');

  await shot('03-dashboard');
  await page.locator('.dash__summary').first().click();
  await shot('04-today');
  await page.getByRole('button', { name: /Switch to dashboard view/i }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: /^Workout\./ }).click();
  await shot('05-workout');
  await tab('Today');
  await page.getByRole('button', { name: /^Diet\./ }).click();
  await shot('06-diet');
  await tab('Today');
  await page.getByRole('button', { name: /^Studies\./ }).click();
  await shot('07-studies');
  await tab('Today');
  await page.getByRole('button', { name: /^Sleep\./ }).click();
  await shot('08-sleep');

  await tab('Journey');
  await shot('09-journey');
  await tab('Calendar');
  await shot('10-calendar');
  await tab('Rank');
  await shot('11-rank', { settle: 1200 });
  await tab('More');
  await page.getByRole('button', { name: /Momentum/i }).first().click();
  await shot('12-momentum');
  await page.getByRole('button', { name: /Back from Your Momentum/i }).click();
  await shot('13-settings');

  // Full-page captures show everything below the fold.
  await tab('Today');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.querySelector('.screen__scroll');
    if (el) el.scrollTop = 99999;
  });
  await shot('03b-dashboard-bottom');

  await browser.close();
  console.log(`\nPage errors: ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log(`  ${e}`));
  console.log(`Output: ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
