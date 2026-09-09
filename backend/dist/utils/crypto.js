"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoUtil = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class CryptoUtil {
    /**
     * Generates a 6-digit numeric OTP
     */
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    /**
     * Hashes an OTP code or secret with SHA-256
     */
    static hash(data) {
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Hashes a password using bcrypt
     */
    static hashPassword(password) {
        return bcryptjs_1.default.hashSync(password, 10);
    }
    /**
     * Compares plain password with bcrypt hash
     */
    static comparePassword(password, hash) {
        return bcryptjs_1.default.compareSync(password, hash);
    }
    /**
     * Generates a Base32 16-character TOTP secret key
     */
    static generateTOTPSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        const bytes = crypto_1.default.randomBytes(16);
        for (let i = 0; i < 16; i++) {
            secret += chars[bytes[i] % chars.length];
        }
        return secret;
    }
    /**
     * Verifies RFC 6238 standard TOTP 6-digit code against Base32 secret
     */
    static verifyTOTP(token, secret) {
        const cleanToken = token.trim();
        if (cleanToken.length !== 6)
            return false;
        try {
            const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let bits = '';
            for (let i = 0; i < secret.length; i++) {
                const val = base32chars.indexOf(secret.charAt(i).toUpperCase());
                if (val === -1)
                    continue;
                bits += val.toString(2).padStart(5, '0');
            }
            const bytes = [];
            for (let i = 0; i + 8 <= bits.length; i += 8) {
                bytes.push(parseInt(bits.substring(i, i + 8), 2));
            }
            const key = Buffer.from(bytes);
            const epoch = Math.floor(Date.now() / 1000);
            const timeStep = 30;
            const currentCounter = Math.floor(epoch / timeStep);
            // Check current window ± 1 step for clock drift
            for (let step = -1; step <= 1; step++) {
                const counter = currentCounter + step;
                const buf = Buffer.alloc(8);
                buf.writeBigInt64BE(BigInt(counter));
                const hmac = crypto_1.default.createHmac('sha1', key).update(buf).digest();
                const offset = hmac[hmac.length - 1] & 0xf;
                const code = (((hmac[offset] & 0x7f) << 24) |
                    ((hmac[offset + 1] & 0xff) << 16) |
                    ((hmac[offset + 2] & 0xff) << 8) |
                    (hmac[offset + 3] & 0xff)) % 1000000;
                if (code.toString().padStart(6, '0') === cleanToken) {
                    return true;
                }
            }
        }
        catch (_) { }
        return false;
    }
    /**
     * Generates RFC 6238 standard TOTP 6-digit code for a given Base32 secret
     */
    static generateTOTPCode(secret) {
        const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        for (let i = 0; i < secret.length; i++) {
            const val = base32chars.indexOf(secret.charAt(i).toUpperCase());
            if (val === -1)
                continue;
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
        const key = Buffer.from(bytes);
        const epoch = Math.floor(Date.now() / 1000);
        const counter = Math.floor(epoch / 30);
        const buf = Buffer.alloc(8);
        buf.writeBigInt64BE(BigInt(counter));
        const hmac = crypto_1.default.createHmac('sha1', key).update(buf).digest();
        const offset = hmac[hmac.length - 1] & 0xf;
        const code = (((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff)) % 1000000;
        return code.toString().padStart(6, '0');
    }
    /**
     * Generates a unique temporary verification challenge string for in-game Free Fire nickname verification
     */
    static generateFFChallenge() {
        const randomSuffix = Math.floor(10000 + Math.random() * 90000);
        return `FF_${randomSuffix}`;
    }
    /**
     * Validates Indian PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
     */
    static isValidPAN(pan) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(pan.toUpperCase().trim());
    }
    /**
     * Generates a secure random refresh token string
     */
    static generateRefreshTokenString() {
        return crypto_1.default.randomBytes(40).toString('hex');
    }
}
exports.CryptoUtil = CryptoUtil;
