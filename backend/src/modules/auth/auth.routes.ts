import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.post('/otp/send', AuthController.sendOtp);
router.post('/otp/verify', AuthController.verifyOtp);
router.post('/verify-secondary', authenticateToken, AuthController.verifySecondary);
router.post('/google', AuthController.googleSignIn);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);

export const authRoutes = router;
