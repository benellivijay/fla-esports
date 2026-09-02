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
  const [startTime, setStartTime] = useState<string>(
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
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
        maxSlots: Number(maxSlots),
        startTime: new Date(startTime).toISOString(),
        roomRevealTimeMinutes: Number(roomRevealTimeMinutes),
        roomId: roomId.trim() || undefined,
        roomPassword: roomPassword.trim() || undefined,
        rules: rules.trim() || undefined,
      };

      const res = await AdminApi.createTournament(payload);
      if (res.data?.success) {
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-full border border-hairline border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to list</span>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6 mt-6 pb-12">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-hairline border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Basic Tournament Parameters */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            1. Basic match parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tournament Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Free Fire Squad Champions Cup #48"
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Battle Game Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Team Format <span className="text-rose-500">*</span>
              </label>
              <select
                value={mode}
                onChange={(e: any) => setMode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="solo">Solo (1 vs All)</option>
                <option value="duo">Duo (2 per team)</option>
                <option value="squad">Squad (4 per team)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Map <span className="text-rose-500">*</span>
              </label>
              <select
                value={map}
                onChange={(e: any) => setMap(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="Bermuda">Bermuda</option>
                <option value="Purgatory">Purgatory</option>
                <option value="Kalahari">Kalahari</option>
                <option value="Alpine">Alpine</option>
                <option value="NexTerra">NexTerra</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Max Slots <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={2}
                max={100}
                required
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Start Time (Local) <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </Card>

        {/* 2. Economics & Prize Matrix */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            2. Entry fee & prize matrix
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entry Type</label>
              <select
                value={entryType}
                onChange={(e: any) => setEntryType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="paid">Paid Entry (? INR)</option>
                <option value="free">Free Entry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Entry Fee (?)
              </label>
              <input
                type="number"
                min={0}
                disabled={entryType === 'free'}
                value={entryType === 'free' ? 0 : entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total Prize Pool (?) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={prizePool}
                onChange={(e) => setPrizePool(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 font-semibold"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Per-Kill Bounty Rate (? per kill)
              </label>
              <input
                type="number"
                min={0}
                value={perKillPrize}
                onChange={(e) => setPerKillPrize(Number(e.target.value))}
                placeholder="0"
                className="w-full sm:w-1/3 px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {/* Rank Placement Breakdown Table */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700">
                Rank Placement Breakdown Matrix
              </label>
              <button
                type="button"
                onClick={addDistributionRow}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-hairline border-slate-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Rank Tier</span>
              </button>
            </div>

            <div className="space-y-2">
              {distribution.map((d, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-10">Rank #{d.rank}</span>
                    <input
                      type="number"
                      min={0}
                      value={d.amount}
                      onChange={(e) => updateDistributionRow(index, 'amount', Number(e.target.value))}
                      className="w-32 px-3 py-1.5 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                      placeholder="? Amount"
                    />
                  </div>
                  {distribution.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDistributionRow(index)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
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
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              3. In-game custom room credentials (Optional)
            </h2>
            <span className="text-[11px] text-slate-500">Can be set later before start</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Room Reveal Window
              </label>
              <select
                value={roomRevealTimeMinutes}
                onChange={(e) => setRoomRevealTimeMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value={10}>10 Minutes before start</option>
                <option value={15}>15 Minutes before start (Default)</option>
                <option value={20}>20 Minutes before start</option>
                <option value={30}>30 Minutes before start</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Early Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. 8839201"
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Early Room Password
              </label>
              <input
                type="text"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="e.g. 1234"
                className="w-full px-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/tournaments"
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-hairline border-slate-200 rounded-lg"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
