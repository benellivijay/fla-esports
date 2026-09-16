'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Trophy,
  KeyRound,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';

export default function CreateTournamentPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState<string>('survival');
  const [mode, setMode] = useState<'solo' | 'duo' | 'squad'>('squad');
  const [map, setMap] = useState<'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NexTerra'>('Bermuda');
  const [entryType, setEntryType] = useState<'free' | 'paid'>('paid');
  const [entryFee, setEntryFee] = useState<number>(50);
  const [prizePool, setPrizePool] = useState<number>(2000);
  const [perKillPrize, setPerKillPrize] = useState<number>(25);
  const [maxSlots, setMaxSlots] = useState<number>(48);
  const [startTime, setStartTime] = useState<string>(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [roomRevealTimeMinutes, setRoomRevealTimeMinutes] = useState<number>(15);
  const [roomId, setRoomId] = useState<string>('');
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [rules, setRules] = useState<string>('Standard Battle Royale rules. Emulators strictly forbidden.');

  // Placement Prize Distribution Table Builder
  const [distribution, setDistribution] = useState<Array<{ rank: number; amount: number }>>([
    { rank: 1, amount: 1000 },
    { rank: 2, amount: 500 },
    { rank: 3, amount: 250 },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDistributionRow = () => {
    const nextRank = distribution.length + 1;
    setDistribution([...distribution, { rank: nextRank, amount: 100 }]);
  };

  const removeDistributionRow = (index: number) => {
    const updated = distribution.filter((_, i) => i !== index);
    setDistribution(updated);
  };

  const updateDistributionRow = (index: number, field: 'rank' | 'amount', val: number) => {
    const updated = [...distribution];
    updated[index][field] = val;
    setDistribution(updated);
  };

  const handleModeChange = (newMode: 'solo' | 'duo' | 'squad') => {
    setMode(newMode);
    // Standard Free Fire matches are 48 players (12 squads or 24 duos or 48 solo)
    if (newMode === 'squad') setMaxSlots(48);
    else if (newMode === 'duo') setMaxSlots(48);
    else setMaxSlots(48);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let finalSlots = Number(maxSlots);
      if (mode === 'squad' && finalSlots <= 12) {
        finalSlots = finalSlots * 4;
      } else if (mode === 'duo' && finalSlots <= 24) {
        finalSlots = finalSlots * 2;
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        game: 'Free Fire',
        game_mode: gameMode,
        mode,
        map,
        entryType,
        entryFee: entryType === 'paid' ? Number(entryFee) : 0,
        prizePool: Number(prizePool),
        perKillPrize: Number(perKillPrize),
        prizeDistribution: distribution.map((d) => ({ rank: d.rank, amount: d.amount })),
        maxSlots: finalSlots,
        startTime: new Date(startTime).toISOString(),
        roomRevealTimeMinutes: Number(roomRevealTimeMinutes),
        roomId: roomId.trim() || undefined,
        roomPassword: roomPassword.trim() || undefined,
        rules: rules.trim() || undefined,
      };

      const res = await AdminApi.createTournament(payload);
      if (res.data?.success) {
        router.refresh();
        router.push('/tournaments');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create tournament.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <Header
        title="Create new tournament"
        subtitle="Set match rules, slot configuration, and prize pool"
        actions={
          <Link
            href="/tournaments"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surfaceMuted text-textSecondary hover:text-textPrimary text-xs font-semibold rounded-full border border-hairline border-border transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to list</span>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6 mt-6 pb-12">
        {error && (
          <div className="p-3 rounded-lg bg-status-dangerBg border border-hairline border-status-dangerBorder flex items-start gap-2.5 text-xs text-status-danger">
            <AlertCircle className="w-4 h-4 shrink-0 text-status-danger mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Basic Tournament Parameters */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
            1. Basic match parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Tournament Title <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Free Fire Squad Champions Cup #48"
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Battle Game Mode <span className="text-status-danger">*</span>
              </label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              >
                <option value="ff_max">FF Max</option>
                <option value="survival">Survival (Battle Royale)</option>
                <option value="free_match">Free match</option>
                <option value="lone_wolf">Lone wolf</option>
                <option value="headshot_only">Headshot only</option>
                <option value="one_tap">One tap</option>
                <option value="sniper_1v1">Sniper 1v1</option>
                <option value="lone_wolf_headshot">Lone wolf headshot</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Team Format <span className="text-status-danger">*</span>
              </label>
              <select
                value={mode}
                onChange={(e: any) => handleModeChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              >
                <option value="solo">Solo (1 vs All - 48 Slots)</option>
                <option value="duo">Duo (2 per team - 48 Slots / 24 Teams)</option>
                <option value="squad">Squad (4 per team - 48 Slots / 12 Teams)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Map <span className="text-status-danger">*</span>
              </label>
              <select
                value={map}
                onChange={(e: any) => setMap(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              >
                <option value="Bermuda">Bermuda</option>
                <option value="Purgatory">Purgatory</option>
                <option value="Kalahari">Kalahari</option>
                <option value="Alpine">Alpine</option>
                <option value="NexTerra">NexTerra</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Max Player Slots <span className="text-status-danger">*</span>
              </label>
              <input
                type="number"
                min={2}
                max={100}
                required
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-textSecondary mt-1 block">
                {mode === 'squad'
                  ? 'Total player slots (12 teams = 48 player slots)'
                  : mode === 'duo'
                  ? 'Total player slots (24 teams = 48 player slots)'
                  : 'Total solo player slots (48 player slots)'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Start Time (Local) <span className="text-status-danger">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </Card>

        {/* 2. Economics & Prize Matrix */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
            2. Entry fee & prize matrix
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">Entry Type</label>
              <select
                value={entryType}
                onChange={(e: any) => setEntryType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              >
                <option value="paid">Paid Entry (₹ INR)</option>
                <option value="free">Free Entry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Entry Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                disabled={entryType === 'free'}
                value={entryType === 'free' ? 0 : entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary disabled:opacity-40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Total Prize Pool (₹) <span className="text-status-danger">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={prizePool}
                onChange={(e) => setPrizePool(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-highlight focus:outline-none focus:border-primary font-bold"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Per-Kill Bounty Rate (₹ per kill)
              </label>
              <input
                type="number"
                min={0}
                value={perKillPrize}
                onChange={(e) => setPerKillPrize(Number(e.target.value))}
                placeholder="0"
                className="w-full sm:w-1/3 px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Rank Placement Breakdown Table */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-textSecondary">
                Rank Placement Breakdown Matrix
              </label>
              <button
                type="button"
                onClick={addDistributionRow}
                className="px-2.5 py-1 text-[11px] font-semibold bg-surfaceMuted hover:bg-surface text-textPrimary rounded-lg border border-hairline border-border flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-primary" />
                <span>Add Rank Tier</span>
              </button>
            </div>

            <div className="space-y-2">
              {distribution.map((d, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-textSecondary w-16 font-medium">Rank #{d.rank}</span>
                    <input
                      type="number"
                      min={0}
                      value={d.amount}
                      onChange={(e) => updateDistributionRow(index, 'amount', Number(e.target.value))}
                      className="w-32 px-3 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-highlight font-bold focus:outline-none focus:border-primary"
                      placeholder="₹ Amount"
                    />
                  </div>
                  {distribution.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDistributionRow(index)}
                      className="p-1 text-textSecondary hover:text-status-danger rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 3. In-Game Custom Room Early Settings */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
              3. In-game custom room credentials (Optional)
            </h2>
            <span className="text-[11px] text-textSecondary font-medium">Can be set later before start</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Room Reveal Window
              </label>
              <select
                value={roomRevealTimeMinutes}
                onChange={(e) => setRoomRevealTimeMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary"
              >
                <option value={10}>10 Minutes before start</option>
                <option value={15}>15 Minutes before start (Default)</option>
                <option value={20}>20 Minutes before start</option>
                <option value={30}>30 Minutes before start</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Early Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. 8839201"
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Early Room Password
              </label>
              <input
                type="text"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="e.g. 1234"
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/tournaments"
            className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surface border border-hairline border-border rounded-lg hover:bg-surfaceMuted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Publish Tournament</span>
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
