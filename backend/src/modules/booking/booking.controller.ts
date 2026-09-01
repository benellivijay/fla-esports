import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { BookingService } from './booking.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const teammateSchema = z.object({
  ffUid: z.string().min(5).max(15),
  ffIgn: z.string().min(2).max(30),
  phone: z.string().optional(),
});

const bookSlotSchema = z.object({
  slotNumber: z.number().int().min(1).max(100),
  teamName: z.string().max(40).optional(),
  teammates: z.array(teammateSchema).optional(),
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
        teamName: parsed.teamName,
        teammates: parsed.teammates,
      });

      res.status(201).json({
        success: true,
        message: `Slot #${parsed.slotNumber} booked successfully!`,
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
