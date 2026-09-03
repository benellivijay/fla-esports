import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { getDb } from './database/db';
import { authRoutes } from './modules/auth/auth.routes';
import { profileRoutes } from './modules/profile/profile.routes';
import { kycRoutes } from './modules/kyc/kyc.routes';
import { tournamentRoutes } from './modules/tournament/tournament.routes';
import { bookingRoutes } from './modules/booking/booking.routes';
import { roomRoutes } from './modules/room/room.routes';
import { tournamentResultRoutes, adminResultRoutes } from './modules/results/results.routes';
import { payoutRoutes } from './modules/payout/payout.routes';
import { userWithdrawalRoutes, adminWithdrawalRoutes } from './modules/withdrawal/withdrawal.routes';
import { notificationRoutes, adminNotificationRoutes } from './modules/notifications/notification.routes';
import { walletRoutes } from './modules/wallet/wallet.routes';
import { supportRoutes } from './modules/support/support.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { RoomRevealWorker } from './modules/scheduler/room_reveal.worker';
import { errorHandler } from './middleware/error.middleware';
import { Logger } from './utils/logger';

export const createApp = () => {
  const app = express();

  // Basic security and parsing
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static uploads directory for screenshot and proof access
  app.use('/uploads', express.static(config.uploads.directory));

  // Global rate limiter
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  });
  app.use('/api/', globalLimiter);

  // Root Welcome Endpoint
  app.get('/', (_req, res) => {
    res.status(200).json({
      service: 'FLA ESPORTS Tournament API',
      status: 'online',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        api: '/api/v1',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'FLA ESPORTS Tournament API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/kyc', kycRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/wallet/withdraw', userWithdrawalRoutes);
  app.use('/api/v1/wallet', walletRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/tournaments', payoutRoutes);
  app.use('/api/v1/tournaments', tournamentResultRoutes);
  app.use('/api/v1/tournaments', roomRoutes);
  app.use('/api/v1/tournaments', bookingRoutes);
  app.use('/api/v1/tournaments', tournamentRoutes);
  app.use('/api/v1/admin/notifications', adminNotificationRoutes);
  app.use('/api/v1/admin/withdrawals', adminWithdrawalRoutes);
  app.use('/api/v1/admin/results', adminResultRoutes);
  app.use('/api/v1/admin', adminRoutes);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};

if (require.main === module) {
  // Initialize Database on startup
  getDb();
  
  // Start background room reveal scheduled worker
  RoomRevealWorker.start(30000);

  const app = createApp();
  app.listen(config.port, () => {
    Logger.info(`🚀 FLA ESPORTS API server running at http://localhost:${config.port}`);
    Logger.info(`Environment: ${config.nodeEnv}`);
  });
}
