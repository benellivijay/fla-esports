'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Trophy,
  CheckSquare,
  BadgeDollarSign,
  Wallet,
  Users,
  ScrollText,
  LogOut,
  ShieldCheck,
  QrCode,
  KeyRound,
  Bell,
  Smartphone,
  X,
} from 'lucide-react';
import { PillBadge } from '../ui/PillBadge';
import { AdminApi } from '@/lib/api';
import { useLayout } from './AdminLayout';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobileSidebarOpen, closeMobileSidebar } = useLayout();
  const [user, setUser] = useState<any>(null);
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (_) {}
      }
    }

    // Fetch live pending count
    AdminApi.getDashboardStats()
      .then((res) => {
        if (res.data?.data?.pendingResultReviews !== undefined) {
          setPendingReviewCount(res.data.data.pendingResultReviews);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Tournaments', href: '/tournaments', icon: Trophy },
    {
      label: 'Result reviews',
      href: '/results',
      icon: CheckSquare,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    { label: 'Announcements', href: '/notifications', icon: Bell },
    { label: 'APK & Devices', href: '/devices', icon: Smartphone },
    { label: 'Deposit requests', href: '/deposits', icon: QrCode },
    { label: 'Payout runs', href: '/payouts', icon: BadgeDollarSign },
    { label: 'Wallet adjustments', href: '/wallet', icon: Wallet },
    { label: 'User management', href: '/users', icon: Users },
    { label: 'Staff & 2FA', href: '/staff', icon: KeyRound },
    { label: 'Audit logs', href: '/audit-logs', icon: ScrollText },
  ];

  return (
    <aside
      className={`w-64 bg-surface border-r border-hairline border-border flex flex-col h-screen fixed left-0 top-0 z-50 select-none shadow-xl lg:shadow-none transition-transform duration-200 ease-in-out ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-hairline border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-border bg-slate-950 shrink-0 shadow-sm flex items-center justify-center">
            <img src="/app_logo.png?v=3" alt="FLA Esports" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-textPrimary leading-tight tracking-wide">FLA ESPORTS</h1>
            <p className="text-[11px] text-textSecondary font-medium">Admin Console</p>
          </div>
        </div>
        
        {/* Mobile Close Button */}
        <button
          onClick={closeMobileSidebar}
          className="p-1.5 text-textSecondary hover:text-textPrimary rounded-lg lg:hidden hover:bg-surfaceMuted transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[11px] font-semibold text-textSecondary/70 uppercase tracking-wider">
          Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileSidebar}
              className={`flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-slate-950 shadow-xs'
                  : 'text-textSecondary hover:bg-surfaceMuted hover:text-textPrimary'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-textSecondary'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-slate-950 text-primary' : 'bg-highlight/15 text-highlight border border-highlight/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-hairline border-border bg-surfaceMuted/30">
        <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-hairline border-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-surfaceMuted border border-border flex items-center justify-center text-textPrimary text-xs font-bold shrink-0">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-textPrimary truncate">
                {user?.email || 'admin@ffesports.com'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-status-success shrink-0" />
                <span className="text-[10px] text-textSecondary capitalize">{user?.role || 'Admin'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-textSecondary hover:text-status-danger rounded-md hover:bg-status-danger/10 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
