import type { SVGProps } from 'react';

/**
 * One consistent icon family: 24px grid, 1.7 stroke, round caps and joins.
 * Every glyph in the product comes from here so weight and size never drift.
 */
export const IconNames = [
  'dumbbell',
  'bowl',
  'book',
  'moon',
  'home',
  'route',
  'calendar',
  'crown',
  'more',
  'bell',
  'chevron-left',
  'chevron-right',
  'chevron-down',
  'check',
  'plus',
  'minus',
  'close',
  'play',
  'pause',
  'rotate-ccw',
  'rotate-cw',
  'sliders',
  'target',
  'flame',
  'bolt',
  'bar-chart',
  'spark',
  'user',
  'palette',
  'focus',
  'grid',
  'shield',
  'help',
  'trash',
  'edit',
  'clock',
  'flag',
  'layout-grid',
  'layout-list',
  'download',
  'upload',
  'sun',
  'star',
  'arrow-right',
  'trophy',
  'alert',
  'note',
] as const;

export type IconName = (typeof IconNames)[number];

const paths: Record<IconName, string> = {
  dumbbell: 'M6.5 8.5v7M3.5 10v4M17.5 8.5v7M20.5 10v4M6.5 12h11',
  bowl: 'M3.5 11h17a8.5 8.5 0 0 1-8.5 8.5A8.5 8.5 0 0 1 3.5 11ZM9 7.5c.6-1.6 2-2.5 3-2.5M14.5 8c.4-1.2 1.4-2 2.5-2.2',
  book: 'M12 6.6C10.4 5.2 8.3 4.6 5 4.6v12.8c3.3 0 5.4.6 7 2 1.6-1.4 3.7-2 7-2V4.6c-3.3 0-5.4.6-7 2ZM12 6.6v12.8',
  moon: 'M20 13.6A8.2 8.2 0 0 1 10.4 4 8.4 8.4 0 1 0 20 13.6Z',
  home: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5ZM9.5 20.5v-6h5v6',
  route: 'M7 4.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6ZM17 14.9a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6ZM7 9.1v2.4a2.6 2.6 0 0 0 2.6 2.6h4.8a2.6 2.6 0 0 1 2.6 2.6v.2',
  calendar: 'M4.5 6.8A1.8 1.8 0 0 1 6.3 5h11.4a1.8 1.8 0 0 1 1.8 1.8v11.4a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8ZM8.5 3.5v3M15.5 3.5v3M4.5 9.8h15',
  crown: 'M4 17.5h16M4.5 7l4 3.5L12 5l3.5 5.5L19.5 7l-1.4 8.2H5.9Z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  bell: 'M18 9.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5ZM10.3 19.5a2 2 0 0 0 3.4 0',
  'chevron-left': 'M14.5 5.5 8 12l6.5 6.5',
  'chevron-right': 'M9.5 5.5 16 12l-6.5 6.5',
  'chevron-down': 'M5.5 9.5 12 16l6.5-6.5',
  check: 'M5 12.8 9.6 17.4 19 8',
  plus: 'M12 5.5v13M5.5 12h13',
  minus: 'M5.5 12h13',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8.5 5.6 18.5 12l-10 6.4Z',
  pause: 'M9.5 5.5v13M14.5 5.5v13',
  'rotate-ccw': 'M4.5 9.5h5v-5M4.9 9.6a7.6 7.6 0 1 1-.4 4.6',
  'rotate-cw': 'M19.5 9.5h-5v-5M19.1 9.6a7.6 7.6 0 1 0 .4 4.6',
  sliders: 'M4.5 8h9M17.5 8h2M4.5 16h2M10.5 16h9M15.5 5.5v5M8.5 13.5v5',
  target: 'M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z',
  flame: 'M12 3.5s5 4.2 5 8.5a5 5 0 0 1-10 0c0-1.9 1-3.3 1.8-4.2.2 1.3.9 2.2 1.8 2.2 1.2 0 1.6-1.4 1.4-6.5Z',
  bolt: 'M13.5 3.5 6 13.2h5l-.5 7.3L18 10.8h-5Z',
  'bar-chart': 'M5.5 20V13M10.5 20V6M15.5 20v-9M20 20H4',
  spark: 'M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.5l-1.6-4.3L6 10.6 10.4 9ZM18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z',
  user: 'M12 12.2a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM4.8 20.2a7.4 7.4 0 0 1 14.4 0',
  palette: 'M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2-1.6 2.9-3 2.9h-1.4a2 2 0 0 0-1.4 3.4 1.6 1.6 0 0 1-1.2 2.2ZM8 10.5h.01M11 7.5h.01M15.5 9h.01',
  focus: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1',
  grid: 'M4.5 4.5h6v6h-6ZM13.5 4.5h6v6h-6ZM4.5 13.5h6v6h-6ZM13.5 13.5h6v6h-6Z',
  shield: 'M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2ZM9.3 12.2l1.9 1.9 3.6-3.7',
  help: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM9.8 9.6a2.3 2.3 0 1 1 3 2.2c-.6.2-.9.8-.9 1.4v.5M12 16.6h.01',
  trash: 'M4.5 6.8h15M9.5 6.8V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.8M6.5 6.8 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.2M10.5 10.5v6M13.5 10.5v6',
  edit: 'M16.4 3.8a2 2 0 0 1 2.8 2.8L8.3 17.5l-3.7 1 1-3.7ZM14.2 6l3.8 3.8',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.3V12l3.2 2',
  flag: 'M6 20.5V4.2M6 5.2c3.5-1.8 7-.2 10.5-1.4v9c-3.5 1.2-7-.4-10.5 1.4',
  'layout-grid': 'M4.5 4.5h6v6h-6ZM13.5 4.5h6v6h-6ZM4.5 13.5h6v6h-6ZM13.5 13.5h6v6h-6Z',
  'layout-list': 'M4.5 5.5h15M4.5 12h15M4.5 18.5h15',
  download: 'M12 4v10.5M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  upload: 'M12 15.5V5M7.5 9 12 4.5 16.5 9M5 19.5h14',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5',
  star: 'm12 4 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7Z',
  'arrow-right': 'M4.5 12h15M13.5 6l6 6-6 6',
  trophy: 'M8 4.5h8v5a4 4 0 0 1-8 0ZM8 6H5.5v1.5A3 3 0 0 0 8 10.4M16 6h2.5v1.5a3 3 0 0 1-2.5 2.9M10 13.4v2.6M14 13.4v2.6M8 19.5h8',
  alert: 'M12 8.5v4.2M12 16.6h.01M10.7 4.3 3.2 17.4a1.5 1.5 0 0 0 1.3 2.3h15a1.5 1.5 0 0 0 1.3-2.3L13.3 4.3a1.5 1.5 0 0 0-2.6 0Z',
  note: 'M6.5 3.8h8L19 8.3v11.9H6.5ZM14 3.8v4.6h4.6M9.5 12.5h6M9.5 16h4',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Provide a label only when the icon is the sole carrier of meaning. */
  label?: string;
  filled?: boolean;
}

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.7,
  label,
  filled = false,
  ...rest
}: IconProps) {
  const d = paths[name];
  const decorative = !label;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {label ? <title>{label}</title> : null}
      <path d={d} />
    </svg>
  );
}

/** The glyph that represents each pillar throughout the product. */
export const pillarIcon = {
  workout: 'dumbbell',
  diet: 'bowl',
  studies: 'book',
  sleep: 'moon',
} as const satisfies Record<string, IconName>;
