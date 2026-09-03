import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { EmailService } from '../../services/email.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const signInSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().max(60).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().min(4, 'Code is required').max(10),
});

const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const googleSignInSchema = z.object({
  idToken: z.string().nullish(),
  email: z.string().email('Invalid email address').nullish(),
  name: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  googleId: z.string().nullish(),
  username: z.string().min(3).max(30).nullish(),
  checkOnly: z.boolean().nullish(),
});

const legacySendOtpSchema = z.object({
  identifier: z.string().min(3, 'Identifier is required'),
  type: z.enum(['phone', 'email']),
});

const legacyVerifyOtpSchema = z.object({
  identifier: z.string().min(3, 'Identifier is required'),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
  type: z.enum(['phone', 'email']),
  name: z.string().optional(),
});

const verifySecondarySchema = z.object({
  identifier: z.string().min(3, 'Identifier is required'),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
  type: z.enum(['phone', 'email']),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token required'),
});

export class AuthController {
  /**
   * POST /auth/signin
   */
  public static async signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, password } = signInSchema.parse(req.body);
      const result = await AuthService.signIn(identifier, password);
      res.status(200).json({
        success: true,
        message: 'Signed in successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/register
   */
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, username, email, password } = registerSchema.parse(req.body);
      const result = await AuthService.register(username, email, password, name);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/verify-otp
   */
  public static async verifyRegistrationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyRegistrationOtp(email, code);
      res.status(200).json({
        success: true,
        message: 'Account created and verified successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/resend-otp
   */
  public static async resendRegistrationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = resendOtpSchema.parse(req.body);
      const result = await AuthService.resendRegistrationOtp(email);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/google
   */
  public static async googleSignIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = googleSignInSchema.parse(req.body);
      const result = await AuthService.googleAuth(payload);
      res.status(200).json({
        success: true,
        message: 'Google authentication successful.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /auth/check-username?username=xyz
   */
  public static async checkUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = (req.query.username as string) || (req.body.username as string) || '';
      const result = await AuthService.checkUsername(username);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/refresh
   */
  public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const tokens = await AuthService.refreshToken(refreshToken);
      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully.',
        data: tokens,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      await AuthService.logout(refreshToken);
      res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Legacy endpoints
   */
  public static async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, type } = legacySendOtpSchema.parse(req.body);
      const result = await AuthService.sendOtp(identifier, type);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, otpCode, type, name } = legacyVerifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyOtp(identifier, otpCode, type === 'phone', name);
      res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async verifySecondary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { identifier, otpCode, type } = verifySecondarySchema.parse(req.body);
      const result = await AuthService.verifySecondaryIdentifier(userId, identifier, otpCode, type);
      res.status(200).json({
        success: true,
        message: (type === 'phone' ? 'Phone' : 'Email') + ' verified successfully.' + (result.kycVerified ? ' KYC is now fully verified!' : ''),
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async testEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const to = (req.query.to as string) || 'flaadmin40@gmail.com';
      const testCode = '888888';
      const success = await EmailService.sendOtpEmail(to, testCode);
      res.status(200).json({
        success,
        message: success ? 'Test email dispatched to ' + to : 'Failed to dispatch test email to ' + to,
      });
    } catch (err) {
      next(err);
    }
  }
}
