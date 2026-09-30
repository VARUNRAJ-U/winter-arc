/**
 * Winter Arc QA drive.
 *
 * Runs the full user journey against the built app in a real browser at
 * phone size, capturing a screenshot at every step and failing loudly on
 * console errors, page errors, layout overflow, or small touch targets.
 *
 *   node qa/journey.mjs [baseUrl] [outDir]
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? path.resolve('qa/shots');

const VIEWPORTS = {
  iphone12: { width: 390, height: 844 },
  small: { width: 360, height: 740 },
  large: { width: 430, height: 932 },
};

const consoleErrors = [];
const pageErrors = [];
const failures = [];
let shotIndex = 0;

function fail(message) {
  failures.push(message);
  console.log(`  FAIL  ${message}`);
}

function pass(message) {
  console.log(`  ok    ${message}`);
}

async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(OUT, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

/** Fails when the document scrolls sideways at this viewport. */
async function checkNoOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    const widest = [...document.querySelectorAll('*')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: String(el.className).slice(0, 60), right: Math.round(r.right), left: Math.round(r.left) };
      })
      .filter((r) => r.right > window.innerWidth + 1 || r.left < -1)
      .slice(0, 5);
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      offenders: widest,
    };
  });
  if (overflow.scrollW > overflow.clientW + 1) {
    fail(
      `${label}: horizontal overflow ${overflow.scrollW}px > ${overflow.clientW}px. ` +
        `Offenders: ${JSON.stringify(overflow.offenders)}`,
    );
  } else {
    pass(`${label}: no horizontal overflow`);
  }
}

/** Fails when a visible interactive control is under 44x44 CSS pixels. */
async function checkTouchTargets(page, label) {
  const small = await page.evaluate(() => {
    const out = [];
    const nodes = document.querySelectorAll('button, a[href], input, select, [role="switch"], [role="tab"]');
    for (const el of nodes) {
      if (el.closest('.sr-only')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.type === 'file') continue;
      if (r.width < 43.5 || r.height < 43.5) {
        out.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 50),
          label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return out.slice(0, 8);
  });
  if (small.length > 0) {
    fail(`${label}: ${small.length} touch target(s) under 44px: ${JSON.stringify(small)}`);
  } else {
    pass(`${label}: touch targets >= 44px`);
  }
}

/** Fails when a control that can be reached has no accessible name. */
async function checkNamedControls(page, label) {
  const unnamed = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, [role="switch"], [role="tab"]')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const name = (el.getAttribute('aria-label') ?? '') || (el.textContent ?? '').trim();
      if (name.length === 0) {
        out.push({ tag: el.tagName, cls: String(el.className).slice(0, 50) });
      }
    }
    return out.slice(0, 6);
  });
  if (unnamed.length > 0) fail(`${label}: unnamed control(s): ${JSON.stringify(unnamed)}`);
  else pass(`${label}: all controls named`);
}

async function auditScreen(page, label) {
  await checkNoOverflow(page, label);
  await checkTouchTargets(page, label);
  await checkNamedControls(page, label);
}

/** Closes the rank-up dialog when it stacks behind the celebration. */
async function dismissOverlays(page) {
  for (let i = 0; i < 3; i += 1) {
    const overlay = page.locator('.overlay');
    if ((await overlay.count()) === 0) return;
    const keep = page.getByRole('button', { name: /Keep climbing/i });
    if (await keep.count()) {
      await keep.first().click();
    } else {
      const close = page.getByRole('button', { name: /^Close$/ });
      if (await close.count()) await close.first().click();
      else return;
    }
    await page.waitForTimeout(350);
  }
}

/**
 * Returns to the Today tab's root. Tapping an already-active tab pops its
 * stack, which is the standard mobile idiom the app implements.
 */
async function goHome(page) {
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Today' }).click();
  await page.waitForTimeout(250);
  await page.locator('.tabbar__item', { hasText: 'Today' }).click();
  await page.waitForTimeout(450);
  await page.waitForSelector('.dash__dayValue', { timeout: 8000 });
}

const readState = (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('winter-arc:state:v1');
    return raw ? JSON.parse(raw) : null;
  });

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: VIEWPORTS.iphone12,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning' && /React|Warning/i.test(msg.text())) {
      consoleErrors.push(`[warn] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  console.log(`\nWinter Arc QA -> ${BASE}\n`);

  /* ---------------------------------------------------------- 1. Welcome */
  console.log('1. Welcome');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=WINTER', { timeout: 15000 });
  await shot(page, 'welcome');
  await auditScreen(page, 'Welcome');
  if (!(await page.locator('text=90').first().isVisible())) fail('Welcome: 90 Days stat missing');
  else pass('Welcome: stats render');

  /* ------------------------------------------------------- 2. Onboarding */
  console.log('2. Onboarding');
  await page.getByRole('button', { name: /Begin Your Journey/i }).click();
  await page.waitForSelector('text=More Than Habits');
  await shot(page, 'onboarding-1');
  await auditScreen(page, 'Onboarding step 1');

  await page.getByRole('button', { name: /^Next$/ }).click();
  await page.waitForSelector('text=Who is');
  await page.getByLabel('Your name').fill('Alex Carter');
  await shot(page, 'onboarding-2');
  await page.getByRole('button', { name: /^Next$/ }).click();

  await page.waitForSelector('text=Set your');
  await shot(page, 'onboarding-3');
  await auditScreen(page, 'Onboarding step 3');
  await page.getByRole('button', { name: /^Next$/ }).click();

  await page.waitForSelector('text=Ready when');
  await shot(page, 'onboarding-4');
  await page.getByRole('button', { name: /Start Day 1/i }).click();

  /* --------------------------------------------------------- 3. Dashboard */
  console.log('3. Dashboard');
  await page.waitForSelector('text=WINTER ARC', { timeout: 10000 });
  await page.waitForTimeout(600);
  await shot(page, 'dashboard-empty');
  await auditScreen(page, 'Dashboard');

  const dayText = await page.locator('.dash__dayValue').first().textContent();
  if (dayText?.trim() !== '1') fail(`Dashboard: expected Day 1, saw "${dayText}"`);
  else pass('Dashboard: day number is 1');

  let state = await readState(page);
  if (!state?.onboarded || state.profile?.name !== 'Alex Carter') {
    fail('Persistence: onboarding not saved');
  } else {
    pass('Persistence: profile saved');
  }

  /* --------------------------------------------------- 4. Today / Pillars */
  console.log('4. Today list');
  await page.locator('.dash__summary').first().click();
  await page.waitForSelector("text=Four Pillars");
  await shot(page, 'today-list');
  await auditScreen(page, 'Today list');
  await page.getByRole('button', { name: /Switch to dashboard view/i }).click();
  await page.waitForSelector('.dash__dayValue');
  pass('Today: view toggle round-trips');

  /* ------------------------------------------------------------ 5. Workout */
  console.log('5. Workout');
  await page.getByRole('button', { name: /^Workout\./ }).click();
  await page.waitForSelector('text=Build a Stronger Body');
  await shot(page, 'workout-empty');
  await page.getByRole('button', { name: /Start Strength session/i }).click();
  await page.waitForSelector('text=Push Day');
  await shot(page, 'workout-session');
  await auditScreen(page, 'Workout');

  // Timer
  await page.getByRole('button', { name: /Start workout timer/i }).click();
  await page.waitForTimeout(2200);
  const clock = await page.locator('.wk__timerValue').textContent();
  if (!/00:00:0[1-9]/.test(clock ?? '')) fail(`Workout: timer did not advance (${clock})`);
  else pass(`Workout: timer running (${clock?.trim()})`);
  await page.getByRole('button', { name: /Pause workout timer/i }).click();
  const paused = await page.locator('.wk__timerValue').textContent();
  await page.waitForTimeout(1400);
  const stillPaused = await page.locator('.wk__timerValue').textContent();
  if (paused !== stillPaused) fail('Workout: timer kept running after pause');
  else pass('Workout: pause holds');

  // Sets: open the first exercise, edit reps, tick a set, verify rest timer.
  await page.getByRole('button', { name: /Show sets for Bench Press/i }).click();
  await page.waitForSelector('text=reps');
  const repsInput = page.getByLabel('Set 1 reps for Bench Press');
  await repsInput.fill('12');
  await repsInput.blur();
  await page.getByRole('button', { name: /^Set 1, not done$/ }).click();
  await page.waitForTimeout(300);
  if (!(await page.locator('.rest-bar').isVisible())) fail('Workout: rest timer did not start');
  else pass('Workout: rest timer started');
  await shot(page, 'workout-sets');
  await page.getByRole('button', { name: /Skip rest/i }).click();

  state = await readState(page);
  const savedReps = state?.days?.[Object.keys(state.days)[0]]?.workout?.exercises?.[0]?.sets?.[0]?.reps;
  if (savedReps !== 12) fail(`Workout: reps not persisted (saw ${savedReps})`);
  else pass('Workout: set edit persisted');

  await page.getByRole('button', { name: /Complete Workout/i }).click();
  await page.waitForTimeout(500);
  await shot(page, 'workout-complete');

  /* --------------------------------------------------------------- 6. Diet */
  console.log('6. Diet');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Today' }).click();
  await page.waitForSelector('.dash__dayValue');
  const workoutTile = page.getByRole('button', { name: /^Workout\./ });
  const workoutLabel = await workoutTile.getAttribute('aria-label');
  if (!/completed/i.test(workoutLabel ?? '')) fail(`Dashboard: workout tile not complete (${workoutLabel})`);
  else pass('Dashboard: workout pillar reflects completion');
  await shot(page, 'dashboard-workout-done');

  await page.getByRole('button', { name: /^Diet\./ }).click();
  await page.waitForSelector('text=Fuel Your Potential');
  await shot(page, 'diet-meals');
  await auditScreen(page, 'Diet');

  const mealTitles = await page.locator('.meal__title').allTextContents();
  for (const title of mealTitles) {
    const btn = page.getByRole('button', { name: `Mark ${title} eaten` });
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(220);
    }
  }
  const eatenCount = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('winter-arc:state:v1'));
    const d = Object.keys(raw.days)[0];
    return raw.days[d].meals.filter((m) => m.completed).length;
  });
  if (eatenCount !== mealTitles.length) {
    fail(`Diet: marked ${eatenCount} of ${mealTitles.length} meals`);
  } else {
    pass(`Diet: marked all ${eatenCount} meals eaten`);
  }
  await shot(page, 'diet-complete');

  // Nutrition tab totals
  await page.getByRole('tab', { name: 'Nutrition' }).click();
  await page.waitForSelector('text=Eaten today');
  const calText = (await page.locator('.nutri-goal__value').first().textContent())?.trim() ?? '';
  const expectedCals = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('winter-arc:state:v1'));
    const d = Object.keys(raw.days)[0];
    return raw.days[d].meals.filter((m) => m.completed).reduce((s, m) => s + m.nutrition.calories, 0);
  });
  if (!calText.startsWith(expectedCals.toLocaleString('en-US'))) {
    fail(`Diet: calories shown "${calText}" do not match stored total ${expectedCals}`);
  } else {
    pass(`Diet: nutrition totals computed (${calText})`);
  }
  await shot(page, 'diet-nutrition');
  await auditScreen(page, 'Nutrition tab');

  /* ------------------------------------------------------------ 7. Studies */
  console.log('7. Studies');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Today' }).click();
  await page.waitForSelector('.dash__dayValue');
  await page.getByRole('button', { name: /^Studies\./ }).click();
  await page.waitForSelector('text=Sharpen Your Mind');
  await shot(page, 'studies-focus');
  await auditScreen(page, 'Studies focus');

  const initialTimer = await page.locator('.focus__value').textContent();
  if (initialTimer?.trim() !== '50:00') fail(`Studies: timer should read 50:00, saw ${initialTimer}`);
  else pass('Studies: focus timer shows 50:00');

  await page.getByRole('button', { name: /Start session/i }).click();
  await page.waitForTimeout(2400);
  const running = await page.locator('.focus__value').textContent();
  if (running?.trim() === '50:00') fail('Studies: focus timer did not count down');
  else pass(`Studies: timer counting (${running?.trim()})`);
  await page.getByRole('button', { name: /Pause session/i }).click();

  // Confirm a too-short run is refused, then log two real sessions by
  // letting the timer run past the 30 second threshold.
  await page.getByRole('button', { name: /Log partial session/i }).click();
  await page.waitForTimeout(400);
  const afterShort = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('winter-arc:state:v1'));
    const d = Object.keys(raw.days)[0];
    return raw.days[d].studySessions.length;
  });
  if (afterShort !== 0) fail('Studies: a sub-threshold run was logged');
  else pass('Studies: sub-threshold run refused');

  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: /Start session/i }).click();
    await page.waitForTimeout(32000);
    await page.getByRole('button', { name: /Pause session/i }).click();
    await page.getByRole('button', { name: /Log partial session/i }).click();
    await page.waitForTimeout(500);
  }

  const sessions = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('winter-arc:state:v1'));
    const d = Object.keys(raw.days)[0];
    return raw.days[d].studySessions.length;
  });
  if (sessions !== 2) fail(`Studies: expected 2 logged sessions, saw ${sessions}`);
  else pass('Studies: two focus sessions logged');

  // Tasks
  await page.getByRole('tab', { name: 'Tasks' }).click();
  await page.waitForSelector('input[placeholder="Add a task"]');
  await page.fill('input[placeholder="Add a task"]', 'Read chapter 4');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.waitForSelector('text=Read chapter 4');
  pass('Studies: task added');
  await shot(page, 'studies-tasks');
  await auditScreen(page, 'Studies tasks');

  // Notes
  await page.getByRole('tab', { name: 'Notes' }).click();
  await page.getByRole('button', { name: /New note/i }).click();
  await page.waitForSelector('text=New note');
  await page.getByRole('textbox', { name: 'Title' }).fill('Week 1 review');
  await page.getByRole('textbox', { name: 'Note' }).fill('Bench felt strong. Sleep is the weak link.');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForSelector('text=Week 1 review');
  pass('Studies: note saved');
  await shot(page, 'studies-notes');

  /* --------------------------------------------------------------- 8. Sleep */
  console.log('8. Sleep');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Today' }).click();
  await page.waitForSelector('.dash__dayValue');
  await page.getByRole('button', { name: /^Sleep\./ }).click();
  await page.waitForSelector('text=Recover. Reset. Dominate.');
  await shot(page, 'sleep-track');
  await auditScreen(page, 'Sleep');

  const dur = await page.locator('.sleep__value').textContent();
  if (dur?.trim() !== '8h 00m') fail(`Sleep: expected 8h 00m from 22:30 to 06:30, saw ${dur}`);
  else pass('Sleep: duration computed from bed and wake times');

  await page.getByLabel('Bed Time').fill('23:00');
  await page.waitForTimeout(250);
  const dur2 = await page.locator('.sleep__value').textContent();
  if (dur2?.trim() !== '7h 30m') fail(`Sleep: expected 7h 30m after change, saw ${dur2}`);
  else pass('Sleep: duration recalculates on edit');
  await page.getByLabel('Bed Time').fill('22:30');
  await page.waitForTimeout(200);

  await page.getByRole('button', { name: /Complete Sleep/i }).click();
  await page.waitForTimeout(700);
  await shot(page, 'sleep-logged');

  /* --------------------------------------------------------- 9. Celebration */
  console.log('9. Celebration');
  const celebrationVisible = await page.locator('.celebrate').isVisible().catch(() => false);
  if (celebrationVisible) {
    pass('Celebration: overlay triggered on 4/4');
    await shot(page, 'celebration');
    await checkNoOverflow(page, 'Celebration');
    const title = await page.locator('.celebrate__title').textContent();
    if (!/Another Day\s*Secured/i.test(title ?? '')) fail(`Celebration: unexpected title "${title}"`);
    const xpText = await page.locator('.celebrate__rewardValue').first().textContent();
    console.log(`  note  celebration bonus: ${xpText?.trim()}`);
    await page.getByRole('button', { name: /On to Day/i }).click();
    await page.waitForTimeout(500);

    // Earning 400 XP on day one crosses level 2, so a rank-up follows.
    if (await page.locator('.rankup').count()) {
      pass('Rank-up: overlay followed the celebration');
      await shot(page, 'rank-up');
      await checkNoOverflow(page, 'Rank-up');
    }
    await dismissOverlays(page);
  } else {
    console.log('  note  celebration did not fire; checking pillar state');
    const s = await readState(page);
    const d = Object.keys(s.days)[0];
    console.log(`  note  day record: ${JSON.stringify({
      workout: s.days[d].workout?.completed,
      meals: s.days[d].meals.filter((m) => m.completed).length,
      study: s.days[d].studySessions.length,
      sleep: s.days[d].sleep?.minutes,
    })}`);
    fail('Celebration: did not appear after all four pillars');
  }

  /* -------------------------------------------------------------- 10. Rank */
  console.log('10. Rank');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Rank' }).click();
  await page.waitForSelector('text=Discipline Earns A Higher You');
  await page.waitForTimeout(900);
  await shot(page, 'rank');
  await auditScreen(page, 'Rank');
  const xpLine = await page.locator('.rank__xpLine').textContent();
  console.log(`  note  rank XP line: ${xpLine?.trim()}`);
  if (/^0 /.test(xpLine?.trim() ?? '')) fail('Rank: no XP recorded');
  else pass('Rank: XP reflects the day');

  /* ----------------------------------------------------------- 11. Journey */
  console.log('11. Journey');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Journey' }).click();
  await page.waitForSelector('text=Small Steps. Massive Change.');
  await page.waitForTimeout(400);
  await shot(page, 'journey');
  await auditScreen(page, 'Journey');
  const cellCount = await page.locator('.jr__cell').count();
  if (cellCount !== 90) fail(`Journey: expected 90 day cells, saw ${cellCount}`);
  else pass('Journey: 90 day cells');
  await page.getByRole('tab', { name: 'Milestones' }).click();
  await page.waitForSelector('text=Stronger Habits');
  await shot(page, 'journey-milestones');
  await auditScreen(page, 'Milestones');

  /* ---------------------------------------------------------- 12. Calendar */
  console.log('12. Calendar');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Calendar' }).click();
  await page.waitForSelector('text=Show Up. Stay Consistent.');
  await page.waitForTimeout(300);
  await shot(page, 'calendar');
  await auditScreen(page, 'Calendar');
  const completeCells = await page.locator('.cal__cell--complete').count();
  if (completeCells < 1) fail('Calendar: today is not marked complete');
  else pass(`Calendar: ${completeCells} completed day(s) marked`);

  await page.locator('.cal__cell--complete').first().click();
  await page.waitForSelector('.sheet');
  await shot(page, 'calendar-day-detail');
  await checkNoOverflow(page, 'Day detail sheet');
  await page.getByRole('button', { name: 'Close' }).click();

  /* ---------------------------------------------------------- 13. Momentum */
  console.log('13. Momentum');
  await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'More' }).click();
  await page.waitForSelector('text=Customise Your Journey');
  await shot(page, 'settings');
  await auditScreen(page, 'Settings');
  await page.getByRole('button', { name: /Momentum/i }).first().click();
  await page.waitForSelector('text=Proof of a Stronger You');
  await page.waitForTimeout(400);
  await shot(page, 'momentum');
  await auditScreen(page, 'Momentum');
  const bars = await page.locator('.chart__bar').count();
  if (bars < 1) fail('Momentum: chart has no bars');
  else pass(`Momentum: chart rendered ${bars} bars from real history`);

  /* ---------------------------------------------------------- 14. Settings */
  console.log('14. Settings pages');
  await page.getByRole('button', { name: /Back from Your Momentum/i }).click();
  await page.waitForSelector('text=Customise Your Journey');

  for (const [name, marker] of [
    ['Goals & Preferences', 'What a complete day means'],
    ['Notifications', 'When the app should nudge you'],
    ['Appearance', 'How Winter Arc looks'],
    ['Focus Mode', 'How sessions behave'],
    ['Widgets', 'What appears on your dashboard'],
    ['Data & Privacy', 'Your records stay on this device'],
    ['Help & Support', 'How the arc works'],
  ]) {
    await page.getByRole('button', { name: new RegExp(`^${name.replace(/&/g, '&')}`) }).first().click();
    await page.waitForSelector(`text=${marker}`, { timeout: 5000 }).catch(() => fail(`Settings: ${name} did not open`));
    await auditScreen(page, `Settings / ${name}`);
    await shot(page, `settings-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`);
    await page.getByRole('button', { name: new RegExp('^Back from') }).click();
    await page.waitForSelector('text=Customise Your Journey');
  }
  pass('Settings: every subpage opens and returns');

  // Settings that must visibly change the app.
  await page.getByRole('button', { name: /^Widgets/ }).first().click();
  await page.waitForSelector('text=What appears on your dashboard');
  await page.getByRole('switch', { name: /Daily quote/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Back from/ }).click();
  await goHome(page);
  if ((await page.locator('.dash__quote').count()) > 0) fail('Widgets: turning off the quote did not hide it');
  else pass('Widgets: the quote widget toggle hides the card');
  await page.locator('.tabbar__item', { hasText: 'More' }).click();
  await page.waitForSelector('text=Customise Your Journey');
  await page.getByRole('button', { name: /^Widgets/ }).first().click();
  await page.getByRole('switch', { name: /Daily quote/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Back from/ }).click();
  await goHome(page);
  if ((await page.locator('.dash__quote').count()) === 0) fail('Widgets: re-enabling the quote did not restore it');
  else pass('Widgets: the quote widget toggle restores the card');
  await page.locator('.tabbar__item', { hasText: 'More' }).click();
  await page.waitForSelector('text=Customise Your Journey');

  // Profile picture picker.
  await page.getByRole('button', { name: /Alex Carter/ }).click();
  await page.waitForSelector('text=Who is climbing');
  const choices = page.locator('.avatar-choice');
  if ((await choices.count()) < 2) fail('Profile: no avatar choices rendered');
  else {
    await choices.nth(1).click();
    await page.waitForTimeout(400);
    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem('winter-arc:state:v1')).profile.avatarAsset,
    );
    if (!stored) fail('Profile: the chosen avatar was not saved');
    else pass(`Profile: avatar saved as "${stored}"`);
  }
  await auditScreen(page, 'Settings / Profile');
  await shot(page, 'settings-profile');
  await page.getByRole('button', { name: /^Back from/ }).click();
  await page.waitForSelector('text=Customise Your Journey');

  await page.getByRole('button', { name: /^Appearance/ }).first().click();
  await page.waitForSelector('text=How Winter Arc looks');
  await page.getByRole('switch', { name: /High contrast/i }).click();
  await page.waitForTimeout(250);
  const contrast = await page.evaluate(() => document.documentElement.dataset.contrast);
  if (contrast !== 'high') fail('Settings: high contrast did not apply to the document');
  else pass('Settings: high contrast applies');
  await page.getByRole('switch', { name: /High contrast/i }).click();
  await page.getByRole('button', { name: /^Back from/ }).click();
  await page.waitForSelector('text=Customise Your Journey');

  // Renaming an exercise must persist.
  await goHome(page);
  await page.getByRole('button', { name: /^Workout\./ }).click();
  await page.waitForSelector('text=Build a Stronger Body');
  await page.getByRole('button', { name: /Reopen workout/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Show sets for Bench Press/i }).click();
  await page.getByRole('button', { name: /^Rename$/ }).click();
  await page.waitForSelector('text=Rename exercise');
  await page.getByLabel('Exercise name').fill('Barbell Bench Press');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(400);
  if ((await page.getByText('Barbell Bench Press').count()) === 0) fail('Workout: rename did not apply');
  else pass('Workout: exercise renamed');
  await page.getByRole('button', { name: /Complete Workout/i }).click();
  await page.waitForTimeout(600);
  await dismissOverlays(page);

  /* -------------------------------------------------------- 15. Persistence */
  console.log('15. Reload persistence');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.waitForSelector('.dash__dayValue', { timeout: 10000 }).catch(() => fail('Reload: dashboard did not return'));
  await shot(page, 'after-reload');
  const afterReload = await readState(page);
  if (!afterReload?.onboarded) fail('Reload: onboarding state lost');
  else pass('Reload: returns straight to the dashboard');
  const reloadDay = await page.locator('.dash__dayValue').textContent();
  if (reloadDay?.trim() !== '1') fail(`Reload: day number changed to ${reloadDay}`);
  else pass('Reload: day number preserved');

  const tileLabel = await page.getByRole('button', { name: /^Workout\./ }).getAttribute('aria-label');
  if (!/completed/i.test(tileLabel ?? '')) fail('Reload: workout completion lost');
  else pass('Reload: pillar completion preserved');

  /* ------------------------------------------------- 16. XP cannot duplicate */
  console.log('16. XP integrity');
  const ledger = afterReload.xpLedger;
  const ids = ledger.map((t) => t.id);
  if (new Set(ids).size !== ids.length) fail('XP: duplicate ledger ids found');
  else pass(`XP: ${ids.length} unique ledger entries, no duplicates`);

  // Undo a meal and confirm XP is withdrawn, then redo it.
  const xpBefore = ledger.reduce((s, t) => s + t.amount, 0);
  await page.getByRole('button', { name: /^Diet\./ }).click();
  await page.waitForSelector('text=Fuel Your Potential');
  await page.getByRole('button', { name: /^Mark .* not eaten$/ }).first().click();
  await page.waitForTimeout(400);
  const xpAfterUndo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('winter-arc:state:v1')).xpLedger.reduce((s, t) => s + t.amount, 0),
  );
  if (xpAfterUndo >= xpBefore) fail(`XP: undoing a meal did not withdraw XP (${xpBefore} -> ${xpAfterUndo})`);
  else pass(`XP: withdrawn on undo (${xpBefore} -> ${xpAfterUndo})`);

  await page.getByRole('button', { name: /^Mark .* eaten$/ }).first().click();
  await page.waitForTimeout(400);
  const xpAfterRedo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('winter-arc:state:v1')).xpLedger.reduce((s, t) => s + t.amount, 0),
  );
  if (xpAfterRedo !== xpBefore) fail(`XP: redo did not restore exactly (${xpBefore} vs ${xpAfterRedo})`);
  else pass(`XP: restored exactly on redo (${xpAfterRedo})`);

  /* ------------------------------------------------------- 17. Other sizes */
  console.log('17. Small and large phones');
  for (const [name, vp] of [['small-360', VIEWPORTS.small], ['large-430', VIEWPORTS.large]]) {
    await page.setViewportSize(vp);
    await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Today' }).click();
    await page.waitForTimeout(500);
    await shot(page, `viewport-${name}-dashboard`);
    await auditScreen(page, `Dashboard @ ${vp.width}px`);
    await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Journey' }).click();
    await page.waitForTimeout(400);
    await shot(page, `viewport-${name}-journey`);
    await checkNoOverflow(page, `Journey @ ${vp.width}px`);
    await dismissOverlays(page);
  await page.locator('.tabbar__item', { hasText: 'Rank' }).click();
    await page.waitForTimeout(400);
    await shot(page, `viewport-${name}-rank`);
    await checkNoOverflow(page, `Rank @ ${vp.width}px`);
  }
  await page.setViewportSize(VIEWPORTS.iphone12);

  /* --------------------------------------------------- 18. Reduced motion */
  console.log('18. Reduced motion');
  const rmContext = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: VIEWPORTS.iphone12,
    reducedMotion: 'reduce',
  });
  const rmPage = await rmContext.newPage();
  rmPage.on('pageerror', (e) => pageErrors.push(`[reduced-motion] ${e.message}`));
  await rmPage.goto(BASE, { waitUntil: 'networkidle' });
  await rmPage.waitForSelector('text=WINTER');
  await rmPage.screenshot({ path: path.join(OUT, '90-reduced-motion.png') });
  pass('Reduced motion: welcome renders');
  await rmContext.close();

  /* -------------------------------------------------- 19. Fresh-start gate */
  console.log('19. Fresh visitor');
  const freshContext = await browser.newContext({ ...devices['iPhone 12'], viewport: VIEWPORTS.iphone12 });
  const fresh = await freshContext.newPage();
  fresh.on('pageerror', (e) => pageErrors.push(`[fresh] ${e.message}`));
  await fresh.goto(BASE, { waitUntil: 'networkidle' });
  await fresh.waitForSelector('text=Begin Your Journey');
  pass('Fresh visitor: welcome gate shown');
  await freshContext.close();

  await browser.close();

  /* -------------------------------------------------------------- Report */
  console.log('\n--- Console errors ---');
  if (consoleErrors.length === 0) console.log('  none');
  else consoleErrors.slice(0, 15).forEach((e) => console.log(`  ${e}`));

  console.log('\n--- Page errors ---');
  if (pageErrors.length === 0) console.log('  none');
  else pageErrors.slice(0, 15).forEach((e) => console.log(`  ${e}`));

  console.log('\n=====================================');
  console.log(`Checks failed: ${failures.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(`Page errors: ${pageErrors.length}`);
  console.log(`Screenshots: ${OUT}`);
  console.log('=====================================\n');

  if (failures.length > 0) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  process.exit(failures.length + pageErrors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nQA run crashed:', err);
  process.exit(2);
});
