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
    neutral: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
    primary: 'bg-[#0F172A] text-white border-[#0F172A]',
    success: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
    warning: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
    danger: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
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
