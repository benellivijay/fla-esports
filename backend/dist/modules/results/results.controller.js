"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultsController = void 0;
const zod_1 = require("zod");
const results_service_1 = require("./results.service");
const error_middleware_1 = require("../../middleware/error.middleware");
const submitResultSchema = zod_1.z.object({
    claimedRank: zod_1.z.preprocess((val) => Number(val), zod_1.z.number().int().min(1).max(100)),
    claimedKills: zod_1.z.preprocess((val) => Number(val), zod_1.z.number().int().min(0).max(100)),
    screenshotUrl: zod_1.z.string().optional(),
});
const reviewResultSchema = zod_1.z.object({
    decision: zod_1.z.enum(['approved', 'rejected']),
    confirmedRank: zod_1.z.number().int().min(1).max(100).optional(),
    confirmedKills: zod_1.z.number().int().min(0).max(100).optional(),
    rejectionReason: zod_1.z.string().max(200).optional(),
});
class ResultsController {
    static async submitResult(req, res, next) {
        try {
            const userId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const parsed = submitResultSchema.parse(req.body);
            // Support either direct file upload via Multer or direct screenshot URL
            let screenshotUrl = parsed.screenshotUrl;
            if (req.file) {
                screenshotUrl = `/uploads/${req.file.filename}`;
            }
            if (!screenshotUrl) {
                throw new error_middleware_1.AppError('Match end screenshot proof is required.', 400);
            }
            const result = await results_service_1.ResultsService.submitResult(userId, {
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
        }
        catch (err) {
            next(err);
        }
    }
    static async getUserSubmission(req, res, next) {
        try {
            const userId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const submission = await results_service_1.ResultsService.getUserSubmission(userId, tournamentId);
            res.status(200).json({ success: true, data: submission });
        }
        catch (err) {
            next(err);
        }
    }
    static async getAdminQueue(req, res, next) {
        try {
            const tournamentId = req.query.tournamentId;
            const status = req.query.status;
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '20', 10);
            const queueData = await results_service_1.ResultsService.getAdminQueue({ tournamentId, status, page, limit });
            res.status(200).json({ success: true, data: queueData });
        }
        catch (err) {
            next(err);
        }
    }
    static async reviewResult(req, res, next) {
        try {
            const adminUserId = req.user.userId;
            const resultId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const parsed = reviewResultSchema.parse(req.body);
            const updatedResult = await results_service_1.ResultsService.reviewResult(adminUserId, resultId, parsed);
            res.status(200).json({
                success: true,
                message: `Match result claim ${parsed.decision} successfully.`,
                data: updatedResult,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ResultsController = ResultsController;
