"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomController = void 0;
const room_service_1 = require("./room.service");
const room_reveal_worker_1 = require("../scheduler/room_reveal.worker");
class RoomController {
    static async getRoomDetails(req, res, next) {
        try {
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const userId = req.user.userId;
            const isAdmin = req.user?.role === 'admin' || req.user?.role === 'moderator';
            const details = await room_service_1.RoomService.getRoomDetails(tournamentId, userId, isAdmin);
            res.status(200).json({ success: true, data: details });
        }
        catch (err) {
            next(err);
        }
    }
    static async revealRoomNow(req, res, next) {
        try {
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const adminUserId = req.user.userId;
            await room_service_1.RoomService.revealRoomNow(tournamentId, adminUserId);
            res.status(200).json({
                success: true,
                message: 'Room credentials unlocked and notification broadcast dispatched.',
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async triggerWorkerCycle(req, res, next) {
        try {
            const result = await room_reveal_worker_1.RoomRevealWorker.checkAndRevealRooms();
            res.status(200).json({
                success: true,
                message: `Worker executed: ${result.revealedCount} rooms revealed, ${result.ongoingCount} matches transitioned to ongoing.`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.RoomController = RoomController;
