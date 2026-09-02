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
    { label: 'Deposit requests', href: '/deposits', icon: QrCode },
    { label: 'Payout runs', href: '/payouts', icon: BadgeDollarSign },
    { label: 'Wallet adjustments', href: '/wallet', icon: Wallet },
    { label: 'User management', href: '/users', icon: Users },
    { label: 'Audit logs', href: '/audit-logs', icon: ScrollText },
  ];

  return (
    <aside
      className={`w-64 bg-white border-r border-hairline border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-50 select-none shadow-xl lg:shadow-none transition-transform duration-200 ease-in-out ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-hairline border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-950 shrink-0 shadow-sm flex items-center justify-center">
            <img src="/app_logo.png?v=3" alt="FLA Esports" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">FLA ESPORTS</h1>
            <p className="text-[11px] text-slate-400">Admin Console</p>
          </div>
        </div>
        
        {/* Mobile Close Button */}
        <button
          onClick={closeMobileSidebar}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg lg:hidden hover:bg-slate-100 transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
              className={`flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-700'
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
      <div className="p-3 border-t border-hairline border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-hairline border-slate-200">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shrink-0">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-slate-900 truncate">
                {user?.email || 'admin@ffesports.com'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="text-[10px] text-slate-500 capitalize">{user?.role || 'Admin'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
