"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const zod_1 = require("zod");
const auth_service_1 = require("./auth.service");
const email_service_1 = require("../../services/email.service");
const signInSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, 'Username or email is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().max(60).optional(),
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(30),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    code: zod_1.z.string().min(4, 'Code is required').max(10),
});
const resendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
const googleSignInSchema = zod_1.z.object({
    idToken: zod_1.z.string().nullish(),
    email: zod_1.z.string().email('Invalid email address').nullish(),
    name: zod_1.z.string().nullish(),
    avatarUrl: zod_1.z.string().nullish(),
    googleId: zod_1.z.string().nullish(),
    username: zod_1.z.string().min(3).max(30).nullish(),
    checkOnly: zod_1.z.boolean().nullish(),
});
const legacySendOtpSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(3, 'Identifier is required'),
    type: zod_1.z.enum(['phone', 'email']),
});
const legacyVerifyOtpSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(3, 'Identifier is required'),
    otpCode: zod_1.z.string().length(6, 'OTP must be 6 digits'),
    type: zod_1.z.enum(['phone', 'email']),
    name: zod_1.z.string().optional(),
});
const verifySecondarySchema = zod_1.z.object({
    identifier: zod_1.z.string().min(3, 'Identifier is required'),
    otpCode: zod_1.z.string().length(6, 'OTP must be 6 digits'),
    type: zod_1.z.enum(['phone', 'email']),
});
const refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(10, 'Refresh token required'),
});
class AuthController {
    /**
     * POST /auth/signin
     */
    static async signIn(req, res, next) {
        try {
            const { identifier, password } = signInSchema.parse(req.body);
            const result = await auth_service_1.AuthService.signIn(identifier, password);
            res.status(200).json({
                success: true,
                message: 'Signed in successfully.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /auth/register
     */
    static async register(req, res, next) {
        try {
            const { name, username, email, password } = registerSchema.parse(req.body);
            const result = await auth_service_1.AuthService.register(username, email, password, name);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /auth/verify-otp
     */
    static async verifyRegistrationOtp(req, res, next) {
        try {
            const { email, code } = verifyOtpSchema.parse(req.body);
            const result = await auth_service_1.AuthService.verifyRegistrationOtp(email, code);
            res.status(200).json({
                success: true,
                message: 'Account created and verified successfully.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /auth/resend-otp
     */
    static async resendRegistrationOtp(req, res, next) {
        try {
            const { email } = resendOtpSchema.parse(req.body);
            const result = await auth_service_1.AuthService.resendRegistrationOtp(email);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /auth/google
     */
    static async googleSignIn(req, res, next) {
        try {
            const payload = googleSignInSchema.parse(req.body);
            const result = await auth_service_1.AuthService.googleAuth(payload);
            res.status(200).json({
                success: true,
                message: 'Google authentication successful.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /auth/google/callback
     */
    static async googleCallback(_req, res) {
        res.setHeader('Content-Type', 'text/html');
        res.send(`<!DOCTYPE html><html><head><title>Google Authentication</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#0b0e14;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Connecting your Google Account...</h2><p style="color:#aaa;">Please wait while we complete your login...</p></div></body></html>`);
    }
    /**
     * GET /auth/check-username?username=xyz
     */
    static async checkUsername(req, res, next) {
        try {
            const username = req.query.username || req.body.username || '';
            const result = await auth_service_1.AuthService.checkUsername(username);
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /auth/ai-usernames?name=Vijay&email=xyz@gmail.com
     */
    static async suggestAiUsernames(req, res, next) {
        try {
            const name = req.query.name || req.body.name || '';
            const email = req.query.email || req.body.email || '';
            const suggestions = await auth_service_1.AuthService.generateAiUsernames(name, email);
            res.status(200).json({
                success: true,
                data: {
                    suggestions,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /auth/refresh
     */
    static async refreshToken(req, res, next) {
        try {
            const { refreshToken } = refreshTokenSchema.parse(req.body);
            const tokens = await auth_service_1.AuthService.refreshToken(refreshToken);
            res.status(200).json({
                success: true,
                message: 'Tokens refreshed successfully.',
                data: tokens,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /auth/logout
     */
    static async logout(req, res, next) {
        try {
            const { refreshToken } = refreshTokenSchema.parse(req.body);
            await auth_service_1.AuthService.logout(refreshToken);
            res.status(200).json({
                success: true,
                message: 'Logged out successfully.',
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Legacy endpoints
     */
    static async sendOtp(req, res, next) {
        try {
            const { identifier, type } = legacySendOtpSchema.parse(req.body);
            const result = await auth_service_1.AuthService.sendOtp(identifier, type);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    static async verifyOtp(req, res, next) {
        try {
            const { identifier, otpCode, type, name } = legacyVerifyOtpSchema.parse(req.body);
            const result = await auth_service_1.AuthService.verifyOtp(identifier, otpCode, type === 'phone', name);
            res.status(200).json({
                success: true,
                message: 'Authentication successful.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async verifySecondary(req, res, next) {
        try {
            const userId = req.user.userId;
            const { identifier, otpCode, type } = verifySecondarySchema.parse(req.body);
            const result = await auth_service_1.AuthService.verifySecondaryIdentifier(userId, identifier, otpCode, type);
            res.status(200).json({
                success: true,
                message: (type === 'phone' ? 'Phone' : 'Email') + ' verified successfully.' + (result.kycVerified ? ' KYC is now fully verified!' : ''),
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async testEmail(req, res, next) {
        try {
            const to = req.query.to || 'flaadmin40@gmail.com';
            const testCode = '888888';
            const success = await email_service_1.EmailService.sendOtpEmail(to, testCode);
            res.status(200).json({
                success,
                message: success ? 'Test email dispatched to ' + to : 'Failed to dispatch test email to ' + to,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AuthController = AuthController;
