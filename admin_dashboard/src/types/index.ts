export type UserRole = 'user' | 'moderator' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface AdminUser {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  displayName?: string;
}

export interface DashboardStats {
  pendingResultReviews: number;
  tournamentsLiveToday: number;
  totalPlatformBalance: number;
  disputedResultsCount: number;
  totalUsers: number;
  totalTournaments: number;
  pendingWithdrawalsCount: number;
  totalApkInstalls?: number;
  activeApkUsersToday?: number;
  activeApkUsersWeek?: number;
  platformBreakdown?: { platform: string; count: number }[];
  recentAuditLogs: AuditLogItem[];
}

export interface ApkUsageStats {
  totalApkInstalls: number;
  activeToday: number;
  activeThisWeek: number;
  totalRegisteredUsersWithApk: number;
  platformBreakdown: { platform: string; count: number }[];
  osBreakdown: { osVersion: string; count: number }[];
  recentDevices: ApkDeviceItem[];
}

export interface ApkDeviceItem {
  device_id: string;
  platform: string;
  app_version: string;
  device_model?: string;
  os_version?: string;
  first_installed_at: string;
  last_active_at: string;
  phone?: string;
  email?: string;
  display_name?: string;
  ff_uid?: string;
  ff_ign?: string;
}

export interface TournamentItem {
  id: string;
  title: string;
  description?: string;
  game: string;
  mode: 'solo' | 'duo' | 'squad';
  map: 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NexTerra';
  entry_type: 'free' | 'paid';
  entry_fee: number;
  prize_pool: number;
  prize_distribution: string;
  per_kill_prize: number;
  max_slots: number;
  filled_slots: number;
  start_time: string;
  room_id?: string;
  room_password?: string;
  room_revealed: number;
  room_revealed_at?: string;
  status: 'upcoming' | 'open' | 'ongoing' | 'completed' | 'cancelled';
  payout_status?: 'unpaid' | 'previewed' | 'paid';
}

export interface ResultQueueItem {
  id: string;
  tournament_id: string;
  tournament_title: string;
  tournament_mode: string;
  tournament_map: string;
  entry_id: string;
  user_id: string;
  slot_number: number;
  player_ff_uid: string;
  player_ff_ign: string;
  player_name?: string;
  user_email?: string;
  user_phone?: string;
  claimed_rank: number;
  claimed_kills: number;
  admin_confirmed_rank?: number;
  admin_confirmed_kills?: number;
  screenshot_url: string;
  status: 'pending_review' | 'verified' | 'disputed' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

export interface PayoutPreviewData {
  tournament: {
    id: string;
    title: string;
    mode: string;
    map: string;
    prizePool: number;
    perKillPrize: number;
    status: string;
  };
  payoutStatus: 'unpaid' | 'previewed' | 'paid';
  totalPrizePool: number;
  totalComputedPayout: number;
  allResultsVerified: boolean;
  unverifiedCount: number;
  payoutBreakdown: Array<{
    userId: string;
    displayName: string;
    slotNumber: number;
    ffUid: string;
    ffIgn: string;
    rank: number;
    kills: number;
    placementPrize: number;
    killPrize: number;
    totalPayout: number;
    status: string;
  }>;
}

export interface ManagedUser {
  id: string;
  phone: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  is_phone_verified: number;
  is_email_verified: number;
  isKycVerified: boolean;
  display_name?: string;
  ff_uid?: string;
  ff_ign?: string;
  ff_verification_status?: string;
  total_earnings?: number;
  walletBalance: number;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'entry_fee_debit' | 'prize_credit' | 'refund' | 'withdrawal';
  amount: number;
  reference_id?: string;
  description: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_id?: string;
  actor_email?: string;
  actor_name?: string;
  action: string;
  target_resource: string;
  target_id?: string;
  details?: Record<string, any>;
  created_at: string;
}
