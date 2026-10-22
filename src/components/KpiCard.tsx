import type { ReactNode } from 'react';

export type KpiTone = 'green' | 'amber' | 'red' | 'teal' | 'slate' | 'gold';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: KpiTone;
}

export function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = 'green',
}: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-head">
        <div className="kpi-body">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
        </div>
        <div className="kpi-icon" aria-hidden="true">
          {icon}
        </div>
      </div>
      <p className="kpi-sub">{sub}</p>
    </article>
  );
}
