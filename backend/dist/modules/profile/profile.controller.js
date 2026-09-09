"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const zod_1 = require("zod");
const profile_service_1 = require("./profile.service");
const error_middleware_1 = require("../../middleware/error.middleware");
const updateProfileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(2).max(30).optional(),
    avatarUrl: zod_1.z.string().url().optional(),
});
const initiateFFSchema = zod_1.z.object({
    ffUid: zod_1.z.string().min(5, 'Free Fire UID must be at least 5 characters').max(15),
    ffIgn: zod_1.z.string().min(2, 'In-game nickname is required').max(30),
});
class ProfileController {
    static async getProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const data = await profile_service_1.ProfileService.getProfile(userId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async updateProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const parsed = updateProfileSchema.parse(req.body);
            const updated = await profile_service_1.ProfileService.updateProfile(userId, parsed);
            res.status(200).json({ success: true, message: 'Profile updated successfully.', data: updated });
        }
        catch (err) {
            next(err);
        }
    }
    static async initiateFFVerification(req, res, next) {
        try {
            const userId = req.user.userId;
            const { ffUid, ffIgn } = initiateFFSchema.parse(req.body);
            const challenge = await profile_service_1.ProfileService.initiateFFVerification(userId, ffUid, ffIgn);
            res.status(200).json({
                success: true,
                message: 'Verification challenge generated.',
                data: challenge,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async submitFFProof(req, res, next) {
        try {
            const userId = req.user.userId;
            let proofUrl;
            if (req.file) {
                proofUrl = `/uploads/${req.file.filename}`;
            }
            else if (req.body.proofUrl) {
                proofUrl = req.body.proofUrl;
            }
            if (!proofUrl) {
                throw new error_middleware_1.AppError('Please provide a proof screenshot file or URL.', 400);
            }
            const result = await profile_service_1.ProfileService.submitFFProofScreenshot(userId, proofUrl);
            res.status(200).json({ success: true, ...result });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ProfileController = ProfileController;
