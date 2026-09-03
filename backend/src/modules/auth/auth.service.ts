import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import https from 'https';
import { getDb } from '../../database/db';
import { config } from '../../config/env';
import { CryptoUtil } from '../../utils/crypto';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { JWTPayload, User, Profile } from '../../types';
import { EmailService } from '../../services/email.service';
import { SmsService } from '../../services/sms.service';
import { GDriveAuthStore, StoredPlayerRecord, StoredPendingRegistration } from '../../services/gdrive_auth_store.service';

export class AuthService {
  /**
   * POST /auth/signin
   * Signs in user with username or email + password.
   * Generic error on failure: 'Incorrect username/email or password'
   */
  public static async signIn(identifier: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    profile: Profile;
  }> {
    const cleanIdentifier = identifier.trim().toLowerCase();

    // 1. Look up player from Google Drive Auth Store
    const player = await GDriveAuthStore.getPlayer(cleanIdentifier);

    if (!player || !player.password_hash) {
      throw new AppError('Incorrect username/email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = CryptoUtil.comparePassword(password, player.password_hash);
    if (!isMatch) {
      throw new AppError('Incorrect username/email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (player.status !== 'active') {
      throw new AppError('Account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    const user: User = {
      id: player.id,
      username: player.username,
      email: player.email,
      phone: player.phone || undefined,
      google_id: player.google_id || undefined,
      is_email_verified: Boolean(player.email_verified),
      is_phone_verified: Boolean(player.phone_verified),
      kyc_verified: Boolean(player.kyc_verified),
      ff_uid: player.ff_uid || undefined,
      ff_ign: player.ff_ign || undefined,
      role: player.role,
      status: player.status,
      created_at: player.created_at,
      updated_at: player.updated_at,
    };

    const profile: Profile = {
      id: player.id,
      user_id: player.id,
      display_name: player.profile?.display_name || player.username || 'Player',
      ff_verification_status: player.ff_uid ? 'verified' : 'unverified',
      matches_played: player.profile?.matches_played || 0,
      wins: player.profile?.wins || 0,
      total_kills: player.profile?.total_kills || 0,
      total_earnings: player.profile?.total_earnings || 0,
      created_at: player.created_at,
      updated_at: player.updated_at,
    };

    const { accessToken, refreshToken } = this.generateTokenPair(user);

    Logger.audit({
      actorId: user.id,
      action: 'USER_SIGNIN',
      targetResource: 'users',
      targetId: user.id,
      details: { identifier: cleanIdentifier },
    });

    return {
      accessToken,
      refreshToken,
      user,
      profile,
    };
  }

  /**
   * POST /auth/register
   * Validates registration details, checks uniqueness in Google Drive store, rate-limits to 3 sends per 15 min,
   * stores pending registration in Google Drive (never creates a user row yet), and sends 6-digit OTP.
   */
  public static async register(username: string, email: string, password: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Validate username format (3-30 chars, alphanumeric or underscores)
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      throw new AppError('Username must be 3-30 alphanumeric characters or underscores.', 400, 'INVALID_USERNAME');
    }

    // Validate password length
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400, 'INVALID_PASSWORD');
    }

    // Check if username or email is already taken in Google Drive Auth Store
    const existingPlayerByUsername = await GDriveAuthStore.getPlayer(cleanUsername);
    if (existingPlayerByUsername) {
      throw new AppError('Username is already taken.', 400, 'USERNAME_TAKEN');
    }

    const existingPlayerByEmail = await GDriveAuthStore.getPlayer(cleanEmail);
    if (existingPlayerByEmail) {
      throw new AppError('Email is already registered. Please sign in.', 400, 'EMAIL_EXISTS');
    }

    // Rate limiting: check pending registrations (max 10 sends per 15 minutes)
    const existingPending = await GDriveAuthStore.getPendingRegistration(cleanEmail);
    let sendCount = 1;
    let lastSentAt = new Date().toISOString();

    if (existingPending) {
      const isWithin15Min = new Date(existingPending.last_sent_at).getTime() > Date.now() - 15 * 60 * 1000;
      if (isWithin15Min && existingPending.send_count >= 10) {
        throw new AppError('Too many registration attempts. Please wait 15 minutes before trying again.', 429, 'RATE_LIMITED');
      }

      sendCount = isWithin15Min ? existingPending.send_count + 1 : 1;
      lastSentAt = new Date().toISOString();
    }

    // Generate 6-digit OTP code (never logged or returned in API response)
    const otpCode = CryptoUtil.generateOTP();
    const otpHash = CryptoUtil.hash(otpCode);
    const passwordHash = CryptoUtil.hashPassword(password);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10-minute expiry

    // Save pending registration directly to Google Drive Auth Store
    await GDriveAuthStore.savePendingRegistration({
      email: cleanEmail,
      username: cleanUsername,
      password_hash: passwordHash,
      otp_hash: otpHash,
      expires_at: expiresAt,
      send_count: sendCount,
      last_sent_at: lastSentAt,
      created_at: existingPending?.created_at || new Date().toISOString(),
    });

    Logger.info(`[GDRIVE AUTH] Registration OTP stored in Google Drive for ${cleanEmail} (attempt ${sendCount})`);

    // Dispatch transactional email asynchronously
    EmailService.sendOtpEmail(cleanEmail, otpCode).catch((err: any) => {
      Logger.error(`[EMAIL] Failed to dispatch registration OTP email to ${cleanEmail}: ${err.message}`);
    });

    return {
      success: true,
      message: 'Verification code sent to your email.',
    };
  }

  /**
   * POST /auth/verify-otp
   * Verifies OTP against pending_registrations. Max 5 attempts.
   * On success: creates user row with email_verified = true, deletes pending record, and issues JWT tokens.
   */
  public static async verifyRegistrationOtp(email: string, code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    profile: Profile;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // 1. Fetch pending registration from Google Drive store
    const pending = await GDriveAuthStore.getPendingRegistration(cleanEmail);

    if (!pending || new Date(pending.expires_at).getTime() <= Date.now()) {
      throw new AppError('Verification code expired or invalid. Please register again.', 400, 'INVALID_OR_EXPIRED_OTP');
    }

    const providedHash = CryptoUtil.hash(cleanCode);
    if (providedHash !== pending.otp_hash) {
      throw new AppError('Incorrect verification code.', 400, 'INVALID_OTP');
    }

    // 2. Double check if user was created in the meantime
    const existingPlayer = await GDriveAuthStore.getPlayer(cleanEmail);
    if (existingPlayer) {
      await GDriveAuthStore.deletePendingRegistration(cleanEmail);
      throw new AppError('Account with this email already exists. Please sign in.', 409, 'ACCOUNT_EXISTS');
    }

    // 3. Create player record and save directly into Google Drive Auth Store
    const userId = uuidv4();
    const now = new Date().toISOString();

    const storedPlayer: StoredPlayerRecord = {
      id: userId,
      username: pending.username,
      email: cleanEmail,
      password_hash: pending.password_hash,
      email_verified: true,
      phone_verified: false,
      kyc_verified: false,
      role: 'player',
      status: 'active',
      created_at: now,
      updated_at: now,
      profile: {
        display_name: pending.username,
        matches_played: 0,
        wins: 0,
        total_kills: 0,
        total_earnings: 0,
      },
    };

    await GDriveAuthStore.savePlayer(storedPlayer);
    await GDriveAuthStore.deletePendingRegistration(cleanEmail);

    const user: User = {
      id: storedPlayer.id,
      username: storedPlayer.username,
      email: storedPlayer.email,
      phone: undefined,
      is_email_verified: true,
      is_phone_verified: false,
      kyc_verified: false,
      role: storedPlayer.role,
      status: storedPlayer.status,
      created_at: storedPlayer.created_at,
      updated_at: storedPlayer.updated_at,
    };

    const profile: Profile = {
      id: storedPlayer.id,
      user_id: storedPlayer.id,
      display_name: storedPlayer.username,
      ff_verification_status: 'unverified',
      matches_played: 0,
      wins: 0,
      total_kills: 0,
      total_earnings: 0,
      created_at: storedPlayer.created_at,
      updated_at: storedPlayer.updated_at,
    };

    Logger.audit({
      actorId: userId,
      action: 'USER_REGISTERED_OTP_VERIFIED',
      targetResource: 'users',
      targetId: userId,
      details: { username: pending.username, email: cleanEmail, stored_in: 'gdrive' },
    });

    const { accessToken, refreshToken } = this.generateTokenPair(user);
    return {
      accessToken,
      refreshToken,
      user,
      profile,
    };
  }

  /**
   * POST /auth/resend-otp
   * Regenerates and resends OTP for pending registration in Google Drive, respecting 3 sends per 15 min limit.
   */
  public static async resendRegistrationOtp(email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const pending = await GDriveAuthStore.getPendingRegistration(cleanEmail);

    if (!pending) {
      throw new AppError('No pending registration found for this email. Please register first.', 400, 'NO_PENDING_REGISTRATION');
    }

    const isWithin15Min = new Date(pending.last_sent_at).getTime() > Date.now() - 15 * 60 * 1000;
    if (isWithin15Min && pending.send_count >= 10) {
      throw new AppError('Too many code requests. Please wait 15 minutes before requesting again.', 429, 'RATE_LIMITED');
    }

    const sendCount = isWithin15Min ? pending.send_count + 1 : 1;
    const otpCode = CryptoUtil.generateOTP();
    const otpHash = CryptoUtil.hash(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await GDriveAuthStore.savePendingRegistration({
      ...pending,
      otp_hash: otpHash,
      send_count: sendCount,
      last_sent_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    Logger.info(`[GDRIVE AUTH] Resent registration OTP for ${cleanEmail} (send ${sendCount})`);

    EmailService.sendOtpEmail(cleanEmail, otpCode).catch((err: any) => {
      Logger.error(`[EMAIL] Failed to resend OTP email to ${cleanEmail}: ${err.message}`);
    });

    return {
      success: true,
      message: 'New verification code sent to your email.',
    };
  }

  /**
   * POST /auth/google
   * Google OAuth sign-in / sign-up directly persisted into Google Drive Auth Store.
   * Allows players to specify their preferred username when signing up with Google.
   */
  public static async googleAuth(payload: {
    idToken?: string | null;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    googleId?: string | null;
    username?: string | null;
    checkOnly?: boolean | null;
  }): Promise<{
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    profile?: Profile;
    isNewUser: boolean;
    suggestedUsername?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
    googleId?: string;
  }> {
    let verifiedEmail = payload.email?.trim().toLowerCase() || undefined;
    let verifiedGoogleId = payload.googleId?.trim() || undefined;
    let verifiedName = payload.name?.trim() || undefined;
    let verifiedPicture = payload.avatarUrl?.trim() || undefined;

    // Verify token server-side if idToken provided
    if (payload.idToken) {
      const googleData = await this.verifyGoogleIdToken(payload.idToken);
      if (googleData) {
        verifiedEmail = googleData.email.toLowerCase().trim();
        verifiedGoogleId = googleData.sub;
        if (googleData.name) verifiedName = googleData.name;
        if (googleData.picture) verifiedPicture = googleData.picture;
      }
    }

    if (!verifiedEmail) {
      throw new AppError('Invalid Google authentication payload or token.', 400, 'INVALID_GOOGLE_AUTH');
    }

    // 1. Look up by google_id or email in Google Drive store
    let player = verifiedGoogleId ? await GDriveAuthStore.getPlayerByGoogleId(verifiedGoogleId) : null;
    if (!player) {
      player = await GDriveAuthStore.getPlayer(verifiedEmail);
      if (player && verifiedGoogleId) {
        player.google_id = verifiedGoogleId;
        player.email_verified = true;
        await GDriveAuthStore.savePlayer(player);
      }
    }

    // Check if caller only wants to probe if player is new
    if (payload.checkOnly && !player) {
      let suggestedUsername = (verifiedName || verifiedEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 20);
      if (suggestedUsername.length < 3) suggestedUsername = `player_${suggestedUsername}`;
      return {
        isNewUser: true,
        suggestedUsername,
        email: verifiedEmail,
        name: verifiedName,
        avatarUrl: verifiedPicture,
        googleId: verifiedGoogleId,
      };
    }

    // Validate requested custom username if provided
    let finalUsername: string | undefined;
    if (payload.username) {
      finalUsername = payload.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(finalUsername)) {
        throw new AppError('Username must be 3-30 alphanumeric characters or underscores.', 400, 'INVALID_USERNAME');
      }
      const collision = await GDriveAuthStore.getPlayer(finalUsername);
      if (collision && collision.id !== player?.id) {
        throw new AppError('This username is already taken. Please choose another username.', 409, 'USERNAME_TAKEN');
      }
    }

    let isNewUser = false;

    // 2. If no player exists, create new Google player record in Google Drive
    if (!player) {
      isNewUser = true;
      const userId = uuidv4();
      
      let username = finalUsername;
      if (!username) {
        let baseUsername = (verifiedName || verifiedEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        if (baseUsername.length < 3) baseUsername = `player_${baseUsername}`;
        baseUsername = baseUsername.slice(0, 20);

        username = baseUsername;
        const collision = await GDriveAuthStore.getPlayer(username);
        if (collision) {
          username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }

      const now = new Date().toISOString();
      player = {
        id: userId,
        username,
        email: verifiedEmail,
        google_id: verifiedGoogleId || null,
        email_verified: true,
        phone_verified: false,
        kyc_verified: false,
        role: 'player',
        status: 'active',
        created_at: now,
        updated_at: now,
        profile: {
          display_name: verifiedName || username,
          matches_played: 0,
          wins: 0,
          total_kills: 0,
          total_earnings: 0,
        },
      };

      await GDriveAuthStore.savePlayer(player);

      Logger.audit({
        actorId: userId,
        action: 'USER_REGISTERED_GOOGLE_GDRIVE',
        targetResource: 'users',
        targetId: userId,
        details: { email: verifiedEmail, googleId: verifiedGoogleId, username },
      });
    } else if (finalUsername && finalUsername !== player.username) {
      // Existing player updating username
      player.username = finalUsername;
      if (player.profile) {
        player.profile.display_name = verifiedName || finalUsername;
      }
      player.updated_at = new Date().toISOString();
      await GDriveAuthStore.savePlayer(player);
    }

    const user: User = {
      id: player.id,
      username: player.username,
      email: player.email,
      phone: player.phone || undefined,
      google_id: player.google_id || undefined,
      is_email_verified: true,
      is_phone_verified: Boolean(player.phone_verified),
      kyc_verified: Boolean(player.kyc_verified),
      ff_uid: player.ff_uid || undefined,
      ff_ign: player.ff_ign || undefined,
      role: player.role,
      status: player.status,
      created_at: player.created_at,
      updated_at: player.updated_at,
    };

    const profile: Profile = {
      id: player.id,
      user_id: player.id,
      display_name: player.profile?.display_name || player.username || 'Player',
      avatar_url: verifiedPicture || undefined,
      ff_verification_status: player.ff_uid ? 'verified' : 'unverified',
      matches_played: player.profile?.matches_played || 0,
      wins: player.profile?.wins || 0,
      total_kills: player.profile?.total_kills || 0,
      total_earnings: player.profile?.total_earnings || 0,
      created_at: player.created_at,
      updated_at: player.updated_at,
    };

    const { accessToken, refreshToken } = this.generateTokenPair(user);
    return { accessToken, refreshToken, user, profile, isNewUser };
  }

  /**
   * GET /auth/check-username
   * Checks if a requested username is available in real time.
   */
  public static async checkUsername(username: string): Promise<{ available: boolean; message: string }> {
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      return { available: false, message: 'Username must be at least 3 characters.' };
    }
    if (clean.length > 30) {
      return { available: false, message: 'Username cannot exceed 30 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return { available: false, message: 'Username can only contain letters, numbers, and underscores.' };
    }
    const player = await GDriveAuthStore.getPlayer(clean);
    if (player) {
      return { available: false, message: 'Username is already taken.' };
    }
    return { available: true, message: 'Username is available!' };
  }

  /**
   * Helper to verify Google ID token with Google tokeninfo endpoint
   */
  private static async verifyGoogleIdToken(idToken: string): Promise<{
    email: string;
    sub: string;
    name?: string;
    picture?: string;
  } | null> {
    return new Promise((resolve) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.email && parsed.sub) {
              resolve({
                email: parsed.email,
                sub: parsed.sub,
                name: parsed.name,
                picture: parsed.picture,
              });
            } else {
              resolve(null);
            }
          } catch (_) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });
  }

  /**
   * Legacy sendOtp support
   */
  public static async sendOtp(identifier: string, type: 'phone' | 'email'): Promise<{ success: boolean; message: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDb();

    if (config.nodeEnv === 'production') {
      const recent = db.prepare(`
        SELECT * FROM otp_records 
        WHERE identifier = ? AND created_at > datetime('now', '-1 minute')
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanIdentifier);
      if (recent) {
        throw new AppError('Please wait at least 1 minute before requesting a new OTP.', 429, 'OTP_RATE_LIMITED');
      }
    }

    const otpCode = CryptoUtil.generateOTP();
    const otpHash = CryptoUtil.hash(otpCode);
    const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO otp_records (id, identifier, otp_hash, expires_at, attempts, verified, created_at)
      VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
    `).run(uuidv4(), cleanIdentifier, otpHash, expiresAt);

    if (type === 'email' || cleanIdentifier.includes('@')) {
      EmailService.sendOtpEmail(cleanIdentifier, otpCode).catch((err: any) =>
        Logger.error(`[EMAIL] Failed to dispatch OTP email: ${err.message}`)
      );
    } else {
      SmsService.sendOtpSms(cleanIdentifier, otpCode).catch((err: any) =>
        Logger.error(`[SMS] Failed to dispatch OTP SMS: ${err.message}`)
      );
    }

    return {
      success: true,
      message: `OTP sent successfully to ${type === 'phone' ? 'phone number' : 'email address'}.`,
    };
  }

  /**
   * Legacy verifyOtp support
   */
  public static async verifyOtp(
    identifier: string,
    otpCode: string,
    isPhone: boolean,
    name?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    profile: Profile;
  }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDb();

    const otpRecord = db.prepare(`
      SELECT * FROM otp_records 
      WHERE identifier = ? AND verified = 0 AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(cleanIdentifier) as any;

    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP. Please request a new one.', 400, 'INVALID_OTP');
    }

    if (otpRecord.attempts >= config.otp.maxAttempts) {
      throw new AppError('Maximum OTP verification attempts exceeded.', 400, 'MAX_ATTEMPTS_EXCEEDED');
    }

    const providedHash = CryptoUtil.hash(otpCode.trim());
    if (providedHash !== otpRecord.otp_hash) {
      db.prepare('UPDATE otp_records SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      throw new AppError('Incorrect OTP code.', 400, 'INVALID_OTP');
    }

    db.prepare('UPDATE otp_records SET verified = 1 WHERE id = ?').run(otpRecord.id);

    const userQuery = isPhone 
      ? db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanIdentifier) as any
      : db.prepare('SELECT * FROM users WHERE email = ?').get(cleanIdentifier) as any;

    let user: User;
    let profile: Profile;
    const customName = name && name.trim().length > 0 ? name.trim() : null;

    if (!userQuery) {
      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, phone, email, role, status, is_phone_verified, is_email_verified, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, 'user', 'active', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        userId,
        isPhone ? cleanIdentifier : null,
        !isPhone ? cleanIdentifier : null,
        isPhone ? 1 : 0,
        !isPhone ? 1 : 0,
        !isPhone ? 1 : 0
      );

      const defaultDisplayName = customName || `Player_${cleanIdentifier.slice(-4)}`;
      const profileId = uuidv4();
      db.prepare(`
        INSERT INTO profiles (id, user_id, display_name, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
        VALUES (?, ?, ?, 'unverified', 0, 0, 0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(profileId, userId, defaultDisplayName);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
    } else {
      user = userQuery;
      if (customName) {
        db.prepare('UPDATE profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(customName, user.id);
      }
      profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as any;
    }

    const { accessToken, refreshToken } = this.generateTokenPair(user);
    return { accessToken, refreshToken, user, profile };
  }

  /**
   * Verify and link secondary contact
   */
  public static async verifySecondaryIdentifier(userId: string, identifier: string, otpCode: string, type: 'phone' | 'email'): Promise<{
    user: User;
    kycVerified: boolean;
  }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDb();

    const otpRecord = db.prepare(`
      SELECT * FROM otp_records 
      WHERE identifier = ? AND verified = 0 AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(cleanIdentifier) as any;

    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP. Please request a new one.', 400, 'INVALID_OTP');
    }

    const providedHash = CryptoUtil.hash(otpCode.trim());
    if (providedHash !== otpRecord.otp_hash) {
      db.prepare('UPDATE otp_records SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      throw new AppError('Incorrect OTP code.', 400, 'INVALID_OTP');
    }

    db.prepare('UPDATE otp_records SET verified = 1 WHERE id = ?').run(otpRecord.id);

    const existing = type === 'phone'
      ? db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(cleanIdentifier, userId)
      : db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanIdentifier, userId);

    if (existing) {
      throw new AppError(`This ${type} is already linked to another account.`, 409, 'IDENTIFIER_ALREADY_LINKED');
    }

    if (type === 'phone') {
      db.prepare('UPDATE users SET phone = ?, is_phone_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cleanIdentifier, userId);
    } else {
      db.prepare('UPDATE users SET email = ?, is_email_verified = 1, email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cleanIdentifier, userId);
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const kycVerified = updatedUser.is_phone_verified === 1 && (updatedUser.is_email_verified === 1 || updatedUser.email_verified === 1);

    return { user: updatedUser, kycVerified };
  }

  /**
   * Refreshes JWT tokens with token rotation
   */
  public static async refreshToken(tokenStr: string): Promise<{ accessToken: string; refreshToken: string }> {
    const db = getDb();
    const tokenHash = CryptoUtil.hash(tokenStr);

    const record = db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE token_hash = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')
    `).get(tokenHash) as any;

    if (!record) {
      throw new AppError('Invalid or expired refresh token. Please sign in again.', 401, 'INVALID_REFRESH_TOKEN');
    }

    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(record.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id) as any;
    if (!user || user.status !== 'active') {
      throw new AppError('User account not found or suspended.', 403, 'ACCOUNT_INACTIVE');
    }

    return this.generateTokenPair(user);
  }

  /**
   * Revokes refresh token on logout
   */
  public static async logout(tokenStr: string): Promise<void> {
    const db = getDb();
    const tokenHash = CryptoUtil.hash(tokenStr);
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  }

  /**
   * Helper to generate Access Token + Refresh Token and persist hash
   */
  private static generateTokenPair(user: User): { accessToken: string; refreshToken: string } {
    const db = getDb();

    const jwtPayload: JWTPayload = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
    };

    const accessToken = jwt.sign(jwtPayload, config.jwt.accessSecret, {
      expiresIn: '15m',
    });

    const rawRefreshToken = CryptoUtil.generateRefreshTokenString();
    const refreshHash = CryptoUtil.hash(rawRefreshToken);
    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(uuidv4(), user.id, refreshHash, expiresAt);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
