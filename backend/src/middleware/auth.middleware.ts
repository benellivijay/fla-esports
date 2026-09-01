import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JWTPayload, UserRole } from '../types';
import { getDb } from '../database/db';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. Missing Bearer token.' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
    
    // Check if user is active in DB
    const db = getDb();
    const user = db.prepare('SELECT status, role FROM users WHERE id = ?').get(payload.userId) as any;
    
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
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired.', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(403).json({ success: false, message: 'Invalid token.' });
    return;
  }
};

/**
 * Optional authentication: populates req.user if a valid token is present, but doesn't block unauthenticated requests.
 */
export const optionalAuthToken = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
      const db = getDb();
      const user = db.prepare('SELECT status, role FROM users WHERE id = ?').get(payload.userId) as any;
      if (user && user.status === 'active') {
        payload.role = user.role;
        req.user = payload;
      }
    } catch (_) {
      // Ignore token parse errors on optional routes
    }
  }
  next();
};

export const requireRoles = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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

export const requireAdmin = requireRoles(['admin']);
export const requireAdminOrModerator = requireRoles(['admin', 'moderator']);
