"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutRoutes = void 0;
const express_1 = require("express");
const payout_controller_1 = require("./payout.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/:id/payouts/distribute', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, payout_controller_1.PayoutController.distributePayouts);
exports.payoutRoutes = router;
