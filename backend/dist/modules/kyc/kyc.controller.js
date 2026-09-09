"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KYCController = void 0;
const zod_1 = require("zod");
const kyc_service_1 = require("./kyc.service");
const submitKYCSchema = zod_1.z.object({
    panNumber: zod_1.z.string().min(10).max(10),
    fullName: zod_1.z.string().min(3).max(100),
    dob: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
    documentUrl: zod_1.z.string().optional(),
});
class KYCController {
    static async submitKYC(req, res, next) {
        try {
            const userId = req.user.userId;
            let documentUrl;
            if (req.file) {
                documentUrl = `/uploads/${req.file.filename}`;
            }
            else if (req.body.documentUrl) {
                documentUrl = req.body.documentUrl;
            }
            const parsed = submitKYCSchema.parse({
                panNumber: req.body.panNumber,
                fullName: req.body.fullName,
                dob: req.body.dob,
                documentUrl,
            });
            const record = await kyc_service_1.KYCService.submitKYC(userId, parsed);
            res.status(200).json({
                success: true,
                message: 'KYC documents submitted successfully. Verification is in progress.',
                data: record,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getKYCStatus(req, res, next) {
        try {
            const userId = req.user.userId;
            const record = await kyc_service_1.KYCService.getKYCStatus(userId);
            res.status(200).json({
                success: true,
                data: record || { status: 'not_submitted' },
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.KYCController = KYCController;
