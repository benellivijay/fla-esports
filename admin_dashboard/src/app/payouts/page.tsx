'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  BadgeDollarSign,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  ShieldAlert,
  Wallet,
  Check,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { TournamentItem, PayoutPreviewData } from '@/types';

export default function PayoutRunsPage() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [previewData, setPreviewData] = useState<PayoutPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Confirm Payout Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExecutingPayout, setIsExecutingPayout] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchTournaments = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getTournaments({ limit: 50 });
      if (res.data?.tournaments) {
        setTournaments(res.data.tournaments);
        if (res.data.tournaments.length > 0 && !selectedTournamentId) {
          setSelectedTournamentId(res.data.tournaments[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchPayoutPreview = async (tourneyId: string) => {
    if (!tourneyId) return;
    setIsPreviewLoading(true);
    setExecutionResult(null);
    try {
      const res = await AdminApi.getPayoutPreview(tourneyId);
      if (res.data?.data) {
        setPreviewData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load payout preview:', err);
      setPreviewData(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchPayoutPreview(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  const handleExecutePayout = async () => {
    if (!selectedTournamentId) return;
    setIsExecutingPayout(true);

    try {
      const res = await AdminApi.executePayoutRun(selectedTournamentId);
      if (res.data?.success) {
        setExecutionResult({
          success: true,
          message: res.data.data?.message || 'Payout run executed successfully.',
        });
        setIsConfirmModalOpen(false);
        fetchPayoutPreview(selectedTournamentId);
        fetchTournaments();
      }
    } catch (err: any) {
      setExecutionResult({
        success: false,
        message: err.response?.data?.message || 'Failed to execute payout run.',
      });
      setIsConfirmModalOpen(false);
    } finally {
      setIsExecutingPayout(false);
    }
  };

  return (
    <AdminLayout>
      <Header
        title="Esports payout runs"
        subtitle="Review computed placement + kill prize previews and trigger idempotent wallet credits"
      />

      <div className="space-y-6 mt-6">
        {/* Tournament Selector Card */}
        <Card padding="md" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <Trophy className="w-5 h-5 text-slate-500 shrink-0" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Tournament Match
              </label>
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 font-medium"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.mode} • ₹{t.prize_pool} • {t.status} • Payout: {t.payout_status || 'unpaid'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPayoutPreview(selectedTournamentId)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-hairline border-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? 'animate-spin' : ''}`} />
              <span>Refresh preview</span>
            </button>
          </div>
        </Card>

        {/* Execution Result Banner */}
        {executionResult && (
          <div
            className={`p-4 rounded-xl border border-hairline flex items-start gap-3 text-xs ${
              executionResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {executionResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {executionResult.success ? 'Payout Processed' : 'Payout Execution Error'}
              </p>
              <p className="mt-0.5">{executionResult.message}</p>
            </div>
          </div>
        )}

        {/* Payout Overview Metric Cards */}
        {previewData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="md">
              <span className="text-xs font-medium text-slate-500">Total tournament prize pool</span>
              <div className="text-xl font-bold text-slate-900 mt-2">
                ₹{previewData.totalPrizePool.toLocaleString('en-IN')}
              </div>
            </Card>

            <Card padding="md">
              <span className="text-xs font-medium text-slate-500">Computed payout sum</span>
              <div className="text-xl font-bold text-slate-900 mt-2">
                ₹{previewData.totalComputedPayout.toLocaleString('en-IN')}
              </div>
            </Card>

            <Card padding="md">
              <span className="text-xs font-medium text-slate-500">Payout status</span>
              <div className="mt-2 flex items-center gap-2">
                <PillBadge
                  label={previewData.payoutStatus === 'paid' ? 'Payout Dispatched' : 'Unpaid Preview'}
                  variant={previewData.payoutStatus === 'paid' ? 'success' : 'warning'}
                />
                {!previewData.allResultsVerified && previewData.payoutStatus !== 'paid' && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    ({previewData.unverifiedCount} unverified claims)
                  </span>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Computed Payout Breakdown Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Computed per-player payout breakdown
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Formula: Placement Prize (Rank Tier) + (Kill Count × Per-Kill Rate)
              </p>
            </div>

            {/* Action Trigger Button */}
            {previewData && previewData.payoutStatus !== 'paid' && (
              <button
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={previewData.payoutBreakdown.length === 0}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded-full transition-colors flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & send payouts</span>
              </button>
            )}

            {previewData && previewData.payoutStatus === 'paid' && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-hairline border-emerald-200 text-xs font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Payout completed & ledger credited</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-hairline border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-5 py-3">Player / Slot</th>
                  <th className="px-4 py-3">Free Fire ID</th>
                  <th className="px-4 py-3">Rank / Kills</th>
                  <th className="px-4 py-3">Placement prize</th>
                  <th className="px-4 py-3">Kill bounty</th>
                  <th className="px-4 py-3 font-semibold text-slate-900">Total payout</th>
                  <th className="px-5 py-3 text-right">Verification status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-slate-100">
                {isPreviewLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      Computing prize matrix...
                    </td>
                  </tr>
                ) : !previewData || previewData.payoutBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      No match result submissions recorded for this tournament.
                    </td>
                  </tr>
                ) : (
                  previewData.payoutBreakdown.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        Slot #{p.slotNumber} • {p.displayName || p.ffIgn}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {p.ffUid} ({p.ffIgn})
                      </td>
                      <td className="px-4 py-3.5 text-slate-800">
                        Rank #{p.rank} • {p.kills} kills
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">₹{p.placementPrize}</td>
                      <td className="px-4 py-3.5 text-slate-700">₹{p.killPrize}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 text-sm">
                        ₹{p.totalPayout}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <PillBadge
                          label={p.status === 'verified' ? 'Verified' : p.status}
                          variant={p.status === 'verified' ? 'success' : 'warning'}
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

      {/* Distinct Confirm and Send Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm and send esports payouts"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-hairline border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sensitive Financial Transaction</p>
              <p className="mt-0.5">
                Confirming will immediately credit <strong>₹{previewData?.totalComputedPayout}</strong> across verified players' wallet ledgers and mark the tournament as completed. This action is irreversible and recorded in the audit log.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-hairline border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Tournament:</span>
              <span className="font-semibold text-slate-900">{previewData?.tournament.title}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Verified Players to Credit:</span>
              <span className="font-semibold text-slate-900">
                {previewData?.payoutBreakdown.filter((p) => p.status === 'verified').length}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Payout Amount:</span>
              <span className="font-bold text-slate-900 text-sm">
                ₹{previewData?.totalComputedPayout}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 rounded-full border border-hairline border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExecutingPayout}
              onClick={handleExecutePayout}
              className="px-5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-full transition-colors flex items-center gap-1.5"
            >
              {isExecutingPayout ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Authorize & credit wallets</span>
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
