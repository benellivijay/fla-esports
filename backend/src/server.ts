import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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
import { AdminController } from './modules/admin/admin.controller';
import { RoomRevealWorker } from './modules/scheduler/room_reveal.worker';
import { GDriveTournamentStore } from './services/gdrive_tournament_store.service';
import { GDriveAuthStore } from './services/gdrive_auth_store.service';
import { errorHandler } from './middleware/error.middleware';
import { Logger } from './utils/logger';

// Locate static admin dashboard directory
function getPublicDir(): string {
  const possibleDirs = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../../public'),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'backend/public'),
    path.join(process.cwd(), 'admin_dashboard/out'),
    path.join(__dirname, '../../admin_dashboard/out'),
    path.join(process.cwd(), 'dist'),
  ];

  for (const dir of possibleDirs) {
    if (fs.existsSync(dir) && (fs.existsSync(path.join(dir, 'index.html')) || fs.existsSync(path.join(dir, 'login.html')) || fs.existsSync(path.join(dir, 'login/index.html')))) {
      return dir;
    }
  }
  return path.join(process.cwd(), 'public');
}

export const createApp = () => {
  const app = express();
  const publicDir = getPublicDir();
  // Enable trust proxy for Render, Cloudflare, and cloud load balancers
  app.set('trust proxy', 1);

  // Basic security and parsing
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static uploads directory for screenshot and proof access
  app.use('/uploads', express.static(config.uploads.directory));

  // Global rate limiter for API endpoints (generous limit + bypass for admin / heartbeats)
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for admin dashboard API routes, device heartbeat pings, and health check
      const path = req.path || req.originalUrl || '';
      return (
        path.startsWith('/api/v1/admin') ||
        path.startsWith('/api/v1/analytics') ||
        path.startsWith('/health') ||
        req.ip === '127.0.0.1' ||
        req.ip === '::1'
      );
    },
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  });
  app.use('/api/', globalLimiter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'FLA ESPORTS Tournament API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Public Privacy Policy & Terms of Service for Google OAuth & app compliance
  app.get('/privacy', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><head><title>Privacy Policy - FLA Esports</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#333;"><h1>Privacy Policy</h1><p>Last updated: September 2026</p><p>FLA Esports ("we", "our") respects your privacy. We collect your email and gaming handle solely to facilitate tournament matchmaking, room allocation, and prize distribution. We never sell your personal data to third parties.</p><p>Contact: flaadmin40@gmail.com</p></body></html>`);
  });

  app.get('/terms', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><head><title>Terms of Service - FLA Esports</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#333;"><h1>Terms of Service</h1><p>Last updated: September 2026</p><p>By participating in tournaments on FLA Esports, players agree to follow fair play guidelines, refrain from emulators/hacks, and adhere to tournament rules.</p><p>Contact: flaadmin40@gmail.com</p></body></html>`);
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
  app.post('/api/v1/analytics/device-heartbeat', AdminController.recordDeviceHeartbeat);
  app.use('/api/v1/admin', adminRoutes);

  // Serve Next.js static pages for HTML routes (/login, /staff, /tournaments, etc.)
  app.get('*', (req, res, next) => {
    // Skip API, uploads, or health endpoints
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health') {
      return next();
    }

    const cleanPath = req.path.replace(/^\/+|\/+$/g, '');

    // 1. Root dashboard /
    if (!cleanPath) {
      const indexFile = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
      }
      return res.status(200).json({
        success: true,
        service: 'FLA ESPORTS Backend API',
        status: 'online',
        timestamp: new Date().toISOString(),
        message: 'Backend API is operational. Admin Dashboard is hosted on Netlify.',
      });
    }


    // Skip static assets with extensions (e.g. .js, .css, .png, .ico, .txt, .map)
    if (/\.[a-zA-Z0-9]+$/.test(cleanPath)) {
      return next();
    }

    // 2. Specific HTML page (e.g. /login, /staff, /tournaments, /results, /deposits, /payouts, /wallet, /users, /audit-logs)
    const candidates = [
      path.join(publicDir, `${cleanPath}.html`),
      path.join(publicDir, cleanPath, 'index.html'),
      path.join(publicDir, `${cleanPath}/index.html`),
    ];

    for (const file of candidates) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return res.sendFile(file);
      }
    }

    // 3. Fallback to index.html for client-side routing
    const fallbackIndex = path.join(publicDir, 'index.html');
    if (fs.existsSync(fallbackIndex)) {
      return res.sendFile(fallbackIndex);
    }

    next();
  });

  // Static Next.js dashboard assets (_next, images, css, etc.)
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // 404 Handler for undefined API routes
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
  
  // Initialize Google Drive Auth & Player Store for persistent cloud recovery
  GDriveAuthStore.initStore().catch((err) => {
    Logger.error(`[SERVER] Failed to initialize GDriveAuthStore: ${err.message}`);
  });

  // Initialize Google Drive Tournament Store for persistent cloud recovery
  GDriveTournamentStore.initStore().catch((err) => {
    Logger.error(`[SERVER] Failed to initialize GDriveTournamentStore: ${err.message}`);
  });

  // Start background room reveal scheduled worker
  RoomRevealWorker.start(30000);

  const app = createApp();
  app.listen(config.port, () => {
    Logger.info(`🚀 FLA ESPORTS API server running at http://localhost:${config.port}`);
    Logger.info(`Environment: ${config.nodeEnv}`);
  });
}
