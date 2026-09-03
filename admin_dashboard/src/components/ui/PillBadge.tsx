import React from 'react';

interface PillBadgeProps {
  label: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  size?: 'sm' | 'md';
}

export const PillBadge: React.FC<PillBadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
}) => {
  const variantStyles = {
    neutral: 'bg-surfaceMuted text-textSecondary border-border',
    primary: 'bg-primary text-slate-950 border-primary font-bold shadow-xs',
    success: 'bg-status-successBg text-status-success border-status-successBorder',
    warning: 'bg-status-warningBg text-status-warning border-status-warningBorder',
    danger: 'bg-status-dangerBg text-status-danger border-status-dangerBorder',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border border-hairline leading-none ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {label}
    </span>
  );
};
