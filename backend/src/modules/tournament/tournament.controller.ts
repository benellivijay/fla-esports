import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TournamentService } from './tournament.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const prizeItemSchema = z.object({
  rank: z.union([z.number(), z.string()]),
  amount: z.number().min(0),
  percentage: z.number().optional(),
});

const createTournamentSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  game: z.string().default('Free Fire'),
  mode: z.enum(['solo', 'duo', 'squad']),
  map: z.enum(['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra']),
  entryType: z.enum(['free', 'paid']),
  entryFee: z.number().min(0).default(0),
  prizePool: z.number().min(0),
  prizeDistribution: z.array(prizeItemSchema).default([]),
  perKillPrize: z.number().min(0).default(0),
  maxSlots: z.number().int().min(2).max(100),
  startTime: z.string(),
  registrationClosesAt: z.string().optional(),
  roomRevealTimeMinutes: z.number().int().min(1).max(60).default(15),
  roomId: z.string().optional(),
  roomPassword: z.string().optional(),
  bannerUrl: z.string().optional(),
  rules: z.string().optional(),
});

const updateTournamentSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().optional(),
  mode: z.enum(['solo', 'duo', 'squad']).optional(),
  map: z.enum(['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra']).optional(),
  entryType: z.enum(['free', 'paid']).optional(),
  entryFee: z.number().min(0).optional(),
  prizePool: z.number().min(0).optional(),
  prizeDistribution: z.array(prizeItemSchema).optional(),
  perKillPrize: z.number().min(0).optional(),
  maxSlots: z.number().int().min(2).max(100).optional(),
  startTime: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  roomRevealTimeMinutes: z.number().int().min(1).max(60).optional(),
  roomId: z.string().optional(),
  roomPassword: z.string().optional(),
  status: z.enum(['upcoming', 'open', 'ongoing', 'completed', 'cancelled']).optional(),
  bannerUrl: z.string().optional(),
  rules: z.string().optional(),
});

const roomCredentialsSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  roomPassword: z.string().optional(),
  forceUpdateAfterStart: z.boolean().optional(),
});

export class TournamentController {
  public static async listTournaments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        game: req.query.game as string | undefined,
        mode: req.query.mode as string | undefined,
        map: req.query.map as string | undefined,
        entryType: req.query.entryType as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const userRole = req.user?.role;
      const data = await TournamentService.listTournaments(filters, userRole);
      res.status(200).json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  public static async getTournamentById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const userRole = req.user?.role;
      const tournament = await TournamentService.getTournamentById(tournamentId, userRole);
      res.status(200).json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  }

  public static async createTournament(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const parsed = createTournamentSchema.parse(req.body);
      const tournament = await TournamentService.createTournament(adminId, parsed);
      res.status(201).json({
        success: true,
        message: 'Tournament created successfully.',
        data: tournament,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateTournament(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parsed = updateTournamentSchema.parse(req.body);
      const tournament = await TournamentService.updateTournament(adminId, tournamentId, parsed);
      res.status(200).json({
        success: true,
        message: 'Tournament updated successfully.',
        data: tournament,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateRoomCredentials(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { roomId, roomPassword, forceUpdateAfterStart } = roomCredentialsSchema.parse(req.body);
      const data = await TournamentService.updateRoomCredentials(adminId, tournamentId, { roomId, roomPassword, forceUpdateAfterStart });
      res.status(200).json({
        success: true,
        message: 'Room credentials updated successfully.',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async cancelTournament(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { reason } = req.body;
      await TournamentService.cancelTournament(adminId, tournamentId, reason);
      res.status(200).json({
        success: true,
        message: 'Tournament cancelled successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}
