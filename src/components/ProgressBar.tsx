import { clamp } from '../lib/format';

interface ProgressBarProps {
  value: number;
  color?: string;
  className?: string;
}

export function ProgressBar({
  value,
  color = 'var(--green-600)',
  className = '',
}: ProgressBarProps) {
  return (
    <div
      className={`progress ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="progress-fill"
        style={{ width: `${clamp(value, 0, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}
