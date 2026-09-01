import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { KYCService } from './kyc.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const submitKYCSchema = z.object({
  panNumber: z.string().min(10).max(10),
  fullName: z.string().min(3).max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
  documentUrl: z.string().optional(),
});

export class KYCController {
  public static async submitKYC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      let documentUrl: string | undefined;

      if (req.file) {
        documentUrl = `/uploads/${req.file.filename}`;
      } else if (req.body.documentUrl) {
        documentUrl = req.body.documentUrl;
      }

      const parsed = submitKYCSchema.parse({
        panNumber: req.body.panNumber,
        fullName: req.body.fullName,
        dob: req.body.dob,
        documentUrl,
      });

      const record = await KYCService.submitKYC(userId, parsed);
      res.status(200).json({
        success: true,
        message: 'KYC documents submitted successfully. Verification is in progress.',
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getKYCStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const record = await KYCService.getKYCStatus(userId);
      res.status(200).json({
        success: true,
        data: record || { status: 'not_submitted' },
      });
    } catch (err) {
      next(err);
    }
  }
}
