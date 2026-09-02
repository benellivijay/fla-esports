import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
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
   * Generates and sends OTP for phone or email authentication
   */
  public static async sendOtp(identifier: string, type: 'phone' | 'email'): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDb();

    // Check recent OTP request within last 60 seconds (production only)
    if (config.nodeEnv === 'production') {
      const recentStmt = db.prepare(`
        SELECT * FROM otp_records 
        WHERE identifier = ? AND created_at > datetime('now', '-1 minute')
        ORDER BY created_at DESC LIMIT 1
      `);
      const recent = recentStmt.get(cleanIdentifier);
      if (recent) {
        throw new AppError('Please wait at least 1 minute before requesting a new OTP.', 429, 'OTP_RATE_LIMITED');
      }
    }

    // Use random 6-digit OTP for real delivery
    const otpCode = CryptoUtil.generateOTP();
    const otpHash = CryptoUtil.hash(otpCode);
    const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000).toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO otp_records (id, identifier, otp_hash, expires_at, attempts, verified, created_at)
      VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
    `);
    insertStmt.run(uuidv4(), cleanIdentifier, otpHash, expiresAt);

    Logger.info(`[AUTH] OTP generated for ${cleanIdentifier}`);
    console.log(`\n=================================================`);
    console.log(`  🔑 [OTP CODE] FOR ${cleanIdentifier}: ${otpCode}`);
    console.log(`=================================================\n`);

    // Real Delivery via SMS / Email (Non-blocking async dispatch)
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
      otp: otpCode,
      debugOtp: otpCode,
    };
  }

  /**
   * Verifies OTP, logs in or registers user, and generates auth tokens
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

    const otpStmt = db.prepare(`
      SELECT * FROM otp_records 
      WHERE identifier = ? AND verified = 0 AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `);
    const otpRecord = otpStmt.get(cleanIdentifier) as any;

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

    // Mark OTP as verified
    db.prepare('UPDATE otp_records SET verified = 1 WHERE id = ?').run(otpRecord.id);

    // Find or create user
    const userQuery = isPhone 
      ? db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanIdentifier) as any
      : db.prepare('SELECT * FROM users WHERE email = ?').get(cleanIdentifier) as any;

    let user: User;
    let profile: Profile;

    const customName = name && name.trim().length > 0 ? name.trim() : null;

    if (!userQuery) {
      // Create new user
      const userId = uuidv4();
      const insertUserStmt = db.prepare(`
        INSERT INTO users (id, phone, email, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
        VALUES (?, ?, ?, 'user', 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      insertUserStmt.run(
        userId,
        isPhone ? cleanIdentifier : null,
        !isPhone ? cleanIdentifier : null,
        isPhone ? 1 : 0,
        !isPhone ? 1 : 0
      );

      // Create initial profile with custom name if provided
      const defaultDisplayName = customName || `Player_${cleanIdentifier.slice(-4)}`;
      const profileId = uuidv4();
      const insertProfileStmt = db.prepare(`
        INSERT INTO profiles (id, user_id, display_name, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
        VALUES (?, ?, ?, 'unverified', 0, 0, 0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      insertProfileStmt.run(profileId, userId, defaultDisplayName);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;

      Logger.audit({
        actorId: userId,
        action: 'USER_REGISTERED',
        targetResource: 'users',
        targetId: userId,
        details: { identifier: cleanIdentifier, isPhone, displayName: defaultDisplayName },
      });
    } else {
      user = userQuery;
      // If custom name provided on login, update profile display name
      if (customName) {
        db.prepare('UPDATE profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(customName, user.id);
      }
      // If user exists and logging in again with phone/email, make sure verified flag is set
      if (isPhone && !user.is_phone_verified) {
        db.prepare('UPDATE users SET is_phone_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        user.is_phone_verified = 1 as any;
      } else if (!isPhone && !user.is_email_verified) {
        db.prepare('UPDATE users SET is_email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        user.is_email_verified = 1 as any;
      }
      profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as any;
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokenPair(user);

    return {
      accessToken,
      refreshToken,
      user,
      profile,
    };
  }

  /**
   * Verify and link secondary contact (e.g. verify email when already phone verified, or vice versa).
   * Once both phone and email are verified, KYC is marked verified!
   */
  public static async verifySecondaryIdentifier(userId: string, identifier: string, otpCode: string, type: 'phone' | 'email'): Promise<{
    user: User;
    kycVerified: boolean;
  }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDb();

    const otpStmt = db.prepare(`
      SELECT * FROM otp_records 
      WHERE identifier = ? AND verified = 0 AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `);
    const otpRecord = otpStmt.get(cleanIdentifier) as any;

    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP. Please request a new one.', 400, 'INVALID_OTP');
    }

    const providedHash = CryptoUtil.hash(otpCode.trim());
    if (providedHash !== otpRecord.otp_hash) {
      db.prepare('UPDATE otp_records SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      throw new AppError('Incorrect OTP code.', 400, 'INVALID_OTP');
    }

    // Mark OTP as verified
    db.prepare('UPDATE otp_records SET verified = 1 WHERE id = ?').run(otpRecord.id);

    // Check if identifier is already used by another user
    const existing = type === 'phone'
      ? db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(cleanIdentifier, userId)
      : db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanIdentifier, userId);

    if (existing) {
      throw new AppError(`This ${type} is already linked to another account.`, 409, 'IDENTIFIER_ALREADY_LINKED');
    }

    if (type === 'phone') {
      db.prepare(`
        UPDATE users 
        SET phone = ?, is_phone_verified = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(cleanIdentifier, userId);
    } else {
      db.prepare(`
        UPDATE users 
        SET email = ?, is_email_verified = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(cleanIdentifier, userId);
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const isPhoneVerified = updatedUser.is_phone_verified === 1;
    const isEmailVerified = updatedUser.is_email_verified === 1;
    const kycVerified = isPhoneVerified && isEmailVerified;

    Logger.audit({
      actorId: userId,
      action: kycVerified ? 'KYC_AUTOMATICALLY_VERIFIED' : `SECONDARY_${type.toUpperCase()}_VERIFIED`,
      targetResource: 'users',
      targetId: userId,
      details: { identifier: cleanIdentifier, type, kycVerified },
    });

    return {
      user: updatedUser,
      kycVerified,
    };
  }

  /**
   * Google Sign-in / SSO support
   */
  public static async googleSignIn(payload: { email: string; name?: string; avatarUrl?: string; googleId?: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    profile: Profile;
  }> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const db = getDb();

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;
    let profile: Profile;

    if (!user) {
      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, email, role, status, is_email_verified, created_at, updated_at)
        VALUES (?, ?, 'user', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(userId, cleanEmail);

      const profileId = uuidv4();
      db.prepare(`
        INSERT INTO profiles (id, user_id, display_name, avatar_url, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'unverified', 0, 0, 0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(profileId, userId, payload.name || `Player_${cleanEmail.split('@')[0]}`, payload.avatarUrl || null);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;

      Logger.audit({
        actorId: userId,
        action: 'USER_REGISTERED_GOOGLE',
        targetResource: 'users',
        targetId: userId,
        details: { email: cleanEmail },
      });
    } else {
      profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as any;
    }

    const { accessToken, refreshToken } = this.generateTokenPair(user);
    return { accessToken, refreshToken, user, profile };
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

    // Revoke current refresh token (Rotation)
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
