'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { AuditLogItem } from '@/types';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Snapshot JSON Viewer Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getAuditLogs({
        page,
        limit: 25,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      });
      if (res.data?.logs || res.data?.data) {
        const list = Array.isArray(res.data.data) ? res.data.data : res.data.logs;
        setLogs(list || []);
        setTotal(res.data.total || list?.length || 0);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  return (
    <AdminLayout>
      <Header
        title="Administrative audit trail"
        subtitle="Searchable, filterable and immutable ledger of all staff mutations"
      />

      <div className="space-y-6 mt-6">
        {/* Filters */}
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-hairline border-slate-200 rounded-lg text-slate-700 focus:outline-none font-medium"
            >
              <option value="all">All actions</option>
              <option value="RESULT_VERIFIED">RESULT_VERIFIED</option>
              <option value="RESULT_DISPUTED">RESULT_DISPUTED</option>
              <option value="PAYOUT_RUN_EXECUTED">PAYOUT_RUN_EXECUTED</option>
              <option value="WALLET_MANUALLY_ADJUSTED">WALLET_MANUALLY_ADJUSTED</option>
              <option value="ROOM_CREDENTIALS_UPDATED">ROOM_CREDENTIALS_UPDATED</option>
              <option value="ROOM_REVEALED_MANUAL">ROOM_REVEALED_MANUAL</option>
              <option value="USER_STATUS_UPDATED">USER_STATUS_UPDATED</option>
              <option value="USER_ROLE_UPDATED">USER_ROLE_UPDATED</option>
              <option value="ADMIN_LOGIN_SUCCESS">ADMIN_LOGIN_SUCCESS</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 rounded-lg border border-hairline border-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh ({total} logs)</span>
            </button>
          </div>
        </Card>

        {/* Audit Log Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-hairline border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Staff Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target Resource</th>
                  <th className="px-4 py-3">Target ID</th>
                  <th className="px-5 py-3 text-right">Details snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                      No audit logs found matching the filter.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 truncate max-w-[160px]">
                          {log.actor_email || log.actor_name || 'System / Service'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.actor_id ? log.actor_id.slice(0, 8) + '...' : 'system'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 font-mono text-[11px] font-bold rounded bg-slate-100 text-slate-800 border border-hairline border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {log.target_resource}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">
                        {log.target_id || '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-full border border-hairline border-slate-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View snapshot</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {total > 25 && (
            <div className="px-5 py-3 border-t border-hairline border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing page {page} (Total {total} entries)
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-hairline border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page * 25 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-hairline border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Snapshot JSON Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit log payload: ${selectedLog?.action || ''}`}
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="p-3 bg-slate-900 rounded-lg text-slate-100 font-mono text-xs overflow-x-auto max-h-[50vh]">
            <pre>{JSON.stringify(selectedLog?.details || {}, null, 2)}</pre>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Log ID: {selectedLog?.id}</span>
            <span>Recorded at: {selectedLog?.created_at}</span>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
