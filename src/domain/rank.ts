import type { RankState, RankTier, Reward } from '@/models';
import { clamp } from '@/utils/format';

/**
 * Four tiers, each spanning several levels. The tier is the RPG identity
 * (the crystal emblem); the level is the fine-grained progression.
 */
export const RANK_TIERS: RankTier[] = [
  { key: 'seeker', name: 'Ice Seeker', short: 'Seeker', minLevel: 1 },
  { key: 'nomad', name: 'Frost Nomad', short: 'Nomad', minLevel: 4 },
  { key: 'summit', name: 'Summit Walker', short: 'Summit', minLevel: 8 },
  { key: 'legend', name: 'Winter Legend', short: 'Legend', minLevel: 13 },
];

/**
 * Cumulative XP required to reach each level, index 0 being level 1.
 * A perfect day is 400 XP, so the curve stretches across a full 90-day arc.
 */
export const LEVEL_THRESHOLDS: number[] = [
  0, 200, 600, 1200, 2000, 3000, 4200, 5600, 7200, 9000, 11000, 13200, 15600,
  18200, 21000, 24000, 27200, 30600, 34200, 38000,
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function tierForLevel(level: number): { tier: RankTier; index: number } {
  let index = 0;
  for (let i = 0; i < RANK_TIERS.length; i += 1) {
    if (level >= RANK_TIERS[i].minLevel) index = i;
  }
  return { tier: RANK_TIERS[index], index };
}

export function rankForXp(xp: number): RankState {
  const safeXp = Math.max(0, Math.round(xp));
  const level = levelForXp(safeXp);
  const { tier, index } = tierForLevel(level);
  const levelStartXp = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextLevelXp = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : null;
  const span = nextLevelXp === null ? 1 : nextLevelXp - levelStartXp;
  const progress = nextLevelXp === null ? 1 : clamp((safeXp - levelStartXp) / span, 0, 1);
  return { xp: safeXp, level, tier, tierIndex: index, levelStartXp, nextLevelXp, progress };
}

/** XP still needed to reach the next level, or null at max level. */
export function xpToNextLevel(xp: number): number | null {
  const rank = rankForXp(xp);
  return rank.nextLevelXp === null ? null : Math.max(0, rank.nextLevelXp - rank.xp);
}

/* ---------------------------------------------------------------- Rewards */

export const REWARD_DEFINITIONS: Omit<Reward, 'unlocked'>[] = [
  {
    id: 'theme-pack',
    requirement: { type: 'level', value: 3 },
    label: 'Level 3',
    description: 'New badge and accent themes',
  },
  {
    id: 'quote-pack',
    requirement: { type: 'xp', value: 500 },
    label: '500 XP',
    description: 'Motivation quote pack',
  },
  {
    id: 'profile-frame',
    requirement: { type: 'level', value: 5 },
    label: 'Level 5',
    description: 'Custom profile frame',
  },
  {
    id: 'insights',
    requirement: { type: 'level', value: 8 },
    label: 'Level 8',
    description: 'Advanced momentum insights',
  },
];

export function rewardsFor(xp: number): Reward[] {
  const level = levelForXp(xp);
  return REWARD_DEFINITIONS.map((def) => ({
    ...def,
    unlocked:
      def.requirement.type === 'level' ? level >= def.requirement.value : xp >= def.requirement.value,
  }));
}

export function isRewardUnlocked(xp: number, id: string): boolean {
  return rewardsFor(xp).find((r) => r.id === id)?.unlocked ?? false;
}

/** The next reward the user has not yet earned. */
export function nextReward(xp: number): Reward | null {
  return rewardsFor(xp).find((r) => !r.unlocked) ?? null;
}
