import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { BookingService } from './booking.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const teammateSchema = z.object({
  ffUid: z.string().min(3).max(25),
  ffIgn: z.string().min(1).max(35),
  role: z.string().optional(),
  phone: z.string().optional(),
});

const bookSlotSchema = z.object({
  slotNumber: z.number().int().min(1).max(100).optional(),
  slotNumbers: z.array(z.number().int().min(1).max(100)).min(1).max(4).optional(),
  teamName: z.string().max(40).optional(),
  teammates: z.array(teammateSchema).optional(),
}).refine(data => data.slotNumber !== undefined || (data.slotNumbers !== undefined && data.slotNumbers.length > 0), {
  message: 'At least one slot number must be selected.',
});

export class BookingController {
  public static async getSlotGrid(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUserId = req.user?.userId;
      const grid = await BookingService.getSlotGrid(tournamentId, currentUserId);
      res.status(200).json({ success: true, data: grid });
    } catch (err) {
      next(err);
    }
  }

  public static async bookSlot(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parsed = bookSlotSchema.parse(req.body);

      const entry = await BookingService.bookSlot(userId, {
        tournamentId,
        slotNumber: parsed.slotNumber,
        slotNumbers: parsed.slotNumbers,
        teamName: parsed.teamName,
        teammates: parsed.teammates,
      });

      const slotMsg = parsed.slotNumbers && parsed.slotNumbers.length > 1
        ? `Slots #${parsed.slotNumbers.join(', #')} booked successfully!`
        : `Slot #${parsed.slotNumber || parsed.slotNumbers?.[0]} booked successfully!`;

      res.status(201).json({
        success: true,
        message: slotMsg,
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async cancelBooking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await BookingService.cancelBooking(userId, tournamentId);
      res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully. Any entry fee paid has been refunded to your wallet.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMyBookings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const bookings = await BookingService.getMyBookings(userId);
      res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
      next(err);
    }
  }

  public static async getWalletBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const balance = BookingService.getUserWalletBalance(userId);
      res.status(200).json({ success: true, balance });
    } catch (err) {
      next(err);
    }
  }
}
