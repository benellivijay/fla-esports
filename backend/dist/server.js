"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const db_1 = require("./database/db");
const auth_routes_1 = require("./modules/auth/auth.routes");
const profile_routes_1 = require("./modules/profile/profile.routes");
const kyc_routes_1 = require("./modules/kyc/kyc.routes");
const tournament_routes_1 = require("./modules/tournament/tournament.routes");
const booking_routes_1 = require("./modules/booking/booking.routes");
const room_routes_1 = require("./modules/room/room.routes");
const results_routes_1 = require("./modules/results/results.routes");
const payout_routes_1 = require("./modules/payout/payout.routes");
const withdrawal_routes_1 = require("./modules/withdrawal/withdrawal.routes");
const notification_routes_1 = require("./modules/notifications/notification.routes");
const wallet_routes_1 = require("./modules/wallet/wallet.routes");
const support_routes_1 = require("./modules/support/support.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const admin_controller_1 = require("./modules/admin/admin.controller");
const room_reveal_worker_1 = require("./modules/scheduler/room_reveal.worker");
const gdrive_tournament_store_service_1 = require("./services/gdrive_tournament_store.service");
const gdrive_auth_store_service_1 = require("./services/gdrive_auth_store.service");
const error_middleware_1 = require("./middleware/error.middleware");
const logger_1 = require("./utils/logger");
// Locate static admin dashboard directory
function getPublicDir() {
    const possibleDirs = [
        path_1.default.join(__dirname, '../public'),
        path_1.default.join(__dirname, '../../public'),
        path_1.default.join(process.cwd(), 'public'),
        path_1.default.join(process.cwd(), 'backend/public'),
        path_1.default.join(process.cwd(), 'admin_dashboard/out'),
        path_1.default.join(__dirname, '../../admin_dashboard/out'),
        path_1.default.join(process.cwd(), 'dist'),
    ];
    for (const dir of possibleDirs) {
        if (fs_1.default.existsSync(dir) && (fs_1.default.existsSync(path_1.default.join(dir, 'index.html')) || fs_1.default.existsSync(path_1.default.join(dir, 'login.html')) || fs_1.default.existsSync(path_1.default.join(dir, 'login/index.html')))) {
            return dir;
        }
    }
    return path_1.default.join(process.cwd(), 'public');
}
const createApp = () => {
    const app = (0, express_1.default)();
    const publicDir = getPublicDir();
    // Enable trust proxy for Render, Cloudflare, and cloud load balancers
    app.set('trust proxy', 1);
    // Basic security and parsing
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Static uploads directory for screenshot and proof access
    app.use('/uploads', express_1.default.static(env_1.config.uploads.directory));
    // Global rate limiter for API endpoints (generous limit + bypass for admin / heartbeats)
    const globalLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 5000,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for admin dashboard API routes, device heartbeat pings, and health check
            const path = req.path || req.originalUrl || '';
            return (path.startsWith('/api/v1/admin') ||
                path.startsWith('/api/v1/analytics') ||
                path.startsWith('/health') ||
                req.ip === '127.0.0.1' ||
                req.ip === '::1');
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
    app.use('/api/v1/auth', auth_routes_1.authRoutes);
    app.use('/api/v1/profile', profile_routes_1.profileRoutes);
    app.use('/api/v1/kyc', kyc_routes_1.kycRoutes);
    app.use('/api/v1/notifications', notification_routes_1.notificationRoutes);
    app.use('/api/v1/wallet/withdraw', withdrawal_routes_1.userWithdrawalRoutes);
    app.use('/api/v1/wallet', wallet_routes_1.walletRoutes);
    app.use('/api/v1/support', support_routes_1.supportRoutes);
    app.use('/api/v1/tournaments', payout_routes_1.payoutRoutes);
    app.use('/api/v1/tournaments', results_routes_1.tournamentResultRoutes);
    app.use('/api/v1/tournaments', room_routes_1.roomRoutes);
    app.use('/api/v1/tournaments', booking_routes_1.bookingRoutes);
    app.use('/api/v1/tournaments', tournament_routes_1.tournamentRoutes);
    app.use('/api/v1/admin/notifications', notification_routes_1.adminNotificationRoutes);
    app.use('/api/v1/admin/withdrawals', withdrawal_routes_1.adminWithdrawalRoutes);
    app.use('/api/v1/admin/results', results_routes_1.adminResultRoutes);
    app.post('/api/v1/analytics/device-heartbeat', admin_controller_1.AdminController.recordDeviceHeartbeat);
    app.use('/api/v1/admin', admin_routes_1.adminRoutes);
    // Serve Next.js static pages for HTML routes (/login, /staff, /tournaments, etc.)
    app.get('*', (req, res, next) => {
        // Skip API, uploads, or health endpoints
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health') {
            return next();
        }
        const cleanPath = req.path.replace(/^\/+|\/+$/g, '');
        // 1. Root dashboard /
        if (!cleanPath) {
            const indexFile = path_1.default.join(publicDir, 'index.html');
            if (fs_1.default.existsSync(indexFile)) {
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
            path_1.default.join(publicDir, `${cleanPath}.html`),
            path_1.default.join(publicDir, cleanPath, 'index.html'),
            path_1.default.join(publicDir, `${cleanPath}/index.html`),
        ];
        for (const file of candidates) {
            if (fs_1.default.existsSync(file) && fs_1.default.statSync(file).isFile()) {
                return res.sendFile(file);
            }
        }
        // 3. Fallback to index.html for client-side routing
        const fallbackIndex = path_1.default.join(publicDir, 'index.html');
        if (fs_1.default.existsSync(fallbackIndex)) {
            return res.sendFile(fallbackIndex);
        }
        next();
    });
    // Static Next.js dashboard assets (_next, images, css, etc.)
    if (fs_1.default.existsSync(publicDir)) {
        app.use(express_1.default.static(publicDir));
    }
    // 404 Handler for undefined API routes
    app.use((req, res) => {
        res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
    });
    // Centralized Error Handler
    app.use(error_middleware_1.errorHandler);
    return app;
};
exports.createApp = createApp;
if (require.main === module) {
    // Initialize Database on startup
    (0, db_1.getDb)();
    // Initialize Google Drive Auth & Player Store for persistent cloud recovery
    gdrive_auth_store_service_1.GDriveAuthStore.initStore().catch((err) => {
        logger_1.Logger.error(`[SERVER] Failed to initialize GDriveAuthStore: ${err.message}`);
    });
    // Initialize Google Drive Tournament Store for persistent cloud recovery
    gdrive_tournament_store_service_1.GDriveTournamentStore.initStore().catch((err) => {
        logger_1.Logger.error(`[SERVER] Failed to initialize GDriveTournamentStore: ${err.message}`);
    });
    // Start background room reveal scheduled worker
    room_reveal_worker_1.RoomRevealWorker.start(30000);
    const app = (0, exports.createApp)();
    app.listen(env_1.config.port, () => {
        logger_1.Logger.info(`🚀 FLA ESPORTS API server running at http://localhost:${env_1.config.port}`);
        logger_1.Logger.info(`Environment: ${env_1.config.nodeEnv}`);
    });
}
