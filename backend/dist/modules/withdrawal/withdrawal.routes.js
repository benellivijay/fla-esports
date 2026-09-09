"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminWithdrawalRoutes = exports.userWithdrawalRoutes = void 0;
const express_1 = require("express");
const withdrawal_controller_1 = require("./withdrawal.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const userWithdrawalRouter = (0, express_1.Router)();
const adminWithdrawalRouter = (0, express_1.Router)();
// User routes
userWithdrawalRouter.post('/request', auth_middleware_1.authenticateToken, withdrawal_controller_1.WithdrawalController.requestWithdrawal);
userWithdrawalRouter.get('/my-requests', auth_middleware_1.authenticateToken, withdrawal_controller_1.WithdrawalController.getMyWithdrawals);
// Admin routes
adminWithdrawalRouter.get('/queue', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, withdrawal_controller_1.WithdrawalController.getAdminQueue);
adminWithdrawalRouter.post('/:id/process', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, withdrawal_controller_1.WithdrawalController.processWithdrawal);
exports.userWithdrawalRoutes = userWithdrawalRouter;
exports.adminWithdrawalRoutes = adminWithdrawalRouter;
