'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Filter,
  KeyRound,
  Eye,
  XCircle,
  Trash2,
  RefreshCw,
  Clock,
  Trophy,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { TournamentItem } from '@/types';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Room Credential Edit Modal State
  const [selectedTourney, setSelectedTourney] = useState<TournamentItem | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isSavingRoom, setIsSavingRoom] = useState(false);

  const fetchTournaments = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getTournaments({
        mode: filterMode !== 'all' ? filterMode : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: searchQuery || undefined,
      });
      if (res.data?.tournaments) {
        setTournaments(res.data.tournaments);
      }
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
    const interval = setInterval(() => {
      fetchTournaments();
    }, 5000);
    return () => clearInterval(interval);
  }, [filterMode, filterStatus]);

  const handleOpenRoomModal = (t: TournamentItem) => {
    setSelectedTourney(t);
    setRoomIdInput(t.room_id || '');
    setRoomPasswordInput(t.room_password || '');
    setForceUpdate(false);
    setModalError(null);
    setModalSuccess(null);
    setIsRoomModalOpen(true);
  };

  const handleSaveRoomCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTourney) return;
    setIsSavingRoom(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const res = await AdminApi.updateRoomCredentials(selectedTourney.id, {
        roomId: roomIdInput.trim(),
        roomPassword: roomPasswordInput.trim() || undefined,
        forceUpdateAfterStart: forceUpdate,
      });

      if (res.data?.success) {
        setModalSuccess('Room credentials saved successfully.');
        fetchTournaments();
        setTimeout(() => setIsRoomModalOpen(false), 1200);
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to update room credentials.');
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleManualReveal = async (t: TournamentItem) => {
    if (!confirm(`Are you sure you want to broadcast room credentials for "${t.title}" to players now?`)) {
      return;
    }

    try {
      await AdminApi.revealRoom(t.id);
      alert('Room credentials unlocked and push notifications broadcasted!');
      fetchTournaments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reveal room credentials.');
    }
  };

  const handleCancelTournament = async (t: TournamentItem) => {
    const reason = prompt(`Enter cancellation reason for "${t.title}" (all player entry fees will be refunded):`);
    if (reason === null) return;

    try {
      await AdminApi.cancelTournament(t.id, reason);
      alert('Tournament cancelled and entries refunded to player wallets.');
      fetchTournaments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel tournament.');
    }
  };

  const handleDeleteTournament = async (t: TournamentItem) => {
    if (!confirm(`Are you sure you want to permanently DELETE tournament "${t.title}"?\n\nThis will remove the match, lobby, and all associated participant records.`)) {
      return;
    }

    try {
      await AdminApi.deleteTournament(t.id);
      fetchTournaments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete tournament.');
    }
  };

  return (
    <AdminLayout>
      <Header
        title="Tournament management"
        subtitle="Configure matches, enter room IDs & manage lobby lifecycles"
        actions={
          <Link
            href="/tournaments/create"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-slate-950 text-xs font-bold rounded-full transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create tournament</span>
          </Link>
        }
      />

      <div className="space-y-6 mt-6">
        {/* Filter & Search Bar */}
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTournaments()}
                placeholder="Search tournament title..."
                className="pl-8 pr-3 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/60 focus:outline-none focus:border-primary w-56"
              />
            </div>

            {/* Mode Filter */}
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
            >
              <option value="all">All modes</option>
              <option value="solo">Solo</option>
              <option value="duo">Duo</option>
              <option value="squad">Squad</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            onClick={fetchTournaments}
            className="px-3 py-1.5 text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surfaceMuted rounded-lg border border-hairline border-border flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </Card>

        {/* Tournaments Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceMuted border-b border-hairline border-border text-textSecondary font-semibold">
                <tr>
                  <th className="px-5 py-3">Tournament title</th>
                  <th className="px-4 py-3">Mode & Map</th>
                  <th className="px-4 py-3">Fee / Prize pool</th>
                  <th className="px-4 py-3">Slots filled</th>
                  <th className="px-4 py-3">Start time</th>
                  <th className="px-4 py-3">Room credentials</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-border">
                {tournaments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-textSecondary">
                      No tournaments found matching the filters.
                    </td>
                  </tr>
                ) : (
                  tournaments.map((t) => (
                    <tr key={t.id} className="hover:bg-surfaceMuted/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-textPrimary max-w-[200px] truncate">
                        {t.title}
                      </td>
                      <td className="px-4 py-3.5 text-textSecondary capitalize font-medium">
                        {t.mode} • {t.map}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-highlight">₹{t.prize_pool}</span>
                        <span className="text-textSecondary ml-1 font-medium">
                          ({t.entry_type === 'paid' ? `₹${t.entry_fee}` : 'Free'})
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-textSecondary font-medium">
                        {t.filled_slots} / {t.max_slots}
                      </td>
                      <td className="px-4 py-3.5 text-textSecondary">
                        {new Date(t.start_time).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        {t.room_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-surfaceMuted rounded text-primary border border-hairline border-border">
                              {t.room_id}
                            </span>
                            {t.room_revealed === 1 ? (
                              <span className="text-[10px] text-status-success font-sans font-semibold">Revealed</span>
                            ) : (
                              <span className="text-[10px] text-status-warning font-sans font-semibold">Hidden</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-textSecondary/60 italic font-sans">Not set yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
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
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Room Credentials Button */}
                          <button
                            onClick={() => handleOpenRoomModal(t)}
                            title="Set / update Room ID & Password"
                            className="p-1.5 text-textSecondary hover:text-textPrimary bg-surfaceMuted hover:bg-surface rounded-lg border border-hairline border-border transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Reveal Room Early Button */}
                          {t.room_id && t.room_revealed === 0 && t.status !== 'cancelled' && (
                            <button
                              onClick={() => handleManualReveal(t)}
                              title="Broadcast room details to players now"
                              className="p-1.5 text-status-success hover:text-status-success bg-status-success/15 hover:bg-status-success/25 rounded-lg border border-hairline border-status-success/30 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancel Tournament Button */}
                          {t.status === 'upcoming' && (
                            <button
                              onClick={() => handleCancelTournament(t)}
                              title="Cancel tournament and refund players"
                              className="p-1.5 text-status-warning hover:text-status-warning bg-status-warning/15 hover:bg-status-warning/25 rounded-lg border border-hairline border-status-warning/30 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Tournament Button */}
                          <button
                            onClick={() => handleDeleteTournament(t)}
                            title="Permanently delete tournament"
                            className="p-1.5 text-status-danger hover:text-white bg-status-danger/15 hover:bg-status-danger rounded-lg border border-status-danger/30 transition-all flex items-center justify-center shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Room ID / Password Edit Modal */}
      <Modal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        title={`Room credentials: ${selectedTourney?.title || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveRoomCredentials} className="space-y-4">
          <p className="text-xs text-textSecondary font-medium">
            Admins can set or update custom room credentials anytime before match start. Updates overwrite existing values and are logged in audit history.
          </p>

          {modalError && (
            <div className="p-3 rounded-lg bg-status-dangerBg border border-hairline border-status-dangerBorder flex items-start gap-2 text-xs text-status-danger">
              <AlertCircle className="w-4 h-4 shrink-0 text-status-danger mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}

          {modalSuccess && (
            <div className="p-3 rounded-lg bg-status-successBg border border-hairline border-status-successBorder flex items-start gap-2 text-xs text-status-success">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-status-success mt-0.5" />
              <span>{modalSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1">
              Custom Free Fire Room ID <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              placeholder="e.g. FF_ROOM_84821"
              className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1">
              Room Password (Optional)
            </label>
            <input
              type="text"
              value={roomPasswordInput}
              onChange={(e) => setRoomPasswordInput(e.target.value)}
              placeholder="e.g. 9482"
              className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {selectedTourney?.status === 'ongoing' && (
            <div className="p-3 bg-status-warningBg rounded-lg border border-hairline border-status-warningBorder">
              <label className="flex items-start gap-2 text-xs text-status-warning cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceUpdate}
                  onChange={(e) => setForceUpdate(e.target.checked)}
                  className="mt-0.5 rounded border-status-warningBorder"
                />
                <span>
                  <strong>Force update mid-match:</strong> Match has already started. Check this box if you are recreating an emergency lobby.
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                if (selectedTourney) {
                  setIsRoomModalOpen(false);
                  handleDeleteTournament(selectedTourney);
                }
              }}
              className="px-3 py-1.5 text-xs text-status-danger hover:text-white hover:bg-status-danger rounded-lg border border-status-danger/30 transition-colors flex items-center gap-1.5 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete match</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary rounded-full border border-hairline border-border hover:bg-surfaceMuted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRoom || !roomIdInput.trim()}
                className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isSavingRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save credentials</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
