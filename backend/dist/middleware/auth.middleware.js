"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminOrModerator = exports.requireAdmin = exports.requireRoles = exports.optionalAuthToken = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const db_1 = require("../database/db");
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
        res.status(401).json({ success: false, message: 'Authentication required. Missing Bearer token.' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.config.jwt.accessSecret);
        // Check if user is active in DB
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT status, role FROM users WHERE id = ?').get(payload.userId);
        if (!user) {
            res.status(401).json({ success: false, message: 'User account not found.' });
            return;
        }
        if (user.status === 'banned' || user.status === 'suspended') {
            res.status(403).json({ success: false, message: `Account is ${user.status}. Access denied.` });
            return;
        }
        payload.role = user.role;
        req.user = payload;
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            res.status(401).json({ success: false, message: 'Token expired.', code: 'TOKEN_EXPIRED' });
            return;
        }
        res.status(403).json({ success: false, message: 'Invalid token.' });
        return;
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Optional authentication: populates req.user if a valid token is present, but doesn't block unauthenticated requests.
 */
const optionalAuthToken = (req, _res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.config.jwt.accessSecret);
            const db = (0, db_1.getDb)();
            const user = db.prepare('SELECT status, role FROM users WHERE id = ?').get(payload.userId);
            if (user && user.status === 'active') {
                payload.role = user.role;
                req.user = payload;
            }
        }
        catch (_) {
            // Ignore token parse errors on optional routes
        }
    }
    next();
};
exports.optionalAuthToken = optionalAuthToken;
const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required.' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: `Forbidden: Requires one of [${roles.join(', ')}] roles.`,
            });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
exports.requireAdmin = (0, exports.requireRoles)(['admin']);
exports.requireAdminOrModerator = (0, exports.requireRoles)(['admin', 'moderator']);
