import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'ff_esports_super_secret_access_jwt_key_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'ff_esports_super_secret_refresh_jwt_key_2026',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '30', 10),
  },
  db: {
    filename: process.env.DB_FILENAME || path.resolve(__dirname, '../../data/ff_esports.db'),
  },
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    mockDefaultOtp: process.env.NODE_ENV === 'production' ? null : '123456',
  },
  uploads: {
    directory: path.resolve(__dirname, '../../uploads'),
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '779800067040-holg1ss8c8ipiesdb9kkubih7d3vs0o7.apps.googleusercontent.com',
  },
};
