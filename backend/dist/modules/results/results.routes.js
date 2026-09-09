"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminResultRoutes = exports.tournamentResultRoutes = void 0;
const express_1 = require("express");
const results_controller_1 = require("./results.controller");
const admin_controller_1 = require("../admin/admin.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const tournamentResultRouter = (0, express_1.Router)();
const adminResultRouter = (0, express_1.Router)();
// Tournament Participant Results Routes
tournamentResultRouter.post('/:id/results/submit', auth_middleware_1.authenticateToken, upload_middleware_1.uploadMiddleware.single('screenshot'), results_controller_1.ResultsController.submitResult);
tournamentResultRouter.get('/:id/results/my-submission', auth_middleware_1.authenticateToken, results_controller_1.ResultsController.getUserSubmission);
// Admin Results Review Routes
adminResultRouter.get('/queue', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, admin_controller_1.AdminController.getResultsQueue);
adminResultRouter.patch('/:id/verify', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, admin_controller_1.AdminController.verifyResult);
adminResultRouter.patch('/:id/dispute', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, admin_controller_1.AdminController.disputeResult);
adminResultRouter.post('/:id/review', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, results_controller_1.ResultsController.reviewResult);
exports.tournamentResultRoutes = tournamentResultRouter;
exports.adminResultRoutes = adminResultRouter;
