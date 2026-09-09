"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRoutes = void 0;
const express_1 = require("express");
const support_controller_1 = require("./support.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
exports.supportRoutes = (0, express_1.Router)();
// GET /api/v1/support/info - Public support channels info
exports.supportRoutes.get('/info', support_controller_1.SupportController.getSupportInfo);
// POST /api/v1/support/tickets - Raise a complaint / ticket
exports.supportRoutes.post('/tickets', auth_middleware_1.optionalAuthToken, support_controller_1.SupportController.createTicket);
// GET /api/v1/support/tickets/my - View user's tickets
exports.supportRoutes.get('/tickets/my', auth_middleware_1.optionalAuthToken, support_controller_1.SupportController.getMyTickets);
