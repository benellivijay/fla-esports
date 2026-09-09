"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournamentRoutes = void 0;
const express_1 = require("express");
const tournament_controller_1 = require("./tournament.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public / Player routes (with optional auth to identify admin roles and reveal room credentials if permitted)
router.get('/', auth_middleware_1.optionalAuthToken, tournament_controller_1.TournamentController.listTournaments);
router.get('/game-modes/stats', tournament_controller_1.TournamentController.getGameModeStats);
router.get('/:id', auth_middleware_1.optionalAuthToken, tournament_controller_1.TournamentController.getTournamentById);
// Admin & Moderator routes
router.post('/', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, tournament_controller_1.TournamentController.createTournament);
router.put('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, tournament_controller_1.TournamentController.updateTournament);
router.patch('/:id/room', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, tournament_controller_1.TournamentController.updateRoomCredentials);
router.put('/:id/room-credentials', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, tournament_controller_1.TournamentController.updateRoomCredentials);
router.post('/:id/cancel', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, tournament_controller_1.TournamentController.cancelTournament);
router.delete('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, tournament_controller_1.TournamentController.deleteTournament);
exports.tournamentRoutes = router;
