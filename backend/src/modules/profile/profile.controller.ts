import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProfileService } from './profile.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(30).optional(),
  avatarUrl: z.string().url().optional(),
});

const initiateFFSchema = z.object({
  ffUid: z.string().min(5, 'Free Fire UID must be at least 5 characters').max(15),
  ffIgn: z.string().min(2, 'In-game nickname is required').max(30),
});

export class ProfileController {
  public static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await ProfileService.getProfile(userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parsed = updateProfileSchema.parse(req.body);
      const updated = await ProfileService.updateProfile(userId, parsed);
      res.status(200).json({ success: true, message: 'Profile updated successfully.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async initiateFFVerification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { ffUid, ffIgn } = initiateFFSchema.parse(req.body);
      const challenge = await ProfileService.initiateFFVerification(userId, ffUid, ffIgn);
      res.status(200).json({
        success: true,
        message: 'Verification challenge generated.',
        data: challenge,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async submitFFProof(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      let proofUrl: string | undefined;

      if (req.file) {
        proofUrl = `/uploads/${req.file.filename}`;
      } else if (req.body.proofUrl) {
        proofUrl = req.body.proofUrl;
      }

      if (!proofUrl) {
        throw new AppError('Please provide a proof screenshot file or URL.', 400);
      }

      const result = await ProfileService.submitFFProofScreenshot(userId, proofUrl);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}
