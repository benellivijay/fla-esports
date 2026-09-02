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
    const db = getDb();

    // Look up by either username or email
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE LOWER(username) = ? OR LOWER(email) = ?
    `).get(cleanIdentifier, cleanIdentifier) as any;

    if (!user || !user.password_hash) {
      throw new AppError('Incorrect username/email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = CryptoUtil.comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Incorrect username/email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw new AppError('Account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as any;
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
      profile: profile || {
        id: uuidv4(),
        user_id: user.id,
        display_name: user.username || user.email?.split('@')[0] || 'Player',
        ff_verification_status: 'unverified',
        matches_played: 0,
        wins: 0,
        total_kills: 0,
        total_earnings: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }

  /**
   * POST /auth/register
   * Validates registration details, checks uniqueness, rate-limits to 3 sends per 15 min,
   * stores pending registration (never creates a user row yet), and sends 6-digit OTP.
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

    const db = getDb();

    // Check if username is already taken in users table
    const existingUsername = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername.toLowerCase()) as any;
    if (existingUsername) {
      throw new AppError('Username is already taken.', 400, 'USERNAME_TAKEN');
    }

    // Check if email is already registered in users table
    const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail) as any;
    if (existingEmail) {
      throw new AppError('Email is already registered. Please sign in.', 400, 'EMAIL_EXISTS');
    }

    // Rate limiting: check pending_registrations table (max 3 sends per 15 minutes)
    const existingPending = db.prepare('SELECT * FROM pending_registrations WHERE LOWER(email) = ?').get(cleanEmail) as any;
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    let sendCount = 1;
    let firstSentAt = new Date().toISOString();

    if (existingPending) {
      const isWithin15Min = new Date(existingPending.first_sent_at).getTime() > Date.now() - 15 * 60 * 1000;
      if (isWithin15Min && existingPending.send_count >= 3) {
        throw new AppError('Too many registration attempts. Please wait 15 minutes before trying again.', 429, 'RATE_LIMITED');
      }

      if (isWithin15Min) {
        sendCount = existingPending.send_count + 1;
        firstSentAt = existingPending.first_sent_at;
      } else {
        sendCount = 1;
        firstSentAt = new Date().toISOString();
      }
    }

    // Generate 6-digit OTP code (never logged or returned in API response)
    const otpCode = CryptoUtil.generateOTP();
    const otpHash = CryptoUtil.hash(otpCode);
    const passwordHash = CryptoUtil.hashPassword(password);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10-minute expiry

    if (existingPending) {
      db.prepare(`
        UPDATE pending_registrations 
        SET username = ?, password_hash = ?, otp_hash = ?, attempts = 0, send_count = ?, first_sent_at = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanUsername, passwordHash, otpHash, sendCount, firstSentAt, expiresAt, existingPending.id);
    } else {
      db.prepare(`
        INSERT INTO pending_registrations (id, username, email, password_hash, otp_hash, attempts, send_count, first_sent_at, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(uuidv4(), cleanUsername, cleanEmail, passwordHash, otpHash, sendCount, firstSentAt, expiresAt);
    }

    Logger.info(`[AUTH] Registration OTP generated for ${cleanEmail} (attempt ${sendCount})`);

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
    const db = getDb();

    const pending = db.prepare(`
      SELECT * FROM pending_registrations 
      WHERE LOWER(email) = ? AND datetime(expires_at) > datetime('now')
    `).get(cleanEmail) as any;

    if (!pending) {
      throw new AppError('Verification code expired or invalid. Please register again.', 400, 'INVALID_OR_EXPIRED_OTP');
    }

    if (pending.attempts >= 5) {
      throw new AppError('Maximum verification attempts exceeded. Please request a new code.', 400, 'MAX_ATTEMPTS_EXCEEDED');
    }

    const providedHash = CryptoUtil.hash(cleanCode);
    if (providedHash !== pending.otp_hash) {
      db.prepare('UPDATE pending_registrations SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pending.id);
      throw new AppError('Incorrect verification code.', 400, 'INVALID_OTP');
    }

    // Check once more if username or email was registered by someone else in the meantime
    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanEmail, pending.username.toLowerCase()) as any;
    if (existingUser) {
      db.prepare('DELETE FROM pending_registrations WHERE id = ?').run(pending.id);
      throw new AppError('Account with this email or username already exists. Please sign in.', 409, 'ACCOUNT_EXISTS');
    }

    // Create user row with email_verified = true
    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, is_email_verified, email_verified, is_phone_verified, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 1, 0, 'user', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, pending.username, cleanEmail, pending.password_hash);

    // Create profile
    const profileId = uuidv4();
    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
      VALUES (?, ?, ?, 'unverified', 0, 0, 0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(profileId, userId, pending.username);

    // Delete pending registration record
    db.prepare('DELETE FROM pending_registrations WHERE id = ?').run(pending.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;

    Logger.audit({
      actorId: userId,
      action: 'USER_REGISTERED_OTP_VERIFIED',
      targetResource: 'users',
      targetId: userId,
      details: { username: pending.username, email: cleanEmail },
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
   * Regenerates and resends OTP for pending registration, respecting 3 sends per 15 min limit.
   */
  public static async resendRegistrationOtp(email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const db = getDb();

    const pending = db.prepare('SELECT * FROM pending_registrations WHERE LOWER(email) = ?').get(cleanEmail) as any;
    if (!pending) {
      throw new AppError('No pending registration found for this email. Please register first.', 400, 'NO_PENDING_REGISTRATION');
    }

    const isWithin15Min = new Date(pending.first_sent_at).getTime() > Date.now() - 15 * 60 * 1000;
    if (isWithin15Min && pending.send_count >= 3) {
      throw new AppError('Too many code requests. Please wait 15 minutes before requesting again.', 429, 'RATE_LIMITED');
    }

    let sendCount = isWithin15Min ? pending.send_count + 1 : 1;
    let firstSentAt = isWithin15Min ? pending.first_sent_at : new Date().toISOString();

    const otpCode = CryptoUtil.generateOTP();
    const otpHash = CryptoUtil.hash(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE pending_registrations 
      SET otp_hash = ?, attempts = 0, send_count = ?, first_sent_at = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(otpHash, sendCount, firstSentAt, expiresAt, pending.id);

    Logger.info(`[AUTH] Resent registration OTP for ${cleanEmail} (send ${sendCount})`);

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
   * Google OAuth sign-in / sign-up.
   * Verifies Google token server-side, finds or creates user (with email_verified = true, google_id stored).
   * If an email/password account already exists with that email, links google_id to it.
   */
  public static async googleAuth(payload: {
    idToken?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
    googleId?: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    profile: Profile;
  }> {
    let verifiedEmail = payload.email?.trim().toLowerCase();
    let verifiedGoogleId = payload.googleId?.trim();
    let verifiedName = payload.name?.trim();
    let verifiedPicture = payload.avatarUrl?.trim();

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

    const db = getDb();

    // 1. Look up by google_id
    let user: any = null;
    if (verifiedGoogleId) {
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(verifiedGoogleId) as any;
    }

    // 2. If not found by google_id, look up by email (linking account)
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(verifiedEmail) as any;
      if (user) {
        // Link google_id and mark email as verified
        db.prepare(`
          UPDATE users 
          SET google_id = COALESCE(?, google_id), is_email_verified = 1, email_verified = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(verifiedGoogleId || null, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
      }
    }

    let profile: Profile;

    // 3. If no user exists, create new Google user row (no OTP needed)
    if (!user) {
      const userId = uuidv4();
      
      // Generate a clean unique username
      let baseUsername = (verifiedName || verifiedEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      if (baseUsername.length < 3) baseUsername = `player_${baseUsername}`;
      baseUsername = baseUsername.slice(0, 20);

      let username = baseUsername;
      const collision = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(username);
      if (collision) {
        username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, google_id, is_email_verified, email_verified, is_phone_verified, role, status, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, 1, 1, 0, 'user', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(userId, username, verifiedEmail, verifiedGoogleId || null);

      const profileId = uuidv4();
      db.prepare(`
        INSERT INTO profiles (id, user_id, display_name, avatar_url, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'unverified', 0, 0, 0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(profileId, userId, verifiedName || username, verifiedPicture || null);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;

      Logger.audit({
        actorId: userId,
        action: 'USER_REGISTERED_GOOGLE',
        targetResource: 'users',
        targetId: userId,
        details: { email: verifiedEmail, googleId: verifiedGoogleId },
      });
    } else {
      profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as any;
      if (!profile) {
        const profileId = uuidv4();
        db.prepare(`
          INSERT INTO profiles (id, user_id, display_name, avatar_url, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'unverified', 0, 0, 0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(profileId, user.id, verifiedName || user.username || 'Player', verifiedPicture || null);
        profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
      }
    }

    const { accessToken, refreshToken } = this.generateTokenPair(user);
    return { accessToken, refreshToken, user, profile };
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
