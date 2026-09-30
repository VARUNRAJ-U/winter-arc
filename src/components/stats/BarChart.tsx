import { useId, useMemo } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  /** Shown in the accessible summary; the axis only labels a few points. */
  fullLabel: string;
  muted?: boolean;
}

export interface BarChartProps {
  data: BarDatum[];
  max?: number;
  height?: number;
  unit?: string;
  caption: string;
  yTicks?: number[];
}

/**
 * A compact SVG bar chart. Drawn by hand rather than pulled from a library so
 * the neon fill, gridlines and label density match the rest of the product.
 */
export function BarChart({
  data,
  max = 100,
  height = 150,
  unit = '%',
  caption,
  yTicks = [0, 25, 50, 75, 100],
}: BarChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const width = 300;
  const padLeft = 26;
  const padBottom = 18;
  const padTop = 6;
  const plotW = width - padLeft - 4;
  const plotH = height - padBottom - padTop;

  const bars = useMemo(() => {
    if (data.length === 0) return [];
    const slot = plotW / data.length;
    const barW = Math.max(2.5, Math.min(11, slot * 0.62));
    return data.map((d, i) => {
      const ratio = max > 0 ? Math.max(0, Math.min(1, d.value / max)) : 0;
      const h = Math.max(d.value > 0 ? 2 : 0, ratio * plotH);
      return {
        ...d,
        x: padLeft + slot * i + (slot - barW) / 2,
        y: padTop + plotH - h,
        w: barW,
        h,
      };
    });
  }, [data, max, plotW, plotH]);

  // Label roughly every seventh point so the axis never collides.
  const labelEvery = Math.max(1, Math.ceil(data.length / 4));

  if (data.length === 0) {
    return (
      <div className="chart">
        <svg className="chart__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption}>
          <title>{caption}</title>
          <text className="chart__empty" x={width / 2} y={height / 2} textAnchor="middle">
            Not enough history yet
          </text>
        </svg>
      </div>
    );
  }

  const summary = `${caption}. ${data
    .filter((_, i) => i % labelEvery === 0)
    .map((d) => `${d.fullLabel}: ${Math.round(d.value)}${unit}`)
    .join('. ')}`;

  return (
    <div className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{caption}</title>
        <defs>
          <linearGradient id={`wa-bar-${gradientId}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent-blue)" />
            <stop offset="100%" stopColor="var(--accent-ice)" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = padTop + plotH - (tick / max) * plotH;
          return (
            <g key={tick}>
              <line className="chart__grid" x1={padLeft} y1={y} x2={width - 4} y2={y} />
              <text className="chart__axis" x={padLeft - 6} y={y + 3} textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        {bars.map((b, i) => (
          <rect
            key={`${b.label}-${i}`}
            className={b.muted ? 'chart__bar chart__bar--muted' : 'chart__bar'}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={Math.min(2.5, b.w / 2)}
            fill={b.muted ? undefined : `url(#wa-bar-${gradientId})`}
          >
            <title>{`${b.fullLabel}: ${Math.round(b.value)}${unit}`}</title>
          </rect>
        ))}

        {bars.map((b, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`label-${i}`}
              className="chart__axis"
              x={b.x + b.w / 2}
              y={height - 5}
              textAnchor="middle"
            >
              {b.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
