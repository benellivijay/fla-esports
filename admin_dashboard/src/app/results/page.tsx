'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  CheckSquare,
  Check,
  AlertTriangle,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { ResultQueueItem } from '@/types';

export default function ResultsQueuePage() {
  const [results, setResults] = useState<ResultQueueItem[]>([]);
  const [counts, setCounts] = useState<{
    pending: number;
    verified: number;
    disputed: number;
    rejected: number;
    total: number;
  }>({ pending: 0, verified: 0, disputed: 0, rejected: 0, total: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Screenshot Viewer Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Dispute Modal
  const [disputeItem, setDisputeItem] = useState<ResultQueueItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // Quick Edit / Approve Modal
  const [verifyItem, setVerifyItem] = useState<ResultQueueItem | null>(null);
  const [editRank, setEditRank] = useState<number>(1);
  const [editKills, setEditKills] = useState<number>(0);
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getResultsQueue({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (res.data?.data) {
        setResults(res.data.data.results || []);
        if (res.data.data.counts) {
          setCounts(res.data.data.counts);
        }
      }
    } catch (err) {
      console.error('Failed to load results queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(() => {
      fetchResults();
    }, 5000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleOpenVerifyModal = (item: ResultQueueItem) => {
    setVerifyItem(item);
    setEditRank(item.admin_confirmed_rank || item.claimed_rank);
    setEditKills(item.admin_confirmed_kills !== undefined ? item.admin_confirmed_kills : item.claimed_kills);
  };

  const handleConfirmVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyItem) return;
    setIsSubmittingVerify(true);

    try {
      await AdminApi.verifyResult(verifyItem.id, {
        confirmedRank: editRank,
        confirmedKills: editKills,
      });
      setVerifyItem(null);
      fetchResults();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to verify result.');
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const handleOpenDisputeModal = (item: ResultQueueItem) => {
    setDisputeItem(item);
    setDisputeReason('');
    setDisputeError(null);
  };

  const handleConfirmDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeItem) return;
    if (!disputeReason.trim()) {
      setDisputeError('Dispute reason note is mandatory.');
      return;
    }

    setIsSubmittingDispute(true);
    setDisputeError(null);

    try {
      await AdminApi.disputeResult(disputeItem.id, disputeReason.trim());
      setDisputeItem(null);
      fetchResults();
    } catch (err: any) {
      setDisputeError(err.response?.data?.message || 'Failed to dispute result.');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <AdminLayout>
      <Header
        title="Result review queue"
        subtitle="Verify match scoreboard proofs, approve stats and resolve disputes"
        actions={
          <button
            onClick={fetchResults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surface hover:bg-surfaceMuted rounded-full border border-hairline border-border transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh queue</span>
          </button>
        }
      />

      <div className="space-y-6 mt-6">
        {/* Running Counter Chips */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border border-hairline ${
              statusFilter === 'all'
                ? 'bg-primary text-slate-950 border-primary font-bold shadow-xs'
                : 'bg-surface text-textSecondary border-border hover:bg-surfaceMuted hover:text-textPrimary'
            }`}
          >
            All submissions ({counts.total})
          </button>
          <button
            onClick={() => setStatusFilter('pending_review')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border border-hairline ${
              statusFilter === 'pending_review'
                ? 'bg-status-warning text-slate-950 border-status-warning font-bold shadow-xs'
                : 'bg-status-warningBg text-status-warning border-status-warningBorder hover:bg-status-warning/20'
            }`}
          >
            Pending review ({counts.pending})
          </button>
          <button
            onClick={() => setStatusFilter('verified')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border border-hairline ${
              statusFilter === 'verified'
                ? 'bg-status-success text-slate-950 border-status-success font-bold shadow-xs'
                : 'bg-status-successBg text-status-success border-status-successBorder hover:bg-status-success/20'
            }`}
          >
            Verified ({counts.verified})
          </button>
          <button
            onClick={() => setStatusFilter('disputed')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border border-hairline ${
              statusFilter === 'disputed'
                ? 'bg-status-danger text-white border-status-danger font-bold shadow-xs'
                : 'bg-status-dangerBg text-status-danger border-status-dangerBorder hover:bg-status-danger/20'
            }`}
          >
            Disputed ({counts.disputed})
          </button>
        </div>

        {/* Results Queue Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceMuted border-b border-hairline border-border text-textSecondary font-semibold">
                <tr>
                  <th className="px-5 py-3">Tournament</th>
                  <th className="px-4 py-3">Slot / Player</th>
                  <th className="px-4 py-3">Free Fire ID</th>
                  <th className="px-4 py-3">Claimed rank & kills</th>
                  <th className="px-4 py-3">Proof screenshot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-border">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-textSecondary">
                      No result claims matching the current filter.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.id} className="hover:bg-surfaceMuted/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-textPrimary max-w-[180px] truncate">
                        {r.tournament_title}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-textPrimary">
                          Slot #{r.slot_number} • {r.player_name || r.player_ff_ign}
                        </div>
                        <div className="text-[11px] text-textSecondary font-medium">{r.user_phone || r.user_email}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-primary font-medium">
                        {r.player_ff_uid} ({r.player_ff_ign})
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-highlight">Rank #{r.claimed_rank}</span>
                          <span className="text-textSecondary">•</span>
                          <span className="font-semibold text-textPrimary">{r.claimed_kills} kills</span>
                        </div>
                        {r.admin_confirmed_rank && (
                          <span className="text-[10px] text-status-success font-medium">
                            Confirmed: #{r.admin_confirmed_rank} ({r.admin_confirmed_kills} kills)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.screenshot_url === '[DELETED_AFTER_APPROVAL]' || !r.screenshot_url ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-success bg-status-successBg px-2 py-0.5 rounded border border-status-successBorder">
                            <CheckCircle2 className="w-3 h-3 text-status-success" />
                            <span>Purged on approval</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => setPreviewImage(r.screenshot_url)}
                            className="flex items-center gap-1 text-textSecondary hover:text-textPrimary px-2.5 py-1 bg-surfaceMuted hover:bg-surface rounded border border-hairline border-border transition-colors text-[11px] font-semibold"
                          >
                            <ImageIcon className="w-3 h-3 text-primary" />
                            <span>View proof</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <PillBadge
                          label={r.status === 'verified' ? 'Verified' : r.status}
                          variant={
                            r.status === 'verified'
                              ? 'success'
                              : r.status === 'disputed'
                              ? 'warning'
                              : r.status === 'rejected'
                              ? 'danger'
                              : 'neutral'
                          }
                          size="sm"
                        />
                        {r.rejection_reason && (
                          <p className="text-[10px] text-status-danger mt-1 max-w-[140px] truncate font-medium" title={r.rejection_reason}>
                            {r.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Approve Button */}
                          <button
                            onClick={() => handleOpenVerifyModal(r)}
                            title="Approve & verify result"
                            className="px-2.5 py-1 bg-status-successBg hover:bg-status-success/25 text-status-success rounded-full border border-hairline border-status-successBorder text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            <span>Verify</span>
                          </button>

                          {/* Dispute Button */}
                          <button
                            onClick={() => handleOpenDisputeModal(r)}
                            title="Dispute claim with reason"
                            className="px-2.5 py-1 bg-status-dangerBg hover:bg-status-danger/25 text-status-danger rounded-full border border-hairline border-status-dangerBorder text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Dispute</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Proof Screenshot Viewer Modal */}
      <Modal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title="Scoreboard screenshot proof"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden border border-hairline border-border bg-slate-950 flex items-center justify-center max-h-[65vh]">
            {previewImage && (
              <img
                src={previewImage.startsWith('http') ? previewImage : `https://fla-esports-api.onrender.com${previewImage}`}
                alt="Match proof"
                className="max-h-[60vh] max-w-full object-contain"
              />
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-textSecondary font-medium">
            <span>Inspect Free Fire scoreboard, player UID, rank & kill counter.</span>
            {previewImage && (
              <a
                href={previewImage.startsWith('http') ? previewImage : `https://fla-esports-api.onrender.com${previewImage}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary font-bold hover:underline"
              >
                <span>Open original</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </Modal>

      {/* Verify / Approve Result Modal */}
      <Modal
        isOpen={!!verifyItem}
        onClose={() => setVerifyItem(null)}
        title={`Verify result: Slot #${verifyItem?.slot_number} (${verifyItem?.player_ff_ign})`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmVerify} className="space-y-4">
          <p className="text-xs text-textSecondary font-medium">
            Confirm the final rank and kill count for this player. Marking verified locks in their prize calculation.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Confirmed Rank # <span className="text-status-danger">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={editRank}
                onChange={(e) => setEditRank(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-highlight focus:outline-none focus:border-primary font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Confirmed Kills <span className="text-status-danger">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={editKills}
                onChange={(e) => setEditKills(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setVerifyItem(null)}
              className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary rounded-full border border-hairline border-border hover:bg-surfaceMuted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingVerify}
              className="px-5 py-2 text-xs font-bold bg-status-success hover:bg-status-success/90 text-slate-950 rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isSubmittingVerify ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Confirm & verify</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispute Modal */}
      <Modal
        isOpen={!!disputeItem}
        onClose={() => setDisputeItem(null)}
        title={`Dispute result: ${disputeItem?.player_ff_ign || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmDispute} className="space-y-4">
          <p className="text-xs text-textSecondary font-medium">
            A reason note is strictly required before saving a dispute. The player will see this note on their match status screen.
          </p>

          {disputeError && (
            <div className="p-3 rounded-lg bg-status-dangerBg border border-hairline border-status-dangerBorder flex items-start gap-2 text-xs text-status-danger">
              <AlertCircle className="w-4 h-4 shrink-0 text-status-danger mt-0.5" />
              <span>{disputeError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1">
              Dispute reason note <span className="text-status-danger">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Screenshot timestamp mismatch, player IGN does not match lobby UID, or blurry score screen."
              className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setDisputeItem(null)}
              className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary rounded-full border border-hairline border-border hover:bg-surfaceMuted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingDispute || !disputeReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-status-danger hover:bg-status-danger/90 disabled:opacity-50 text-white rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isSubmittingDispute ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>Save dispute</span>
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
