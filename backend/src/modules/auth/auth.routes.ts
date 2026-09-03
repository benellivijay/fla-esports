import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Core auth routes
router.post('/signin', AuthController.signIn);
router.post('/register', AuthController.register);
router.post('/verify-otp', AuthController.verifyRegistrationOtp);
router.post('/resend-otp', AuthController.resendRegistrationOtp);
router.post('/google', AuthController.googleSignIn);
router.get('/check-username', AuthController.checkUsername);
router.post('/check-username', AuthController.checkUsername);
router.get('/ai-usernames', AuthController.suggestAiUsernames);
router.post('/ai-usernames', AuthController.suggestAiUsernames);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);

// Legacy & secondary routes
router.post('/otp/send', AuthController.sendOtp);
router.post('/otp/verify', AuthController.verifyOtp);
router.post('/verify-secondary', authenticateToken, AuthController.verifySecondary);
router.get('/test-email', AuthController.testEmail);

export const authRoutes = router;
