import type { MilestoneStatus, RiskLevel, Status } from '../types';

export interface StatusStyle {
  color: string;
  bg: string;
  border: string;
  chart: string;
}

export const STATUS_META: Record<Status, StatusStyle> = {
  'On Track': {
    color: '#065f46',
    bg: 'rgba(209, 250, 229, 0.7)',
    border: 'rgba(255, 255, 255, 0.6)',
    chart: '#14a557',
  },
  'At Risk': {
    color: '#92400e',
    bg: 'rgba(254, 243, 199, 0.7)',
    border: 'rgba(255, 255, 255, 0.6)',
    chart: '#aa731d',
  },
  Delayed: {
    color: '#9f1239',
    bg: 'rgba(255, 228, 230, 0.7)',
    border: 'rgba(255, 255, 255, 0.6)',
    chart: '#be123c',
  },
  Completed: {
    color: '#075985',
    bg: 'rgba(224, 242, 254, 0.7)',
    border: 'rgba(255, 255, 255, 0.6)',
    chart: '#0284c7',
  },
  'Not Started': {
    color: '#475569',
    bg: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.7)',
    chart: '#94a3b8',
  },
  'No Target': {
    color: '#475569',
    bg: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.7)',
    chart: '#94a3b8',
  },
  Unplanned: {
    color: '#3f6212',
    bg: 'rgba(236, 252, 203, 0.7)',
    border: 'rgba(255, 255, 255, 0.6)',
    chart: '#65a30d',
  },
};

export const MILESTONE_META: Record<
  MilestoneStatus,
  { color: string; bg: string; border: string }
> = {
  Completed: { color: '#065f46', bg: 'rgba(209, 250, 229, 0.7)', border: 'rgba(255, 255, 255, 0.6)' },
  'In Progress': { color: '#075985', bg: 'rgba(224, 242, 254, 0.7)', border: 'rgba(255, 255, 255, 0.6)' },
  Pending: { color: '#475569', bg: 'rgba(255, 255, 255, 0.5)', border: 'rgba(255, 255, 255, 0.7)' },
  Overdue: { color: '#9f1239', bg: 'rgba(255, 228, 230, 0.7)', border: 'rgba(255, 255, 255, 0.6)' },
};

export const RISK_META: Record<RiskLevel, { color: string; bg: string }> = {
  Low: { color: '#065f46', bg: 'rgba(209, 250, 229, 0.7)' },
  Medium: { color: '#92400e', bg: 'rgba(254, 243, 199, 0.7)' },
  High: { color: '#9f1239', bg: 'rgba(255, 228, 230, 0.7)' },
};
