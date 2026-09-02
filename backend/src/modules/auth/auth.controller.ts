import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const sendOtpSchema = z.object({
  identifier: z.string().min(3, 'Identifier is required'),
  type: z.enum(['phone', 'email']),
});

const verifyOtpSchema = z.object({
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

const googleSignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  googleId: z.string().optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token required'),
});

export class AuthController {
  public static async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, type } = sendOtpSchema.parse(req.body);
      const result = await AuthService.sendOtp(identifier, type);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, otpCode, type, name } = verifyOtpSchema.parse(req.body);
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
        message: `${type === 'phone' ? 'Phone' : 'Email'} verified successfully.${result.kycVerified ? ' KYC is now fully verified!' : ''}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async googleSignIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = googleSignInSchema.parse(req.body);
      const result = await AuthService.googleSignIn(payload);
      res.status(200).json({
        success: true,
        message: 'Google authentication successful.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

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

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
      res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async testEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const to = (req.query.to as string || 'flaadmin40@gmail.com').trim();
      const sent = await EmailService.sendOtpEmail(to, '888888');
      res.status(200).json({
        success: sent,
        recipient: to,
        message: sent ? 'Test OTP email sent successfully!' : 'Failed to send test OTP email.',
      });
    } catch (err) {
      next(err);
    }
  }
}
