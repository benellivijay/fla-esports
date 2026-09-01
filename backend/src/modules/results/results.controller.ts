import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ResultsService } from './results.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const submitResultSchema = z.object({
  claimedRank: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)),
  claimedKills: z.preprocess((val) => Number(val), z.number().int().min(0).max(100)),
  screenshotUrl: z.string().optional(),
});

const reviewResultSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  confirmedRank: z.number().int().min(1).max(100).optional(),
  confirmedKills: z.number().int().min(0).max(100).optional(),
  rejectionReason: z.string().max(200).optional(),
});

export class ResultsController {
  public static async submitResult(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parsed = submitResultSchema.parse(req.body);

      // Support either direct file upload via Multer or direct screenshot URL
      let screenshotUrl = parsed.screenshotUrl;
      if (req.file) {
        screenshotUrl = `/uploads/${req.file.filename}`;
      }

      if (!screenshotUrl) {
        throw new AppError('Match end screenshot proof is required.', 400);
      }

      const result = await ResultsService.submitResult(userId, {
        tournamentId,
        claimedRank: parsed.claimedRank,
        claimedKills: parsed.claimedKills,
        screenshotUrl,
      });

      res.status(201).json({
        success: true,
        message: 'Match result submitted successfully. Awaiting moderator review.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getUserSubmission(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const submission = await ResultsService.getUserSubmission(userId, tournamentId);
      res.status(200).json({ success: true, data: submission });
    } catch (err) {
      next(err);
    }
  }

  public static async getAdminQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = req.query.tournamentId as string | undefined;
      const status = req.query.status as any | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const queueData = await ResultsService.getAdminQueue({ tournamentId, status, page, limit });
      res.status(200).json({ success: true, data: queueData });
    } catch (err) {
      next(err);
    }
  }

  public static async reviewResult(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.userId;
      const resultId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parsed = reviewResultSchema.parse(req.body);

      const updatedResult = await ResultsService.reviewResult(adminUserId, resultId, parsed);
      res.status(200).json({
        success: true,
        message: `Match result claim ${parsed.decision} successfully.`,
        data: updatedResult,
      });
    } catch (err) {
      next(err);
    }
  }
}
