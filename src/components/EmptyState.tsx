import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <SearchX size={22} />
      </div>
      <p className="empty-title">{title}</p>
      <p className="empty-message">{message}</p>
      {action}
    </div>
  );
}
