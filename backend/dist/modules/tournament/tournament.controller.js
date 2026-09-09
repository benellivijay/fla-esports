"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TournamentController = void 0;
const zod_1 = require("zod");
const tournament_service_1 = require("./tournament.service");
const prizeItemSchema = zod_1.z.object({
    rank: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    amount: zod_1.z.number().min(0),
    percentage: zod_1.z.number().optional(),
});
const createTournamentSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100),
    description: zod_1.z.string().optional(),
    game: zod_1.z.string().default('Free Fire'),
    game_mode: zod_1.z.enum(['ff_max', 'survival', 'free_match', 'lone_wolf', 'headshot_only', 'one_tap', 'sniper_1v1', 'lone_wolf_headshot']).optional(),
    gameMode: zod_1.z.enum(['ff_max', 'survival', 'free_match', 'lone_wolf', 'headshot_only', 'one_tap', 'sniper_1v1', 'lone_wolf_headshot']).optional(),
    mode: zod_1.z.enum(['solo', 'duo', 'squad']),
    map: zod_1.z.enum(['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra']),
    entryType: zod_1.z.enum(['free', 'paid']),
    entryFee: zod_1.z.number().min(0).default(0),
    prizePool: zod_1.z.number().min(0),
    prizeDistribution: zod_1.z.array(prizeItemSchema).default([]),
    perKillPrize: zod_1.z.number().min(0).default(0),
    maxSlots: zod_1.z.number().int().min(2).max(100),
    startTime: zod_1.z.string(),
    registrationClosesAt: zod_1.z.string().optional(),
    roomRevealTimeMinutes: zod_1.z.number().int().min(1).max(60).default(15),
    roomId: zod_1.z.string().optional(),
    roomPassword: zod_1.z.string().optional(),
    bannerUrl: zod_1.z.string().optional(),
    rules: zod_1.z.string().optional(),
});
const updateTournamentSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100).optional(),
    description: zod_1.z.string().optional(),
    game_mode: zod_1.z.enum(['ff_max', 'survival', 'free_match', 'lone_wolf', 'headshot_only', 'one_tap', 'sniper_1v1', 'lone_wolf_headshot']).optional(),
    gameMode: zod_1.z.enum(['ff_max', 'survival', 'free_match', 'lone_wolf', 'headshot_only', 'one_tap', 'sniper_1v1', 'lone_wolf_headshot']).optional(),
    mode: zod_1.z.enum(['solo', 'duo', 'squad']).optional(),
    map: zod_1.z.enum(['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra']).optional(),
    entryType: zod_1.z.enum(['free', 'paid']).optional(),
    entryFee: zod_1.z.number().min(0).optional(),
    prizePool: zod_1.z.number().min(0).optional(),
    prizeDistribution: zod_1.z.array(prizeItemSchema).optional(),
    perKillPrize: zod_1.z.number().min(0).optional(),
    maxSlots: zod_1.z.number().int().min(2).max(100).optional(),
    startTime: zod_1.z.string().optional(),
    registrationClosesAt: zod_1.z.string().optional(),
    roomRevealTimeMinutes: zod_1.z.number().int().min(1).max(60).optional(),
    roomId: zod_1.z.string().optional(),
    roomPassword: zod_1.z.string().optional(),
    status: zod_1.z.enum(['upcoming', 'open', 'ongoing', 'completed', 'cancelled']).optional(),
    bannerUrl: zod_1.z.string().optional(),
    rules: zod_1.z.string().optional(),
});
const roomCredentialsSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1, 'Room ID is required'),
    roomPassword: zod_1.z.string().optional(),
    forceUpdateAfterStart: zod_1.z.boolean().optional(),
});
class TournamentController {
    static async listTournaments(req, res, next) {
        try {
            const filters = {
                game: req.query.game,
                game_mode: (req.query.game_mode || req.query.gameMode),
                mode: req.query.mode,
                map: req.query.map,
                entryType: req.query.entryType,
                status: req.query.status,
                search: req.query.search,
                limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
                offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
            };
            const userRole = req.user?.role;
            const data = await tournament_service_1.TournamentService.listTournaments(filters, userRole);
            res.status(200).json({ success: true, ...data });
        }
        catch (err) {
            next(err);
        }
    }
    static async getGameModeStats(req, res, next) {
        try {
            const stats = await tournament_service_1.TournamentService.getGameModeStats();
            res.status(200).json({ success: true, stats });
        }
        catch (err) {
            next(err);
        }
    }
    static async getTournamentById(req, res, next) {
        try {
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const userRole = req.user?.role;
            const tournament = await tournament_service_1.TournamentService.getTournamentById(tournamentId, userRole);
            res.status(200).json({ success: true, data: tournament });
        }
        catch (err) {
            next(err);
        }
    }
    static async createTournament(req, res, next) {
        try {
            const adminId = req.user.userId;
            const parsed = createTournamentSchema.parse(req.body);
            const tournament = await tournament_service_1.TournamentService.createTournament(adminId, parsed);
            res.status(201).json({
                success: true,
                message: 'Tournament created successfully.',
                data: tournament,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async updateTournament(req, res, next) {
        try {
            const adminId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const parsed = updateTournamentSchema.parse(req.body);
            const tournament = await tournament_service_1.TournamentService.updateTournament(adminId, tournamentId, parsed);
            res.status(200).json({
                success: true,
                message: 'Tournament updated successfully.',
                data: tournament,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async updateRoomCredentials(req, res, next) {
        try {
            const adminId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { roomId, roomPassword, forceUpdateAfterStart } = roomCredentialsSchema.parse(req.body);
            const data = await tournament_service_1.TournamentService.updateRoomCredentials(adminId, tournamentId, { roomId, roomPassword, forceUpdateAfterStart });
            res.status(200).json({
                success: true,
                message: 'Room credentials updated successfully.',
                data,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async cancelTournament(req, res, next) {
        try {
            const adminId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { reason } = req.body;
            await tournament_service_1.TournamentService.cancelTournament(adminId, tournamentId, reason);
            res.status(200).json({
                success: true,
                message: 'Tournament cancelled successfully.',
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async deleteTournament(req, res, next) {
        try {
            const adminId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await tournament_service_1.TournamentService.deleteTournament(adminId, tournamentId);
            res.status(200).json({
                success: true,
                message: 'Tournament deleted successfully.',
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.TournamentController = TournamentController;
