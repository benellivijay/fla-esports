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
    <header className="min-h-14 sm:min-h-16 bg-surface border-b border-hairline border-border px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={toggleMobileSidebar}
          className="p-1.5 sm:p-2 -ml-1 text-textPrimary hover:text-primary rounded-lg bg-surfaceMuted/60 hover:bg-surfaceMuted lg:hidden border border-border shrink-0 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-textPrimary tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-[11px] sm:text-xs text-textSecondary mt-0.5 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
        {actions}

        <div className="h-4 w-[1px] bg-border mx-0.5 sm:mx-1 hidden sm:block" />

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-status-success/15 text-status-success rounded-full border border-hairline border-status-success/30 text-[10px] sm:text-xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            <span className="font-semibold text-[10px] sm:text-[11px]">Online</span>
          </div>
          <div className="hidden md:block">
            <PillBadge label="Staff Mode" variant="primary" size="sm" />
          </div>
        </div>
      </div>
    </header>
  );
};
