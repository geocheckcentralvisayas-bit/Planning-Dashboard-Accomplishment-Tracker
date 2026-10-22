import { useState } from 'react';
import type { TrendPoint } from '../../types';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { tooltip, show, hide, containerRef } = useChartTooltip();

  if (points.length < 2) {
    return (
      <div className="chart-empty">Not enough data for the selected filters.</div>
    );
  }

  const width = 720;
  const height = 250;
  const padding = { top: 16, right: 20, bottom: 32, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const x = (index: number) =>
    padding.left + (index * innerWidth) / (points.length - 1);
  const y = (value: number) =>
    padding.top + innerHeight * (1 - value / 100);

  const makeLine = (key: 'planned' | 'actual') =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[key])}`,
      )
      .join(' ');

  const actualLine = makeLine('actual');
  const area = `${actualLine} L ${x(points.length - 1)} ${y(0)} L ${x(
    0,
  )} ${y(0)} Z`;

  const active = hoverIndex === null ? null : points[hoverIndex];

  return (
    <div className="trend-surface" ref={containerRef}>
      <svg
        className="trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Planned versus actual portfolio completion over twelve months"
        onMouseLeave={() => {
          setHoverIndex(null);
          hide();
        }}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - bounds.left) / bounds.width;
          const svgX = ratio * width;
          const step = innerWidth / (points.length - 1);
          const index = Math.round((svgX - padding.left) / step);
          const clamped = Math.max(0, Math.min(points.length - 1, index));
          setHoverIndex(clamped);
          const point = points[clamped];
          const gap = point.actual - point.planned;
          show(event, {
            title: point.label,
            subtitle:
              gap === 0
                ? 'On plan'
                : gap > 0
                  ? `${gap} points ahead of plan`
                  : `${Math.abs(gap)} points behind plan`,
            rows: [
              { label: 'Actual', value: `${point.actual}%`, color: '#14a557' },
              { label: 'Planned', value: `${point.planned}%`, color: '#94a3b8' },
              { label: 'Variance', value: `${gap > 0 ? '+' : ''}${gap}` },
            ],
          });
        }}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14a557" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#14a557" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(value)}
              y2={y(value)}
              className="chart-grid"
            />
            <text
              x={padding.left - 10}
              y={y(value) + 4}
              textAnchor="end"
              className="chart-axis"
            >
              {value}%
            </text>
          </g>
        ))}

        {active ? (
          <g className="trend-crosshair">
            <line
              x1={x(hoverIndex as number)}
              x2={x(hoverIndex as number)}
              y1={padding.top}
              y2={height - padding.bottom}
            />
            <circle
              cx={x(hoverIndex as number)}
              cy={y(active.planned)}
              r="4"
              className="trend-dot trend-dot-planned"
            />
          </g>
        ) : null}

        <path d={area} fill="url(#trendFill)" />
        <path d={makeLine('planned')} className="trend-planned" />
        <path d={actualLine} className="trend-actual" />

        {points.map((point, index) => {
          const isActive = index === hoverIndex;
          return (
            <g key={point.month}>
              <circle
                cx={x(index)}
                cy={y(point.actual)}
                r={isActive ? 6 : 4}
                className={`trend-dot${isActive ? ' is-active' : ''}`}
              >
                <title>
                  {`${point.label}: actual ${point.actual}%, planned ${point.planned}%`}
                </title>
              </circle>
              {index % 2 === 0 || index === points.length - 1 ? (
                <text
                  x={x(index)}
                  y={height - 8}
                  textAnchor="middle"
                  className="chart-axis"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ChartTooltip payload={tooltip} surfaceRef={containerRef} />
    </div>
  );
}
