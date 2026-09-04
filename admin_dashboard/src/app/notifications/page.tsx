'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { AdminApi } from '@/lib/api';
import {
  Bell,
  Send,
  Users,
  Trophy,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Radio,
} from 'lucide-react';

interface SentBroadcastLog {
  id: string;
  title: string;
  body: string;
  targetType: 'all' | 'tournament' | 'user';
  targetDetail?: string;
  sentCount: number;
  sentAt: Date;
}

export default function NotificationsAdminPage() {
  const [targetType, setTargetType] = useState<'all' | 'tournament' | 'user'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [userId, setUserId] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [broadcastLogs, setBroadcastLogs] = useState<SentBroadcastLog[]>([]);

  useEffect(() => {
    // Load tournaments for dropdown
    AdminApi.getTournaments({ limit: 50 })
      .then((res) => {
        if (res.data?.tournaments) {
          setTournaments(res.data.tournaments);
        }
      })
      .catch(() => {});

    // Load active users for dropdown
    AdminApi.getUsers({ limit: 50, status: 'active' })
      .then((res) => {
        if (res.data?.users) {
          setUsersList(res.data.users);
        }
      })
      .catch(() => {});
  }, []);

  const handleApplyPreset = (presetTitle: string, presetBody: string) => {
    setTitle(presetTitle);
    setBody(presetBody);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both Title and Message body.' });
      return;
    }

    if (targetType === 'tournament' && !tournamentId) {
      setStatusMessage({ type: 'error', text: 'Please select a tournament.' });
      return;
    }

    if (targetType === 'user' && !userId) {
      setStatusMessage({ type: 'error', text: 'Please enter or select a User ID.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      let sentCount = 0;
      let targetDetail = 'All Active Players';

      if (targetType === 'all') {
        const res = await AdminApi.broadcastNotification({ title, body });
        sentCount = res.data?.data?.sentCount || 1;
      } else if (targetType === 'tournament') {
        const res = await AdminApi.sendTournamentNotification({ tournamentId, title, body });
        sentCount = res.data?.data?.sentCount || 0;
        const tourney = tournaments.find((t) => t.id === tournamentId);
        targetDetail = tourney ? `Tournament: ${tourney.title}` : `Tournament (${tournamentId.substring(0, 8)})`;
      } else {
        await AdminApi.sendUserNotification({ userId, title, body });
        sentCount = 1;
        const u = usersList.find((usr) => usr.id === userId);
        targetDetail = u ? `User: ${u.display_name || u.phone}` : `User ID: ${userId.substring(0, 8)}`;
      }

      setStatusMessage({
        type: 'success',
        text: `Message successfully delivered to ${sentCount} player(s)!`,
      });

      // Add to broadcast log
      setBroadcastLogs((prev) => [
        {
          id: `${Date.now()}`,
          title,
          body,
          targetType,
          targetDetail,
          sentCount,
          sentAt: new Date(),
        },
        ...prev,
      ]);

      // Reset fields
      setTitle('');
      setBody('');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to dispatch notification. Please verify parameters.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AdminLayout>
      <Header
        title="Player Announcements & Notifications"
        subtitle="Broadcast push notifications and in-app alerts directly to players"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Main Message Composer (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-hairline border-border">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-textPrimary">Compose Broadcast Message</h3>
                <p className="text-xs text-textSecondary">Sends instant in-app alerts & push notifications to players' phones</p>
              </div>
            </div>

            {statusMessage && (
              <div
                className={`mb-5 p-3.5 rounded-lg border flex items-start gap-2.5 text-xs font-medium ${
                  statusMessage.type === 'success'
                    ? 'bg-status-success/10 border-status-success/30 text-status-success'
                    : 'bg-status-danger/10 border-status-danger/30 text-status-danger'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSend} className="space-y-4">
              {/* Target Audience Tabs */}
              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      targetType === 'all'
                        ? 'bg-primary text-slate-950 border-primary shadow-xs'
                        : 'bg-surfaceMuted text-textSecondary border-border hover:text-textPrimary'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>All Players</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('tournament')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      targetType === 'tournament'
                        ? 'bg-primary text-slate-950 border-primary shadow-xs'
                        : 'bg-surfaceMuted text-textSecondary border-border hover:text-textPrimary'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Tournament</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('user')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      targetType === 'user'
                        ? 'bg-primary text-slate-950 border-primary shadow-xs'
                        : 'bg-surfaceMuted text-textSecondary border-border hover:text-textPrimary'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Specific User</span>
                  </button>
                </div>
              </div>

              {/* Tournament Dropdown if tournament selected */}
              {targetType === 'tournament' && (
                <div>
                  <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                    Select Tournament Participants
                  </label>
                  <select
                    value={tournamentId}
                    onChange={(e) => setTournamentId(e.target.value)}
                    className="w-full bg-surfaceMuted border border-border rounded-lg px-3.5 py-2.5 text-xs text-textPrimary focus:outline-hidden focus:border-primary"
                    required
                  >
                    <option value="">-- Choose Tournament --</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.mode.toUpperCase()} - {t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* User Selector if user selected */}
              {targetType === 'user' && (
                <div>
                  <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                    Select Target User or Paste User ID
                  </label>
                  <div className="space-y-2">
                    <select
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full bg-surfaceMuted border border-border rounded-lg px-3.5 py-2.5 text-xs text-textPrimary focus:outline-hidden focus:border-primary"
                    >
                      <option value="">-- Select from active users --</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name || 'Player'} ({u.phone || u.email || u.id.substring(0, 8)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or paste exact User UUID..."
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full bg-surfaceMuted border border-border rounded-lg px-3.5 py-2 text-xs text-textPrimary focus:outline-hidden focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Notification Title */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                  Notification Title (Max 100 chars)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. 🏆 Weekend Mega Championship Is Live!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surfaceMuted border border-border rounded-lg px-3.5 py-2.5 text-xs text-textPrimary font-semibold focus:outline-hidden focus:border-primary"
                  required
                />
              </div>

              {/* Notification Body */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                  Message Body (Max 300 chars)
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Join the ₹10,000 Squad battle today! Custom Room ID will be unlocked 15 mins before match start."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-surfaceMuted border border-border rounded-lg p-3 text-xs text-textPrimary focus:outline-hidden focus:border-primary resize-none"
                  required
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-textSecondary">{body.length}/300</span>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSending || !title.trim() || !body.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                >
                  <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-bounce' : ''}`} />
                  <span>{isSending ? 'Sending broadcast...' : 'Send Message to Players'}</span>
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* Quick Presets & Status (1 col) */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-hairline border-border">
              <Sparkles className="w-4 h-4 text-highlight" />
              <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">Quick Message Templates</h4>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    '🏆 Weekend Mega Tournament Live!',
                    '₹50,000 Free Fire prize pool slots are open now! Register before slots fill up.'
                  )
                }
                className="w-full text-left p-2.5 rounded-lg bg-surfaceMuted hover:bg-surface border border-border transition-colors group"
              >
                <p className="text-xs font-bold text-textPrimary group-hover:text-primary transition-colors">
                  🏆 New Tournament Alert
                </p>
                <p className="text-[11px] text-textSecondary line-clamp-1 mt-0.5">
                  Announce prize pools and invite players to book slots.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    '🔑 Custom Room Info Unlocked!',
                    'Room ID & Password are now live. Please enter Free Fire custom room immediately!'
                  )
                }
                className="w-full text-left p-2.5 rounded-lg bg-surfaceMuted hover:bg-surface border border-border transition-colors group"
              >
                <p className="text-xs font-bold text-textPrimary group-hover:text-primary transition-colors">
                  🔑 Room Reveal Reminder
                </p>
                <p className="text-[11px] text-textSecondary line-clamp-1 mt-0.5">
                  Alert tournament players to enter the custom room.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    '⚡ Fast UPI Withdrawals Active',
                    'Winnings can be withdrawn 24/7 directly to your GooglePay / PhonePe UPI ID!'
                  )
                }
                className="w-full text-left p-2.5 rounded-lg bg-surfaceMuted hover:bg-surface border border-border transition-colors group"
              >
                <p className="text-xs font-bold text-textPrimary group-hover:text-primary transition-colors">
                  ⚡ Wallet & Payout Update
                </p>
                <p className="text-[11px] text-textSecondary line-clamp-1 mt-0.5">
                  Inform players about fast prize settlements.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    '⚠️ Maintenance Scheduled',
                    'Servers will undergo brief maintenance for 15 mins. Ongoing matches are unaffected.'
                  )
                }
                className="w-full text-left p-2.5 rounded-lg bg-surfaceMuted hover:bg-surface border border-border transition-colors group"
              >
                <p className="text-xs font-bold text-textPrimary group-hover:text-primary transition-colors">
                  ⚠️ System Maintenance
                </p>
                <p className="text-[11px] text-textSecondary line-clamp-1 mt-0.5">
                  Notify players of scheduled maintenance.
                </p>
              </button>
            </div>
          </Card>

          <Card className="p-5 bg-surfaceMuted/30">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold text-textPrimary">Delivery Channels</h4>
            </div>
            <p className="text-[11px] text-textSecondary leading-relaxed">
              Dispatched announcements are delivered across 2 synchronized channels:
            </p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-textSecondary">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                <span><strong>In-App Inbox:</strong> Stored permanently with unread count badge.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                <span><strong>Push Notification:</strong> Delivered to player's Android/iOS lock screen.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Broadcast History Table */}
      {broadcastLogs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-3">
            Recently Sent Messages ({broadcastLogs.length})
          </h3>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-hairline border-border bg-surfaceMuted/50 text-textSecondary font-semibold">
                    <th className="p-3">Title & Message</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Sent Time</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {broadcastLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surfaceMuted/30">
                      <td className="p-3">
                        <p className="font-bold text-textPrimary">{log.title}</p>
                        <p className="text-textSecondary text-[11px] line-clamp-1 mt-0.5">{log.body}</p>
                      </td>
                      <td className="p-3 font-medium text-textSecondary">{log.targetDetail}</td>
                      <td className="p-3 font-bold text-textPrimary">{log.sentCount} players</td>
                      <td className="p-3 text-textSecondary">{log.sentAt.toLocaleTimeString()}</td>
                      <td className="p-3">
                        <PillBadge variant="success">Delivered</PillBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
