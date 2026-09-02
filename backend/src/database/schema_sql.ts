export const SCHEMA_SQL = `
-- FF Esports Tournament App Schema

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'moderator')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'banned')),
    is_phone_verified INTEGER NOT NULL DEFAULT 0,
    is_email_verified INTEGER NOT NULL DEFAULT 0,
    email_verified INTEGER NOT NULL DEFAULT 0,
    kyc_verified INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_registrations (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    send_count INTEGER NOT NULL DEFAULT 1,
    first_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    ff_uid TEXT UNIQUE,
    ff_ign TEXT,
    ff_verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(ff_verification_status IN ('unverified', 'challenge_issued', 'pending_review', 'verified', 'rejected')),
    ff_temp_challenge TEXT,
    ff_proof_image_url TEXT,
    ff_verified_at DATETIME,
    matches_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    total_kills INTEGER NOT NULL DEFAULT 0,
    total_earnings REAL NOT NULL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kyc_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    pan_number TEXT NOT NULL,
    full_name TEXT NOT NULL,
    dob TEXT NOT NULL,
    document_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('not_submitted', 'pending', 'verified', 'rejected')),
    rejection_reason TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS otp_records (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    game TEXT NOT NULL DEFAULT 'Free Fire',
    game_mode TEXT NOT NULL DEFAULT 'survival' CHECK(game_mode IN ('ff_max', 'survival', 'free_match', 'lone_wolf', 'headshot_only', 'one_tap', 'sniper_1v1', 'lone_wolf_headshot')),
    mode TEXT NOT NULL CHECK(mode IN ('solo', 'duo', 'squad')),
    map TEXT NOT NULL CHECK(map IN ('Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra')),
    entry_type TEXT NOT NULL CHECK(entry_type IN ('free', 'paid')),
    entry_fee REAL NOT NULL DEFAULT 0.0,
    prize_pool REAL NOT NULL DEFAULT 0.0,
    prize_distribution TEXT NOT NULL, -- JSON string of rank breakdown
    per_kill_prize REAL NOT NULL DEFAULT 0.0,
    max_slots INTEGER NOT NULL,
    filled_slots INTEGER NOT NULL DEFAULT 0,
    start_time DATETIME NOT NULL,
    registration_closes_at DATETIME,
    room_reveal_time_minutes INTEGER NOT NULL DEFAULT 15,
    room_id TEXT,
    room_password TEXT,
    room_revealed INTEGER NOT NULL DEFAULT 0,
    room_revealed_at DATETIME,
    room_updated_at DATETIME,
    room_updated_by TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'open', 'ongoing', 'completed', 'cancelled')),
    payout_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payout_status IN ('unpaid', 'previewed', 'paid')),
    payout_executed_at DATETIME,
    payout_executed_by TEXT,
    banner_url TEXT,
    rules TEXT,
    created_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(room_updated_by) REFERENCES users(id),
    FOREIGN KEY(payout_executed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tournament_entries (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    slot_number INTEGER NOT NULL,
    team_name TEXT,
    player_ff_uid TEXT NOT NULL,
    player_ff_ign TEXT NOT NULL,
    teammate_details TEXT,
    entry_fee_paid REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'disqualified')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_confirmed_slot 
ON tournament_entries(tournament_id, slot_number) 
WHERE status = 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_confirmed_user 
ON tournament_entries(tournament_id, user_id) 
WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS wallet_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('deposit', 'entry_fee_debit', 'prize_credit', 'refund', 'withdrawal')),
    amount REAL NOT NULL,
    reference_id TEXT,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT NOT NULL UNIQUE,
    payment_id TEXT UNIQUE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'cancelled')),
    gateway TEXT NOT NULL DEFAULT 'mock_gateway' CHECK(gateway IN ('cashfree_sandbox', 'razorpay_sandbox', 'mock_gateway')),
    signature TEXT,
    screenshot_url TEXT,
    rejection_reason TEXT,
    processed_by TEXT,
    processed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_results (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    claimed_rank INTEGER NOT NULL,
    claimed_kills INTEGER NOT NULL DEFAULT 0,
    screenshot_url TEXT NOT NULL,
    admin_confirmed_rank INTEGER,
    admin_confirmed_kills INTEGER,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'rejected', 'disputed')),
    rejection_reason TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY(entry_id) REFERENCES tournament_entries(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id),
    UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payout_method TEXT NOT NULL CHECK(payout_method IN ('upi', 'bank_transfer')),
    upi_id TEXT,
    bank_account_number TEXT,
    bank_ifsc TEXT,
    bank_account_holder_name TEXT,
    tds_deducted REAL NOT NULL DEFAULT 0.0,
    net_payable REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'rejected')),
    payout_reference_id TEXT,
    rejection_reason TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS push_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK(platform IN ('android', 'ios', 'web')),
    device_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('room_credentials', 'match_result', 'wallet', 'kyc', 'general')),
    data TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    target_resource TEXT,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(actor_id) REFERENCES users(id)
);
`;
