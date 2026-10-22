import { useCallback, useRef, useState } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipPayload {
  title: string;
  subtitle?: string;
  rows: TooltipRow[];
}

interface TooltipState extends TooltipPayload {
  x: number;
  y: number;
}

interface UseChartTooltipResult {
  tooltip: TooltipState | null;
  show: (event: PointerLike, payload: TooltipPayload) => void;
  hide: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

/** Minimal shape shared by React mouse events and synthetic pointer hints. */
export interface PointerLike {
  clientX: number;
  clientY: number;
}

const FLIP_THRESHOLD = 170;

/**
 * Tracks a floating tooltip inside a relatively positioned chart surface.
 * Coordinates are resolved against the surface so the tooltip never escapes
 * the card and stays correct when the chart is scaled.
 */
export function useChartTooltip(): UseChartTooltipResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const show = useCallback(
    (event: PointerLike, payload: TooltipPayload) => {
      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      setTooltip({
        ...payload,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    },
    [],
  );

  const hide = useCallback(() => setTooltip(null), []);

  return { tooltip, show, hide, containerRef };
}

interface ChartTooltipProps {
  payload: TooltipState | null;
  surfaceRef: React.RefObject<HTMLDivElement>;
  /**
   * `float` follows the cursor and flips near the right edge. `compact` is a
   * small strip anchored to the bottom of the nearest positioned ancestor,
   * used where a floating panel would cover adjacent content.
   */
  variant?: 'float' | 'compact';
}

/**
 * Renders the floating glass tooltip. The label is flipped to the left of the
 * cursor when it would otherwise overflow the chart surface, and the vertical
 * position is clamped so the tooltip never escapes the surface bounds.
 */
export function ChartTooltip({
  payload,
  surfaceRef,
  variant = 'float',
}: ChartTooltipProps) {
  if (!payload) return null;

  if (variant === 'compact') {
    return (
      <div className="chart-tip chart-tip-compact" role="tooltip">
        <p className="chart-tip-title">{payload.title}</p>
        {payload.subtitle ? (
          <p className="chart-tip-subtitle">{payload.subtitle}</p>
        ) : null}
      </div>
    );
  }

  const surface = surfaceRef.current;
  const width = surface?.clientWidth ?? 0;
  const height = surface?.clientHeight ?? 0;
  const flip = width > 0 && payload.x > width - FLIP_THRESHOLD;
  const clampedY =
    height > 0 ? Math.min(Math.max(payload.y, 56), height - 24) : payload.y;

  return (
    <div
      className="chart-tip"
      role="tooltip"
      style={{
        left: payload.x,
        top: clampedY,
        transform: `translate(${flip ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
      }}
    >
      <p className="chart-tip-title">{payload.title}</p>
      {payload.subtitle ? (
        <p className="chart-tip-subtitle">{payload.subtitle}</p>
      ) : null}
      <div className="chart-tip-rows">
        {payload.rows.map((row) => (
          <div className="chart-tip-row" key={row.label}>
            <span className="chart-tip-key">
              {row.color ? (
                <i style={{ backgroundColor: row.color }} />
              ) : null}
              {row.label}
            </span>
            <span className="chart-tip-value">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
