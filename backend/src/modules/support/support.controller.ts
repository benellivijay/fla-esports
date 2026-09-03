import { Request, Response, NextFunction } from 'express';
import { SupportService } from './support.service';
import { z } from 'zod';

const createTicketSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Valid email is required'),
  category: z.string().min(1, 'Category is required'),
  referenceId: z.string().optional(),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  description: z.string().min(10, 'Please provide more details (at least 10 characters)'),
});

export class SupportController {
  public static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createTicketSchema.parse(req.body);
      const userId = (req as any).user?.id;

      const ticket = await SupportService.createTicket({
        userId,
        username: parsed.username,
        email: parsed.email,
        category: parsed.category,
        referenceId: parsed.referenceId,
        subject: parsed.subject,
        description: parsed.description,
      });

      res.status(201).json({
        success: true,
        message: 'Support ticket raised successfully. Our team will review it shortly.',
        data: {
          ticket,
          discordUrl: SupportService.DISCORD_URL,
          supportEmail: SupportService.SUPPORT_EMAIL,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const email = user?.email || (req.query.email as string);

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email identifier required.' });
      }

      const tickets = await SupportService.getUserTickets(email, user?.id);
      res.status(200).json({
        success: true,
        data: { tickets },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSupportInfo(_req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        discordUrl: SupportService.DISCORD_URL,
        supportEmail: SupportService.SUPPORT_EMAIL,
        categories: [
          'Payment & Wallet Deposit',
          'Match Room & Slot Issue',
          'Prize & Withdrawal Query',
          'Hacking & Fair Play Report',
          'Account & KYC Verification',
          'Other / General Inquiry',
        ],
      },
    });
  }
}
