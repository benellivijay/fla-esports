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

-- Section 3.2: Slot booking & entries with partial unique indexes preventing double-booking of confirmed slots
CREATE TABLE IF NOT EXISTS tournament_entries (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    slot_number INTEGER NOT NULL,
    team_name TEXT,
    player_ff_uid TEXT NOT NULL,
    player_ff_ign TEXT NOT NULL,
    teammate_details TEXT, -- JSON array of teammate FF UIDs and IGNs
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

CREATE INDEX IF NOT EXISTS idx_tournament_entries_user 
ON tournament_entries(tournament_id, user_id);

-- Section 3.3: Ledger-based wallet (deposit, entry_fee_debit, prize_credit, refund, withdrawal)
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

-- Section 3.3: Payment Gateway Orders (Cashfree / Razorpay Sandbox)
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
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Section 3.4: Match Results & Verification Queue
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

-- Section 3.3: Withdrawal Requests with 30% TDS Deduction
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL, -- Gross requested amount
    payout_method TEXT NOT NULL CHECK(payout_method IN ('upi', 'bank_transfer')),
    upi_id TEXT,
    bank_account_number TEXT,
    bank_ifsc TEXT,
    bank_account_holder_name TEXT,
    tds_deducted REAL NOT NULL DEFAULT 0.0,
    net_payable_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'rejected')),
    payout_reference_id TEXT,
    rejection_reason TEXT,
    processed_by TEXT,
    processed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(processed_by) REFERENCES users(id)
);

-- Section 3.2 & 5: Push Notification Device Tokens & In-App Notification Center
CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK(platform IN ('android', 'ios', 'web')),
    device_info TEXT,
    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ROOM_REVEALED', 'MATCH_REMINDER', 'BOOKING_CONFIRMED', 'PRIZE_CREDITED', 'WITHDRAWAL_COMPLETED', 'RESULT_VERIFIED', 'SYSTEM'
    data TEXT, -- JSON string payload
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(actor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_ff_uid ON profiles(ff_uid);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_records(identifier);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON tournaments(start_time);
CREATE INDEX IF NOT EXISTS idx_tournaments_mode ON tournaments(mode);
CREATE INDEX IF NOT EXISTS idx_tournaments_entry_type ON tournaments(entry_type);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tourney ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_user ON tournament_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_payment ON payment_orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_match_results_tourney ON match_results(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_results_status ON match_results(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
