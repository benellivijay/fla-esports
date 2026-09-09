"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Core auth routes
router.post('/signin', auth_controller_1.AuthController.signIn);
router.post('/register', auth_controller_1.AuthController.register);
router.post('/verify-otp', auth_controller_1.AuthController.verifyRegistrationOtp);
router.post('/resend-otp', auth_controller_1.AuthController.resendRegistrationOtp);
router.post('/google', auth_controller_1.AuthController.googleSignIn);
router.get('/google/callback', auth_controller_1.AuthController.googleCallback);
router.get('/check-username', auth_controller_1.AuthController.checkUsername);
router.post('/check-username', auth_controller_1.AuthController.checkUsername);
router.get('/ai-usernames', auth_controller_1.AuthController.suggestAiUsernames);
router.post('/ai-usernames', auth_controller_1.AuthController.suggestAiUsernames);
router.post('/refresh', auth_controller_1.AuthController.refreshToken);
router.post('/logout', auth_controller_1.AuthController.logout);
// Legacy & secondary routes
router.post('/otp/send', auth_controller_1.AuthController.sendOtp);
router.post('/otp/verify', auth_controller_1.AuthController.verifyOtp);
router.post('/verify-secondary', auth_middleware_1.authenticateToken, auth_controller_1.AuthController.verifySecondary);
router.get('/test-email', auth_controller_1.AuthController.testEmail);
exports.authRoutes = router;
