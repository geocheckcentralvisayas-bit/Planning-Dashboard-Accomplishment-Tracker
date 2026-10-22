import { STATUS_META } from '../lib/status';
import type { Status } from '../types';

interface StatusPillProps {
  status: Status;
  compact?: boolean;
}

export function StatusPill({ status, compact = false }: StatusPillProps) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`status-pill ${compact ? 'status-pill-compact' : ''}`}
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
        borderColor: meta.border,
      }}
    >
      <span className="status-dot" style={{ backgroundColor: meta.color }} />
      {status}
    </span>
  );
}
