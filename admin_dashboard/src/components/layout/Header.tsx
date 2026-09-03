'use client';

import React from 'react';
import { PillBadge } from '../ui/PillBadge';
import { Menu } from 'lucide-react';
import { useLayout } from './AdminLayout';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  const { toggleMobileSidebar } = useLayout();

  return (
    <header className="min-h-16 bg-surface border-b border-hairline border-border px-3 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={toggleMobileSidebar}
          className="p-2 -ml-1 text-textSecondary hover:text-textPrimary rounded-lg hover:bg-surfaceMuted lg:hidden border border-border shrink-0 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-bold text-textPrimary tracking-tight leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-textSecondary mt-0.5 line-clamp-1 sm:line-clamp-none">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        {actions}

        <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-status-success/15 text-status-success rounded-full border border-hairline border-status-success/30 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            <span className="font-semibold text-[10px] sm:text-[11px]">Online</span>
          </div>
          <div className="hidden sm:block">
            <PillBadge label="Staff Mode" variant="primary" size="sm" />
          </div>
        </div>
      </div>
    </header>
  );
};
