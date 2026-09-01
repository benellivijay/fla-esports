'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  Wallet,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  User,
  ShieldCheck,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { WalletTransaction } from '@/types';

export default function WalletAdjustmentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    user: any;
    balance: number;
    transactions: WalletTransaction[];
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Adjustment Form Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(100);
  const [adjustType, setAdjustType] = useState<'refund' | 'deposit' | 'entry_fee_debit'>('refund');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      // Search user by query first
      const usersRes = await AdminApi.getUsers({ search: searchQuery.trim(), limit: 1 });
      if (usersRes.data?.data?.users && usersRes.data.data.users.length > 0) {
        const foundUser = usersRes.data.data.users[0];
        // Fetch full ledger
        const ledgerRes = await AdminApi.getUserLedger(foundUser.id);
        if (ledgerRes.data?.data) {
          setSearchResult(ledgerRes.data.data);
        }
      } else {
        setSearchError(`No user found matching "${searchQuery}".`);
      }
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Failed to search user ledger.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchResult?.user?.id) return;
    if (!adjustReason.trim()) {
      setAdjustError('A reason note is mandatory for all manual wallet adjustments.');
      return;
    }

    setIsSubmittingAdjust(true);
    setAdjustError(null);
    setAdjustSuccess(null);

    try {
      const res = await AdminApi.adjustWallet({
        targetUserId: searchResult.user.id,
        amount: Number(adjustAmount),
        type: adjustType,
        reason: adjustReason.trim(),
      });

      if (res.data?.success) {
        setAdjustSuccess(`Successfully adjusted wallet. New balance: ₹${res.data.data.newBalance.toFixed(2)}`);
        // Refresh ledger
        const refreshed = await AdminApi.getUserLedger(searchResult.user.id);
        if (refreshed.data?.data) {
          setSearchResult(refreshed.data.data);
        }
        setAdjustReason('');
        setTimeout(() => {
          setIsAdjustModalOpen(false);
          setAdjustSuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      setAdjustError(err.response?.data?.message || 'Failed to process wallet adjustment.');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  return (
    <AdminLayout>
      <Header
        title="Wallet ledger & manual adjustments"
        subtitle="Inspect user transaction statements and execute audited balance corrections"
      />

      <div className="space-y-6 mt-6 max-w-5xl">
        {/* Search Bar */}
        <Card padding="md">
          <form onSubmit={handleSearchUser} className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Search player by Phone number, Email, Free Fire UID, or User ID
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. 9842235510, player@example.com, or FF_94821"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded-full transition-colors flex items-center gap-1.5"
              >
                {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Search ledger</span>
              </button>
            </div>
          </form>
        </Card>

        {searchError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-hairline border-rose-200 flex items-start gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{searchError}</span>
          </div>
        )}

        {/* User Profile & Balance Card */}
        {searchResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card padding="md" className="sm:col-span-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {searchResult.user.display_name || 'Player'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {searchResult.user.phone || 'No phone'} • {searchResult.user.email || 'No email'}
                    </p>
                    {searchResult.user.ff_uid && (
                      <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                        FF: {searchResult.user.ff_uid} ({searchResult.user.ff_ign})
                      </p>
                    )}
                  </div>
                </div>

                <PillBadge
                  label={searchResult.user.status || 'Active'}
                  variant={searchResult.user.status === 'active' ? 'success' : 'danger'}
                />
              </Card>

              <Card padding="md" className="flex flex-col justify-between">
                <span className="text-xs font-medium text-slate-500">Current wallet balance</span>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-2xl font-bold text-slate-900">
                    ₹{searchResult.balance.toFixed(2)}
                  </div>
                  <button
                    onClick={() => {
                      setAdjustError(null);
                      setAdjustSuccess(null);
                      setIsAdjustModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-full transition-colors flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Adjust</span>
                  </button>
                </div>
              </Card>
            </div>

            {/* Passbook Transaction Statement Table */}
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-hairline border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Complete ledger statement ({searchResult.transactions.length} entries)
                </h3>
                <span className="text-xs text-slate-400">Chronological passbook</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-hairline border-slate-200 text-slate-500 font-medium">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Reference ID</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline divide-slate-100">
                    {searchResult.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                          No transactions found on this ledger.
                        </td>
                      </tr>
                    ) : (
                      searchResult.transactions.map((t) => {
                        const isCredit = ['deposit', 'prize_credit', 'refund'].includes(t.type);
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">
                              {new Date(t.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <PillBadge
                                label={t.type.replace(/_/g, ' ')}
                                variant={isCredit ? 'success' : 'neutral'}
                                size="sm"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-[280px]">
                              {t.description || 'Ledger entry'}
                            </td>
                            <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                              {t.reference_id || '—'}
                            </td>
                            <td
                              className={`px-5 py-3 text-right font-bold text-xs ${
                                isCredit ? 'text-emerald-600' : 'text-slate-900'
                              }`}
                            >
                              {isCredit ? '+' : '-'}₹{t.amount.toFixed(2)}
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
        )}
      </div>

      {/* Manual Wallet Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Manual wallet adjustment: ${searchResult?.user?.display_name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleExecuteAdjustment} className="space-y-4">
          <p className="text-xs text-slate-500">
            Every manual adjustment writes an immediate ledger entry and creates an immutable staff audit log. A documented reason note is strictly required.
          </p>

          {adjustError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-hairline border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{adjustError}</span>
            </div>
          )}

          {adjustSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-hairline border-emerald-200 flex items-start gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{adjustSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adjustment Type
              </label>
              <select
                value={adjustType}
                onChange={(e: any) => setAdjustType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 font-medium"
              >
                <option value="refund">Refund (Credit +)</option>
                <option value="deposit">Manual Deposit (Credit +)</option>
                <option value="entry_fee_debit">Manual Debit (Debit -)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mandatory Reason Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. Compensation for tournament server crash, or payment dispute reconciliation."
              className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 rounded-full border border-hairline border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAdjust || !adjustReason.trim()}
              className="px-5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-full transition-colors flex items-center gap-1.5"
            >
              {isSubmittingAdjust ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
              <span>Execute adjustment</span>
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
