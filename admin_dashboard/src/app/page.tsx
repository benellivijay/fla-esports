'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import {
  CheckSquare,
  Trophy,
  Wallet,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  Clock,
  Shield,
  RefreshCw,
  Users,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { DashboardStats, TournamentItem } from '@/types';

export default function DashboardHomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, tourneysRes] = await Promise.all([
        AdminApi.getDashboardStats(),
        AdminApi.getTournaments({ limit: 10 }),
      ]);
      if (statsRes.data?.data) {
        setStats(statsRes.data.data);
      }
      if (tourneysRes.data?.tournaments) {
        setTournaments(tourneysRes.data.tournaments);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminLayout>
      <Header
        title="Dashboard overview"
        subtitle="Real-time operational summary & tournament activity"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 text-textSecondary hover:text-textPrimary rounded-lg hover:bg-surfaceMuted transition-colors border border-hairline border-border"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/tournaments/create"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-slate-950 text-xs font-bold rounded-full transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create tournament</span>
            </Link>
          </div>
        }
      />

      <div className="space-y-6 mt-6">
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending result reviews"
            value={stats?.pendingResultReviews ?? 0}
            subtitle="Uploaded match scoreboards"
            icon={CheckSquare}
          />
          <StatCard
            title="Tournaments live today"
            value={stats?.tournamentsLiveToday ?? 0}
            subtitle="Scheduled esports lobbies"
            icon={Trophy}
          />
          <StatCard
            title="Total wallet balance"
            value={`₹${(stats?.totalPlatformBalance ?? 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}`}
            subtitle="Across all player ledgers"
            icon={Wallet}
          />
          <StatCard
            title="Disputed results"
            value={stats?.disputedResultsCount ?? 0}
            subtitle="Requiring staff arbitration"
            icon={AlertTriangle}
          />
        </div>

        {/* 2-Column Section: Active Tournaments & Recent Audit Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Tournaments Table (2 cols) */}
          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-hairline border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-textPrimary">Upcoming & live tournaments</h3>
                  <p className="text-xs text-textSecondary mt-0.5">Manage room credentials and lobby status</p>
                </div>
                <Link
                  href="/tournaments"
                  className="text-xs font-semibold text-textSecondary hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surfaceMuted border-b border-hairline border-border text-textSecondary font-semibold">
                    <tr>
                      <th className="px-5 py-2.5">Tournament</th>
                      <th className="px-4 py-2.5">Mode / Map</th>
                      <th className="px-4 py-2.5">Prize pool</th>
                      <th className="px-4 py-2.5">Slots</th>
                      <th className="px-4 py-2.5">Room ID</th>
                      <th className="px-5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline divide-border">
                    {tournaments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-textSecondary">
                          No active tournaments found. Create one to begin.
                        </td>
                      </tr>
                    ) : (
                      tournaments.map((t) => (
                        <tr key={t.id} className="hover:bg-surfaceMuted/50 transition-colors">
                          <td className="px-5 py-3 font-semibold text-textPrimary max-w-[180px] truncate">
                            <Link href={`/tournaments`} className="hover:text-primary hover:underline transition-colors">
                              {t.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-textSecondary capitalize font-medium">
                            {t.mode} • {t.map}
                          </td>
                          <td className="px-4 py-3 font-bold text-highlight">
                            ₹{t.prize_pool}
                          </td>
                          <td className="px-4 py-3 text-textSecondary font-medium">
                            {t.filled_slots} / {t.max_slots}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {t.room_id ? (
                              <span className="px-2 py-0.5 bg-surfaceMuted rounded text-primary border border-hairline border-border">
                                {t.room_id}
                              </span>
                            ) : (
                              <span className="text-textSecondary/60 italic">Not set</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <PillBadge
                              label={t.status}
                              variant={
                                t.status === 'ongoing'
                                  ? 'warning'
                                  : t.status === 'completed'
                                  ? 'success'
                                  : t.status === 'cancelled'
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="sm"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Recent Audit Log Stream (1 col) */}
          <div>
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-hairline border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-textPrimary">Recent staff audit log</h3>
                  <p className="text-xs text-textSecondary mt-0.5">Immutable staff actions</p>
                </div>
                <Link
                  href="/audit-logs"
                  className="text-xs font-semibold text-textSecondary hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <span>Logs</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-4 space-y-3">
                {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
                  stats.recentAuditLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-surfaceMuted rounded-lg border border-hairline border-border text-xs"
                    >
                      <div className="flex items-center justify-between text-textSecondary text-[11px] mb-1">
                        <span className="font-mono font-semibold text-primary">
                          {log.action}
                        </span>
                        <span>
                          {new Date(log.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-textSecondary text-[11px] truncate">
                        By: <span className="text-textPrimary font-semibold">{log.actor_email || 'System'}</span>
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-textSecondary py-6">
                    No recent audit activity recorded.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
