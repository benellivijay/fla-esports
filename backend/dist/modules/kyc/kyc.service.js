"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KYCService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../../database/db");
const crypto_1 = require("../../utils/crypto");
const logger_1 = require("../../utils/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
class KYCService {
    /**
     * Submit KYC details (PAN, Full Name, DOB, and Document)
     */
    static async submitKYC(userId, data) {
        const db = (0, db_1.getDb)();
        const cleanPan = data.panNumber.trim().toUpperCase();
        const cleanName = data.fullName.trim();
        // 1. Validate PAN format
        if (!crypto_1.CryptoUtil.isValidPAN(cleanPan)) {
            throw new error_middleware_1.AppError('Invalid PAN card number format. Expected format: ABCDE1234F', 400, 'INVALID_PAN_FORMAT');
        }
        // 2. Validate Age (Must be >= 18 years old)
        const birthDate = new Date(data.dob);
        if (isNaN(birthDate.getTime())) {
            throw new error_middleware_1.AppError('Invalid Date of Birth format (YYYY-MM-DD expected).', 400, 'INVALID_DOB');
        }
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        if (age < 18) {
            throw new error_middleware_1.AppError('Participants in paid esports tournaments must be at least 18 years of age.', 400, 'AGE_RESTRICTION');
        }
        // 3. Prevent duplicate PAN usage across different accounts
        const existingPAN = db.prepare(`
      SELECT user_id FROM kyc_records 
      WHERE pan_number = ? AND user_id != ? AND status IN ('verified', 'pending')
    `).get(cleanPan, userId);
        if (existingPAN) {
            throw new error_middleware_1.AppError('This PAN number is already registered to another account.', 409, 'DUPLICATE_PAN');
        }
        // Check if user already submitted KYC
        const existingUserKYC = db.prepare('SELECT * FROM kyc_records WHERE user_id = ?').get(userId);
        if (existingUserKYC && existingUserKYC.status === 'verified') {
            throw new error_middleware_1.AppError('Your KYC is already verified.', 400, 'KYC_ALREADY_VERIFIED');
        }
        if (existingUserKYC) {
            // Update existing record
            db.prepare(`
        UPDATE kyc_records 
        SET pan_number = ?, full_name = ?, dob = ?, document_url = ?, status = 'pending', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `).run(cleanPan, cleanName, data.dob, data.documentUrl || null, userId);
        }
        else {
            // Insert new record
            const kycId = (0, uuid_1.v4)();
            db.prepare(`
        INSERT INTO kyc_records (id, user_id, pan_number, full_name, dob, document_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(kycId, userId, cleanPan, cleanName, data.dob, data.documentUrl || null);
        }
        logger_1.Logger.audit({
            actorId: userId,
            action: 'KYC_SUBMITTED',
            targetResource: 'kyc_records',
            targetId: userId,
            details: { panNumber: `${cleanPan.slice(0, 2)}***${cleanPan.slice(-2)}`, fullName: cleanName },
        });
        return db.prepare('SELECT * FROM kyc_records WHERE user_id = ?').get(userId);
    }
    /**
     * Get KYC details for current user
     */
    static async getKYCStatus(userId) {
        const db = (0, db_1.getDb)();
        const record = db.prepare('SELECT * FROM kyc_records WHERE user_id = ?').get(userId);
        return record || null;
    }
}
exports.KYCService = KYCService;
