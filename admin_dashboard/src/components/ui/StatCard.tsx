import React from 'react';
import { Card } from './Card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant?: 'neutral' | 'success' | 'warning' | 'danger';
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
}) => {
  return (
    <Card padding="md" className="flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-textSecondary">{title}</span>
        <div className="p-2 bg-surfaceMuted rounded-lg border border-hairline border-border">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold text-textPrimary tracking-tight">{value}</div>
        {subtitle && <p className="text-xs text-textSecondary mt-1 font-medium">{subtitle}</p>}
      </div>
    </Card>
  );
};
