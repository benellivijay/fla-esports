export type UserRole = 'user' | 'player' | 'admin' | 'moderator';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
  google_id?: string | null;
  role: UserRole;
  status: UserStatus;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  email_verified?: boolean;
  kyc_verified?: boolean;
  ff_uid?: string | null;
  ff_ign?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  otp_hash: string;
  attempts: number;
  send_count: number;
  first_sent_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export type FFVerificationStatus = 'unverified' | 'challenge_issued' | 'pending_review' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  ff_uid?: string | null;
  ff_ign?: string | null;
  ff_verification_status: FFVerificationStatus;
  ff_temp_challenge?: string | null;
  ff_proof_image_url?: string | null;
  ff_verified_at?: string | null;
  matches_played: number;
  wins: number;
  total_kills: number;
  total_earnings: number;
  created_at: string;
  updated_at: string;
}

export type KYCStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface KYCRecord {
  id: string;
  user_id: string;
  pan_number: string;
  full_name: string;
  dob: string;
  document_url?: string | null;
  status: KYCStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface OTPRecord {
  id: string;
  identifier: string;
  otp_hash: string;
  expires_at: string;
  attempts: number;
  verified: boolean;
  created_at: string;
}

export interface JWTPayload {
  userId: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
}

// Tournament Types
export type TournamentMode = 'solo' | 'duo' | 'squad';
export type GameMode =
  | 'ff_max'
  | 'survival'
  | 'free_match'
  | 'lone_wolf'
  | 'headshot_only'
  | 'one_tap'
  | 'sniper_1v1'
  | 'lone_wolf_headshot';
export type TournamentMap = 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NexTerra';
export type EntryType = 'free' | 'paid';
export type TournamentStatus = 'upcoming' | 'open' | 'ongoing' | 'completed' | 'cancelled';

export interface PrizeDistributionItem {
  rank: number | string;
  amount: number;
  percentage?: number;
}

export interface Tournament {
  id: string;
  title: string;
  description?: string | null;
  game: string;
  game_mode?: GameMode | string;
  mode: TournamentMode;
  map: TournamentMap;
  entry_type: EntryType;
  entry_fee: number;
  prize_pool: number;
  prize_distribution: PrizeDistributionItem[] | string;
  per_kill_prize: number;
  max_slots: number;
  filled_slots: number;
  start_time: string;
  registration_closes_at?: string | null;
  room_reveal_time_minutes: number;
  room_id?: string | null;
  room_password?: string | null;
  room_revealed: boolean | number;
  room_revealed_at?: string | null;
  room_updated_at?: string | null;
  room_updated_by?: string | null;
  status: TournamentStatus;
  banner_url?: string | null;
  rules?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// Step 3: Slot Booking & Entries Types
export type EntryStatus = 'confirmed' | 'cancelled' | 'disqualified';

export interface TeammateDetail {
  ffUid: string;
  ffIgn: string;
  phone?: string;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  user_id: string;
  slot_number: number;
  team_name?: string | null;
  player_ff_uid: string;
  player_ff_ign: string;
  teammate_details?: TeammateDetail[] | string | null;
  entry_fee_paid: number;
  status: EntryStatus;
  created_at: string;
  updated_at: string;
}

export interface SlotInfo {
  slotNumber: number;
  status: 'available' | 'booked';
  bookedBy?: string | null;
  isCurrentUser: boolean;
}

// Step 4: Wallet & Ledger Types
export type LedgerEntryType = 'deposit' | 'entry_fee_debit' | 'prize_credit' | 'refund' | 'withdrawal';

export interface WalletLedgerEntry {
  id: string;
  user_id: string;
  type: LedgerEntryType;
  amount: number;
  reference_id?: string | null;
  description?: string | null;
  created_at: string;
}

export interface WalletSummary {
  balance: number;
  withdrawableBalance: number;
  depositBalance: number;
  totalDeposited: number;
  totalWinnings: number;
  totalWithdrawn?: number;
  totalSpent: number;
  totalRefunds: number;
  currency: string;
}

export type PaymentOrderStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type PaymentGateway = 'cashfree_sandbox' | 'razorpay_sandbox' | 'mock_gateway';

export interface PaymentOrder {
  id: string;
  user_id: string;
  order_id: string;
  payment_id?: string | null;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  gateway: PaymentGateway;
  signature?: string | null;
  created_at: string;
  updated_at: string;
}

// Step 6: Match Results & Verification Types
export type ResultStatus = 'pending_review' | 'approved' | 'rejected' | 'disputed';

export interface MatchResult {
  id: string;
  tournament_id: string;
  entry_id: string;
  user_id: string;
  claimed_rank: number;
  claimed_kills: number;
  screenshot_url: string;
  admin_confirmed_rank?: number | null;
  admin_confirmed_kills?: number | null;
  status: ResultStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminResultQueueItem extends MatchResult {
  tournament_title: string;
  tournament_mode: string;
  tournament_map: string;
  slot_number: number;
  player_display_name: string;
  player_ff_uid: string;
  player_ff_ign: string;
}

// Step 7: Payout & Withdrawal Types
export type PayoutMethod = 'upi' | 'bank_transfer';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  payout_method: PayoutMethod;
  upi_id?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_account_holder_name?: string | null;
  tds_deducted: number;
  net_payable_amount: number;
  status: WithdrawalStatus;
  payout_reference_id?: string | null;
  rejection_reason?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutDistributionItem {
  userId: string;
  playerIgn: string;
  rank: number;
  kills: number;
  rankPrize: number;
  killPrize: number;
  totalPrize: number;
}

export interface PayoutDistributionSummary {
  tournamentId: string;
  tournamentTitle: string;
  totalWinners: number;
  totalAmountPaid: number;
  distributions: PayoutDistributionItem[];
}

// Step 8: Push Notifications & Device Token Types
export type PlatformType = 'android' | 'ios' | 'web';
export type NotificationType =
  | 'TOURNAMENT_CREATED'
  | 'ROOM_REVEALED'
  | 'MATCH_REMINDER'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REFUNDED'
  | 'RESULT_APPROVED'
  | 'RESULT_REJECTED'
  | 'PRIZE_CREDITED'
  | 'WITHDRAWAL_COMPLETED'
  | 'WITHDRAWAL_REJECTED'
  | 'SYSTEM';

export interface DeviceTokenRecord {
  id: string;
  user_id: string;
  token: string;
  platform: PlatformType;
  device_info?: string | null;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: any;
  is_read: boolean | number;
  created_at: string;
}
