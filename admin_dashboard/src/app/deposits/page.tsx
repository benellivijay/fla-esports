'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  FileImage,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '') : 'https://fla-esports-api.onrender.com';

export default function DepositQueuePage() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Screenshot Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Approve Confirmation Modal
  const [selectedForApprove, setSelectedForApprove] = useState<any | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Reject Modal
  const [selectedForReject, setSelectedForReject] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Status Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDeposits = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await AdminApi.getDepositQueue({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      if (res.data?.data) {
        setDeposits(res.data.data);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to load deposit requests queue.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDeposits();
    const interval = setInterval(() => {
      fetchDeposits();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDeposits]);

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleApprove = async () => {
    if (!selectedForApprove) return;
    setIsApproving(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await AdminApi.approveDeposit(selectedForApprove.id || selectedForApprove.order_id);
      if (res.data?.success) {
        setActionSuccess(`Deposit of ₹${selectedForApprove.amount} approved and credited to player.`);
        setSelectedForApprove(null);
        fetchDeposits();
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to approve deposit.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForReject) return;
    setIsRejecting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await AdminApi.rejectDeposit(
        selectedForReject.id || selectedForReject.order_id,
        rejectionReason || 'Payment not received in PhonePe / Invalid UTR'
      );
      if (res.data?.success) {
        setActionSuccess(`Deposit request #${selectedForReject.utr_number} rejected.`);
        setSelectedForReject(null);
        setRejectionReason('');
        fetchDeposits();
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to reject deposit.');
    } finally {
      setIsRejecting(false);
    }
  };

  const filteredDeposits = deposits.filter((dep) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (dep.utr_number && dep.utr_number.toLowerCase().includes(q)) ||
      (dep.user_phone && dep.user_phone.toLowerCase().includes(q)) ||
      (dep.user_name && dep.user_name.toLowerCase().includes(q)) ||
      (dep.player_ff_uid && dep.player_ff_uid.toLowerCase().includes(q)) ||
      (dep.order_id && dep.order_id.toLowerCase().includes(q))
    );
  });

  const pendingCount = deposits.filter((d) => d.status === 'pending').length;

  return (
    <AdminLayout>
      <Header
        title="Deposit verification queue"
        subtitle="Review player UPI QR payments, match 12-digit UTR & screenshots against PhonePe, and approve or reject."
        actions={
          <button
            onClick={fetchDeposits}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-hairline border-border text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surface hover:bg-surfaceMuted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Banner Alerts */}
        {actionSuccess && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-status-successBg border border-hairline border-status-successBorder text-status-success text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-status-success flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-status-dangerBg border border-hairline border-status-dangerBorder text-status-danger text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-status-danger flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-surfaceMuted p-1 rounded-xl border border-hairline border-border">
            {[
              { key: 'pending' as const, label: 'Pending', count: pendingCount },
              { key: 'completed' as const, label: 'Approved', count: undefined },
              { key: 'failed' as const, label: 'Rejected', count: undefined },
              { key: 'all' as const, label: 'All records', count: undefined },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? 'bg-primary text-slate-950 shadow-xs'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="w-4 h-4 rounded-full bg-status-warning text-slate-950 text-[10px] flex items-center justify-center font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[280px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              type="text"
              placeholder="Search UTR, phone, name or FF UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-hairline border-border bg-surfaceMuted focus:outline-none focus:border-primary text-textPrimary placeholder:text-textSecondary/60 font-medium"
            />
          </div>
        </div>

        {/* Deposit List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredDeposits.length === 0 ? (
          <Card className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-surfaceMuted flex items-center justify-center mx-auto mb-3 border border-border">
              <QrCode className="w-6 h-6 text-textSecondary" />
            </div>
            <h3 className="text-sm font-bold text-textPrimary">No deposit requests found</h3>
            <p className="text-xs text-textSecondary mt-1 max-w-sm mx-auto font-medium">
              {statusFilter === 'pending'
                ? 'Great job! There are no pending deposits waiting for verification.'
                : 'No deposit records match your current filter criteria.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredDeposits.map((item) => {
              const isPending = item.status === 'pending';
              const isApproved = item.status === 'completed';
              const isRejected = item.status === 'failed';
              const fullScreenshotUrl = item.screenshot_url
                ? item.screenshot_url.startsWith('http')
                  ? item.screenshot_url
                  : `${API_BASE}${item.screenshot_url}`
                : null;

              return (
                <Card key={item.id} className="p-4 hover:border-primary/40 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Amount & UTR & Player Info */}
                    <div className="flex items-start gap-4">
                      {/* Amount Chip */}
                      <div className="flex flex-col items-center justify-center w-20 h-16 rounded-xl bg-surfaceMuted border border-hairline border-border flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold text-textSecondary">Amount</span>
                        <span className="text-lg font-bold text-highlight">₹{Number(item.amount).toFixed(0)}</span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-textPrimary">
                            {item.user_name || item.user_phone || 'Player'}
                          </span>
                          {item.user_phone && (
                            <span className="text-xs text-textSecondary font-mono">({item.user_phone})</span>
                          )}
                          {item.player_ff_uid && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-surfaceMuted text-primary font-mono font-medium border border-hairline border-border">
                              FF UID: {item.player_ff_uid}
                            </span>
                          )}

                          {/* Status Badge */}
                          {isPending && (
                            <PillBadge label="Pending Verification" variant="warning" size="sm" />
                          )}
                          {isApproved && (
                            <PillBadge label="Approved & Credited" variant="success" size="sm" />
                          )}
                          {isRejected && (
                            <PillBadge label="Rejected" variant="danger" size="sm" />
                          )}
                        </div>

                        {/* UTR Copy Row */}
                        <div className="flex items-center gap-2 text-xs pt-0.5">
                          <span className="text-textSecondary font-medium">12-Digit UTR:</span>
                          <span className="font-mono font-bold text-primary bg-surfaceMuted px-2 py-0.5 rounded border border-hairline border-border">
                            {item.utr_number || 'N/A'}
                          </span>
                          {item.utr_number && (
                            <button
                              onClick={() => handleCopyUtr(item.utr_number)}
                              className="p-1 rounded text-textSecondary hover:text-textPrimary transition-colors"
                              title="Copy UTR Number"
                            >
                              {copiedUtr === item.utr_number ? (
                                <Check className="w-3.5 h-3.5 text-status-success" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <span className="text-textSecondary/50">•</span>
                          <span className="text-textSecondary text-[11px]">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Rejection Note if any */}
                        {isRejected && item.rejection_reason && (
                          <p className="text-xs text-status-danger pt-1 font-medium">
                            <strong>Reason:</strong> {item.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Screenshot Preview & Actions */}
                    <div className="flex items-center gap-3 self-end lg:self-center">
                      {/* Screenshot Thumbnail Button */}
                      {fullScreenshotUrl ? (
                        <button
                          onClick={() => setPreviewImage(fullScreenshotUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline border-border text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surfaceMuted hover:bg-surface transition-colors"
                        >
                          <FileImage className="w-3.5 h-3.5 text-primary" />
                          View Screenshot
                        </button>
                      ) : (
                        <span className="text-[11px] text-textSecondary/60 italic font-medium">No screenshot attached</span>
                      )}

                      {/* Action Buttons (Only for Pending) */}
                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedForReject(item)}
                            className="px-3 py-1.5 rounded-full border border-hairline border-status-dangerBorder text-xs font-semibold text-status-danger bg-status-dangerBg hover:bg-status-danger/20 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedForApprove(item)}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-950 bg-status-success hover:bg-status-success/90 transition-colors shadow-xs"
                          >
                            Approve & Credit ₹{Number(item.amount).toFixed(0)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Resolution Screenshot Modal */}
      {previewImage && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewImage(null)}
          title="Payment Screenshot Proof"
        >
          <div className="space-y-4">
            <div className="max-h-[500px] overflow-auto rounded-xl border border-hairline border-border bg-slate-950 flex items-center justify-center p-2">
              <img
                src={previewImage}
                alt="Payment Screenshot"
                className="max-h-[480px] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-between items-center">
              <a
                href={previewImage}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open full image in new tab
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surfaceMuted text-textSecondary hover:text-textPrimary hover:bg-surface border border-border transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Confirmation Modal */}
      {selectedForApprove && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedForApprove(null)}
          title="Confirm Deposit Approval"
        >
          <div className="space-y-4">
            <p className="text-sm text-textSecondary font-medium">
              Are you sure you want to approve this deposit and credit{' '}
              <strong className="text-highlight font-bold">₹{Number(selectedForApprove.amount).toFixed(2)}</strong> to{' '}
              <strong className="text-textPrimary font-bold">
                {selectedForApprove.user_name || selectedForApprove.user_phone || 'the player'}
              </strong>
              ?
            </p>

            <div className="bg-surfaceMuted p-3 rounded-xl border border-hairline border-border text-xs space-y-1.5">
              <div>
                <span className="text-textSecondary font-medium">12-Digit UTR:</span>{' '}
                <strong className="font-mono text-primary font-bold">{selectedForApprove.utr_number}</strong>
              </div>
              <div>
                <span className="text-textSecondary font-medium">Player Phone:</span>{' '}
                <span className="text-textPrimary font-semibold">{selectedForApprove.user_phone || 'N/A'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedForApprove(null)}
                disabled={isApproving}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surface border border-border hover:bg-surfaceMuted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-950 bg-status-success hover:bg-status-success/90 flex items-center gap-1.5 shadow-xs"
              >
                {isApproving && <RefreshCw className="w-3 h-3 animate-spin" />}
                Confirm & Credit Balance
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {selectedForReject && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedForReject(null)}
          title="Reject Deposit Request"
        >
          <form onSubmit={handleReject} className="space-y-4">
            <p className="text-sm text-textSecondary font-medium">
              Reject deposit for UTR <strong className="font-mono text-primary font-bold">{selectedForReject.utr_number}</strong>.
              The player will be notified with your rejection reason.
            </p>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Rejection reason note *
              </label>
              <input
                type="text"
                placeholder="e.g. Payment not received in PhonePe / Fake UTR"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-hairline border-border bg-surfaceMuted focus:outline-none focus:border-primary text-textPrimary font-medium"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedForReject(null)}
                disabled={isRejecting}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surface border border-border hover:bg-surfaceMuted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRejecting}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-status-danger hover:bg-status-danger/90 flex items-center gap-1.5 shadow-xs"
              >
                {isRejecting && <RefreshCw className="w-3 h-3 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
