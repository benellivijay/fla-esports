'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PillBadge } from '@/components/ui/PillBadge';
import {
  Smartphone,
  Users,
  Activity,
  Calendar,
  Search,
  RefreshCw,
  Cpu,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { ApkUsageStats, ApkDeviceItem } from '@/types';

export default function DevicesPage() {
  const [stats, setStats] = useState<ApkUsageStats | null>(null);
  const [devices, setDevices] = useState<ApkDeviceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getApkUsageStats();
      if (res.data?.data) {
        setStats(res.data.data);
        setDevices(res.data.data.recentDevices || []);
      }
    } catch (err) {
      console.error('Failed to load APK analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.device_id.toLowerCase().includes(q) ||
      (d.display_name && d.display_name.toLowerCase().includes(q)) ||
      (d.email && d.email.toLowerCase().includes(q)) ||
      (d.phone && d.phone.toLowerCase().includes(q)) ||
      (d.ff_uid && d.ff_uid.toLowerCase().includes(q)) ||
      (d.ff_ign && d.ff_ign.toLowerCase().includes(q)) ||
      (d.os_version && d.os_version.toLowerCase().includes(q))
    );
  });

  const isRecentlyActive = (lastActiveStr: string) => {
    try {
      const lastActive = new Date(lastActiveStr).getTime();
      const now = new Date().getTime();
      return now - lastActive < 24 * 60 * 60 * 1000;
    } catch (_) {
      return false;
    }
  };

  return (
    <AdminLayout>
      <Header
        title="APK & Devices"
        subtitle="Real-time Android app installations, active player sessions & device registry"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surfaceMuted text-textPrimary text-xs font-semibold rounded-lg transition-colors border border-hairline border-border"
              title="Refresh device metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="space-y-6 mt-6">
        {/* Top Analytics StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total APK Installs"
            value={stats?.totalApkInstalls ?? 0}
            subtitle="Unique Android installations"
            icon={Smartphone}
          />
          <StatCard
            title="Active Players Today"
            value={stats?.activeToday ?? 0}
            subtitle="Heartbeats in last 24 hours"
            icon={Activity}
          />
          <StatCard
            title="Active This Week"
            value={stats?.activeThisWeek ?? 0}
            subtitle="7-day rolling active players"
            icon={Calendar}
          />
          <StatCard
            title="Registered APK Users"
            value={stats?.totalRegisteredUsersWithApk ?? 0}
            subtitle="Accounts linked to app devices"
            icon={Users}
          />
        </div>

        {/* Platform & OS Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform Breakdown */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-textPrimary">Platform Breakdown</h3>
            </div>
            <div className="space-y-3">
              {stats?.platformBreakdown && stats.platformBreakdown.length > 0 ? (
                stats.platformBreakdown.map((p) => {
                  const total = stats.totalApkInstalls || 1;
                  const pct = Math.min(100, Math.round((p.count / total) * 100));
                  return (
                    <div key={p.platform} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-semibold text-textPrimary">
                          📱 {p.platform}
                        </span>
                        <span className="font-mono text-textSecondary">
                          {p.count} devices ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surfaceMuted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-textSecondary">No platform records available.</p>
              )}
            </div>
          </Card>

          {/* OS Versions */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-textPrimary">Top Operating Systems</h3>
            </div>
            <div className="space-y-3">
              {stats?.osBreakdown && stats.osBreakdown.length > 0 ? (
                stats.osBreakdown.map((os) => {
                  const total = stats.totalApkInstalls || 1;
                  const pct = Math.min(100, Math.round((os.count / total) * 100));
                  return (
                    <div key={os.osVersion} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-textPrimary truncate max-w-[200px]">
                          {os.osVersion}
                        </span>
                        <span className="font-mono text-textSecondary">
                          {os.count} devices ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surfaceMuted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-highlight rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-textSecondary">No OS distribution records available.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Live Device Sessions Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-textPrimary">Live Device Registry</h3>
              <p className="text-xs text-textSecondary mt-0.5">
                Installed devices and their latest activity timestamps
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search device, user, UID..."
                className="w-full pl-8 pr-3 py-1.5 bg-surfaceMuted border border-hairline border-border rounded-lg text-xs text-textPrimary focus:outline-none focus:border-primary placeholder:text-textSecondary/60"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceMuted border-b border-hairline border-border text-textSecondary font-semibold">
                <tr>
                  <th className="px-5 py-2.5">Device Identifier</th>
                  <th className="px-4 py-2.5">Linked Player</th>
                  <th className="px-4 py-2.5">Platform / Hardware</th>
                  <th className="px-4 py-2.5">App Version</th>
                  <th className="px-4 py-2.5">First Installed</th>
                  <th className="px-5 py-2.5 text-right">Status / Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-border">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-textSecondary">
                      {devices.length === 0
                        ? 'No app installations logged yet. Launch the APK to see live device heartbeats.'
                        : 'No matching devices found.'}
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) => {
                    const isToday = isRecentlyActive(d.last_active_at);
                    return (
                      <tr key={d.device_id} className="hover:bg-surfaceMuted/50 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-textPrimary font-semibold truncate max-w-[140px]">
                              {d.device_id}
                            </span>
                            <button
                              onClick={() => handleCopy(d.device_id)}
                              className="p-1 text-textSecondary hover:text-primary transition-colors"
                              title="Copy Device ID"
                            >
                              {copiedId === d.device_id ? (
                                <Check className="w-3 h-3 text-status-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {d.display_name || d.email || d.phone ? (
                            <div>
                              <p className="font-semibold text-textPrimary truncate max-w-[160px]">
                                {d.display_name || d.email || d.phone}
                              </p>
                              {d.ff_uid && (
                                <p className="text-[11px] text-textSecondary font-mono mt-0.5">
                                  UID: {d.ff_uid} {d.ff_ign ? `(${d.ff_ign})` : ''}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-textSecondary/60 italic text-[11px]">Guest Player</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-textSecondary font-medium">
                          <div className="truncate max-w-[180px]">
                            <span className="capitalize font-semibold text-textPrimary">
                              {d.platform}
                            </span>
                            {d.os_version && (
                              <span className="text-[11px] text-textSecondary block truncate">
                                {d.os_version}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <span className="px-2 py-0.5 bg-surfaceMuted rounded text-primary border border-hairline border-border">
                            v{d.app_version}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-textSecondary text-[11px]">
                          {d.first_installed_at
                            ? new Date(d.first_installed_at).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <PillBadge
                              label={isToday ? 'Active Today' : 'Inactive'}
                              variant={isToday ? 'success' : 'neutral'}
                              size="sm"
                            />
                            <span className="text-[10px] text-textSecondary">
                              {d.last_active_at
                                ? new Date(d.last_active_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
