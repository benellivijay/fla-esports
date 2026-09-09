"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'ff_esports_super_secret_access_jwt_key_2026',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'ff_esports_super_secret_refresh_jwt_key_2026',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30d',
        refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '90', 10),
    },
    db: {
        filename: process.env.DB_FILENAME || path_1.default.resolve(__dirname, '../../data/ff_esports.db'),
    },
    otp: {
        expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
        maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
        mockDefaultOtp: process.env.NODE_ENV === 'production' ? null : '123456',
    },
    uploads: {
        directory: path_1.default.resolve(__dirname, '../../uploads'),
        maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '779800067040-holg1ss8c8ipiesdb9kkubih7d3vs0o7.apps.googleusercontent.com',
    },
};
