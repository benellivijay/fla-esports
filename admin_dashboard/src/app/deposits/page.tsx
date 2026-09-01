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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '') : 'http://localhost:4000';

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="p-8 max-w-7xl space-y-6">
        {/* Banner Alerts */}
        {actionSuccess && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-hairline border-emerald-200 text-emerald-800 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 border border-hairline border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-hairline border-slate-200">
            {(
              [
                { key: 'pending', label: 'Pending', count: statusFilter === 'pending' ? pendingCount : undefined },
                { key: 'completed', label: 'Approved' },
                { key: 'failed', label: 'Rejected' },
                { key: 'all', label: 'All records' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-none border border-hairline border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[280px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search UTR, phone, name or FF UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-hairline border-slate-200 bg-white focus:outline-none focus:border-slate-400 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Deposit List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredDeposits.length === 0 ? (
          <Card className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No deposit requests found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                <Card key={item.id} className="p-4 hover:border-slate-300 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Amount & UTR & Player Info */}
                    <div className="flex items-start gap-4">
                      {/* Amount Chip */}
                      <div className="flex flex-col items-center justify-center w-20 h-16 rounded-xl bg-slate-50 border border-hairline border-slate-200 flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Amount</span>
                        <span className="text-lg font-bold text-slate-900">₹{Number(item.amount).toFixed(0)}</span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-900">
                            {item.user_name || item.user_phone || 'Player'}
                          </span>
                          {item.user_phone && (
                            <span className="text-xs text-slate-500 font-mono">({item.user_phone})</span>
                          )}
                          {item.player_ff_uid && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                              FF UID: {item.player_ff_uid}
                            </span>
                          )}

                          {/* Status Badge */}
                          {isPending && (
                            <PillBadge variant="warning" icon={<Clock className="w-3 h-3" />}>
                              Pending Verification
                            </PillBadge>
                          )}
                          {isApproved && (
                            <PillBadge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
                              Approved & Credited
                            </PillBadge>
                          )}
                          {isRejected && (
                            <PillBadge variant="danger" icon={<XCircle className="w-3 h-3" />}>
                              Rejected
                            </PillBadge>
                          )}
                        </div>

                        {/* UTR Copy Row */}
                        <div className="flex items-center gap-2 text-xs pt-0.5">
                          <span className="text-slate-500 font-medium">12-Digit UTR:</span>
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-hairline border-slate-200">
                            {item.utr_number || 'N/A'}
                          </span>
                          {item.utr_number && (
                            <button
                              onClick={() => handleCopyUtr(item.utr_number)}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 transition-colors"
                              title="Copy UTR Number"
                            >
                              {copiedUtr === item.utr_number ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 text-[11px]">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Rejection Note if any */}
                        {isRejected && item.rejection_reason && (
                          <p className="text-xs text-rose-600 pt-1">
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <FileImage className="w-3.5 h-3.5 text-indigo-600" />
                          View Screenshot
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No screenshot attached</span>
                      )}

                      {/* Action Buttons (Only for Pending) */}
                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedForReject(item)}
                            className="px-3 py-1.5 rounded-full border border-hairline border-rose-200 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedForApprove(item)}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
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
            <div className="max-h-[500px] overflow-auto rounded-xl border border-hairline border-slate-200 bg-slate-900 flex items-center justify-center p-2">
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
                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open full image in new tab
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
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
            <p className="text-sm text-slate-600">
              Are you sure you want to approve this deposit and credit{' '}
              <strong className="text-slate-900">₹{Number(selectedForApprove.amount).toFixed(2)}</strong> to{' '}
              <strong className="text-slate-900">
                {selectedForApprove.user_name || selectedForApprove.user_phone || 'the player'}
              </strong>
              ?
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-hairline border-slate-200 text-xs space-y-1">
              <div>
                <span className="text-slate-500">12-Digit UTR:</span>{' '}
                <strong className="font-mono text-slate-900">{selectedForApprove.utr_number}</strong>
              </div>
              <div>
                <span className="text-slate-500">Player Phone:</span>{' '}
                <span className="text-slate-800">{selectedForApprove.user_phone || 'N/A'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedForApprove(null)}
                disabled={isApproving}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
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
            <p className="text-sm text-slate-600">
              Reject deposit for UTR <strong className="font-mono text-slate-900">{selectedForReject.utr_number}</strong>.
              The player will be notified with your rejection reason.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection reason note *
              </label>
              <input
                type="text"
                placeholder="e.g. Payment not received in PhonePe / Fake UTR"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-hairline border-slate-200 focus:outline-none focus:border-slate-400 text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedForReject(null)}
                disabled={isRejecting}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRejecting}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 flex items-center gap-1.5"
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
