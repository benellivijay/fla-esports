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
            <Trophy className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Select Tournament Match
              </label>
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-medium"
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
              className="px-3 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surfaceMuted hover:bg-surface rounded-lg border border-hairline border-border flex items-center gap-1.5 transition-colors"
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
                ? 'bg-status-successBg border-status-successBorder text-status-success'
                : 'bg-status-dangerBg border-status-dangerBorder text-status-danger'
            }`}
          >
            {executionResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {executionResult.success ? 'Payout Processed' : 'Payout Execution Error'}
              </p>
              <p className="mt-0.5 font-medium">{executionResult.message}</p>
            </div>
          </div>
        )}

        {/* Payout Overview Metric Cards */}
        {previewData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="md">
              <span className="text-xs font-semibold text-textSecondary">Total tournament prize pool</span>
              <div className="text-xl font-bold text-highlight mt-2">
                ₹{previewData.totalPrizePool.toLocaleString('en-IN')}
              </div>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold text-textSecondary">Computed payout sum</span>
              <div className="text-xl font-bold text-highlight mt-2">
                ₹{previewData.totalComputedPayout.toLocaleString('en-IN')}
              </div>
            </Card>

            <Card padding="md">
              <span className="text-xs font-semibold text-textSecondary">Payout status</span>
              <div className="mt-2 flex items-center gap-2">
                <PillBadge
                  label={previewData.payoutStatus === 'paid' ? 'Payout Dispatched' : 'Unpaid Preview'}
                  variant={previewData.payoutStatus === 'paid' ? 'success' : 'warning'}
                />
                {!previewData.allResultsVerified && previewData.payoutStatus !== 'paid' && (
                  <span className="text-[11px] text-status-warning font-semibold">
                    ({previewData.unverifiedCount} unverified claims)
                  </span>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Computed Payout Breakdown Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textPrimary">
                Computed per-player payout breakdown
              </h3>
              <p className="text-xs text-textSecondary mt-0.5 font-medium">
                Formula: Placement Prize (Rank Tier) + (Kill Count × Per-Kill Rate)
              </p>
            </div>

            {/* Action Trigger Button */}
            {previewData && previewData.payoutStatus !== 'paid' && (
              <button
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={previewData.payoutBreakdown.length === 0}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 text-xs font-bold rounded-full transition-colors flex items-center gap-2 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & send payouts</span>
              </button>
            )}

            {previewData && previewData.payoutStatus === 'paid' && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-status-successBg text-status-success rounded-full border border-hairline border-status-successBorder text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Payout completed & ledger credited</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceMuted border-b border-hairline border-border text-textSecondary font-semibold">
                <tr>
                  <th className="px-5 py-3">Player / Slot</th>
                  <th className="px-4 py-3">Free Fire ID</th>
                  <th className="px-4 py-3">Rank / Kills</th>
                  <th className="px-4 py-3">Placement prize</th>
                  <th className="px-4 py-3">Kill bounty</th>
                  <th className="px-4 py-3 font-bold text-textPrimary">Total payout</th>
                  <th className="px-5 py-3 text-right">Verification status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-border">
                {isPreviewLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-textSecondary">
                      Computing prize matrix...
                    </td>
                  </tr>
                ) : !previewData || previewData.payoutBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-textSecondary">
                      No match result submissions recorded for this tournament.
                    </td>
                  </tr>
                ) : (
                  previewData.payoutBreakdown.map((p, idx) => (
                    <tr key={idx} className="hover:bg-surfaceMuted/50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-textPrimary">
                        Slot #{p.slotNumber} • {p.displayName || p.ffIgn}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-primary font-medium">
                        {p.ffUid} ({p.ffIgn})
                      </td>
                      <td className="px-4 py-3.5 text-textPrimary font-semibold">
                        Rank #{p.rank} • {p.kills} kills
                      </td>
                      <td className="px-4 py-3.5 text-textSecondary font-medium">₹{p.placementPrize}</td>
                      <td className="px-4 py-3.5 text-textSecondary font-medium">₹{p.killPrize}</td>
                      <td className="px-4 py-3.5 font-bold text-highlight text-sm">
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
          <div className="p-3 bg-status-warningBg rounded-lg border border-hairline border-status-warningBorder flex items-start gap-2.5 text-xs text-status-warning">
            <ShieldAlert className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Sensitive Financial Transaction</p>
              <p className="mt-0.5 font-medium text-textPrimary">
                Confirming will immediately credit <strong className="text-highlight">₹{previewData?.totalComputedPayout}</strong> across verified players' wallet ledgers and mark the tournament as completed. This action is irreversible and recorded in the audit log.
              </p>
            </div>
          </div>

          <div className="p-3 bg-surfaceMuted rounded-lg border border-hairline border-border space-y-1.5 text-xs">
            <div className="flex justify-between text-textSecondary">
              <span>Tournament:</span>
              <span className="font-bold text-textPrimary">{previewData?.tournament.title}</span>
            </div>
            <div className="flex justify-between text-textSecondary">
              <span>Verified Players to Credit:</span>
              <span className="font-bold text-textPrimary">
                {previewData?.payoutBreakdown.filter((p) => p.status === 'verified').length}
              </span>
            </div>
            <div className="flex justify-between text-textSecondary">
              <span>Total Payout Amount:</span>
              <span className="font-bold text-highlight text-sm">
                ₹{previewData?.totalComputedPayout}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary rounded-full border border-hairline border-border hover:bg-surfaceMuted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExecutingPayout}
              onClick={handleExecutePayout}
              className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
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
