'use client';

import React from 'react';
import { PillBadge } from '../ui/PillBadge';
import { Activity, Shield } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="h-16 bg-white border-b border-hairline border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-hairline border-emerald-200 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-[11px]">API Online</span>
          </div>
          <PillBadge label="Staff Mode" variant="primary" size="sm" />
        </div>
      </div>
    </header>
  );
};
