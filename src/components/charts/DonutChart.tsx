import { useState } from 'react';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';

interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  total: number;
  centerLabel: string;
  onSelect?: (label: string) => void;
  activeLabel?: string;
}

export function DonutChart({
  data,
  total,
  centerLabel,
  onSelect,
  activeLabel,
}: DonutChartProps) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const [hovered, setHovered] = useState<string | null>(null);
  const { tooltip, show, hide, containerRef } = useChartTooltip();

  let runningOffset = 0;
  const segments = data
    .filter((item) => item.value > 0)
    .map((item) => {
      const fraction = total ? item.value / total : 0;
      const length = fraction * circumference;
      const segment = { ...item, length, offset: runningOffset };
      runningOffset += length;
      return segment;
    });

  // `activeLabel` can be an empty string when no status filter is applied,
  // so normalise it before using it as a focus target.
  const focus = hovered ?? (activeLabel || null);
  const focusDatum = focus ? data.find((item) => item.label === focus) : null;
  const focusValue = focusDatum?.value ?? 0;

  return (
    <div className="donut-wrap" ref={containerRef}>
      <div className="donut-graphic">
        <svg
          viewBox="0 0 160 160"
          role="img"
          aria-label={`${total} projects by status`}
        >
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="rgba(6, 78, 59, 0.08)"
            strokeWidth="16"
          />
          {segments.map((segment) => {
            const visible = Math.max(0, segment.length - 2);
            const dim = focus !== null && focus !== segment.label;
            return (
              <circle
                key={segment.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={focus === segment.label ? 19 : 16}
                strokeDasharray={`${visible} ${circumference - visible}`}
                strokeDashoffset={-segment.offset}
                transform="rotate(-90 80 80)"
                className={`donut-seg${dim ? ' is-dimmed' : ''}${
                  focus === segment.label ? ' is-focused' : ''
                }`}
                tabIndex={0}
                role="button"
                aria-label={`${segment.label}: ${segment.value} projects, ${Math.round(
                  (segment.value / total) * 100,
                )} percent`}
                onMouseEnter={(event) => {
                  setHovered(segment.label);
                  show(event, {
                    title: segment.label,
                    subtitle: `${segment.value} projects · ${Math.round(
                      (segment.value / total) * 100,
                    )}% of ${total}`,
                    rows: [
                      {
                        label: 'Projects',
                        value: String(segment.value),
                        color: segment.color,
                      },
                    ],
                  });
                }}
                onMouseMove={(event) =>
                  show(event, {
                    title: segment.label,
                    subtitle: `${segment.value} projects · ${Math.round(
                      (segment.value / total) * 100,
                    )}% of ${total}`,
                    rows: [
                      {
                        label: 'Projects',
                        value: String(segment.value),
                        color: segment.color,
                      },
                    ],
                  })
                }
                onMouseLeave={() => {
                  setHovered(null);
                  hide();
                }}
                onFocus={() => setHovered(segment.label)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(segment.label)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect?.(segment.label);
                  }
                }}
              />
            );
          })}
          <text x="80" y="75" textAnchor="middle" className="donut-value">
            {focusDatum ? focusValue : total}
          </text>
          <text x="80" y="93" textAnchor="middle" className="donut-label">
            {focusDatum ? focusDatum.label : centerLabel}
          </text>
        </svg>
        <ChartTooltip
          payload={tooltip}
          surfaceRef={containerRef}
          variant="compact"
        />
      </div>

      <ul className="donut-legend">
        {data.map((item) => {
          const dim = focus !== null && focus !== item.label;
          return (
            <li
              key={item.label}
              className={dim ? 'is-dimmed' : undefined}
              onMouseEnter={() => setHovered(item.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="legend-dot"
                style={{ backgroundColor: item.color }}
              />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{item.value}</span>
              <span className="legend-pct">
                {total ? Math.round((item.value / total) * 100) : 0}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
