/* =========================================================================
   WINTER ARC · ASSET MAP
   Every image in the product is referenced through this map. Swapping an
   artwork means editing one line here — nothing else imports a file path.
   ========================================================================= */

const base = import.meta.env.BASE_URL;
const src = (file: string) => `${base}assets/${file}`;

export const AssetKeys = [
  'mountaineer',
  'snowMountains',
  'workout',
  'breakfast',
  'lunch',
  'mountainJourney',
  'rankEmblem',
  'summitClimber',
] as const;

export type AssetKey = (typeof AssetKeys)[number];

export interface AssetDefinition {
  src: string;
  /** Empty string marks a purely decorative image (hidden from the a11y tree). */
  alt: string;
  /** object-position tuned per artwork so crops never cut the subject. */
  position: string;
}

export const assets: Record<AssetKey, AssetDefinition> = {
  mountaineer: {
    src: src('01_Mountaineer.png'),
    alt: 'A mountaineer standing on a snowy ridge beneath a starlit sky',
    position: '50% 45%',
  },
  snowMountains: {
    src: src('02_Snow_Mountains.png'),
    alt: 'Snow-covered mountain peaks rising above a sea of cloud',
    position: '50% 40%',
  },
  workout: {
    src: src('03_Workout.png'),
    alt: 'An athlete training with dumbbells in a dimly lit gym',
    position: '50% 32%',
  },
  breakfast: {
    src: src('04_Breakfast_Oatmeal.png'),
    alt: 'A bowl of oats topped with berries, banana and nuts',
    position: '50% 50%',
  },
  lunch: {
    src: src('05_Chicken_Rice_Vegetables.png'),
    alt: 'A bowl of grilled chicken with rice and vegetables',
    position: '50% 52%',
  },
  mountainJourney: {
    src: src('06_Mountain_Journey.png'),
    alt: 'A climber following a glowing trail winding up a mountain',
    position: '50% 50%',
  },
  rankEmblem: {
    src: src('07_Crystal_Rank_Emblem.png'),
    alt: 'A glowing blue crystal emblem above a mountain range',
    position: '50% 38%',
  },
  summitClimber: {
    src: src('08_Summit_Climber.png'),
    alt: 'A climber raising an ice axe in triumph on a summit at dawn',
    position: '50% 42%',
  },
};

export const getAsset = (key: AssetKey): AssetDefinition => assets[key];

/** Default artwork suggested for each meal slot. */
export const mealSlotAsset: Record<string, AssetKey | null> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'lunch',
  snack: null,
};

/** Artwork used as the hero of each workout mode. */
export const workoutModeAsset: Record<string, AssetKey> = {
  strength: 'workout',
  hiit: 'workout',
  mobility: 'snowMountains',
};

/** Preload the artwork that appears in the first seconds of the session. */
export function preloadCriticalAssets(): void {
  (['mountaineer', 'snowMountains'] as AssetKey[]).forEach((key) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = assets[key].src;
  });
}
