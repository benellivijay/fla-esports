"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingController = void 0;
const zod_1 = require("zod");
const booking_service_1 = require("./booking.service");
const teammateSchema = zod_1.z.object({
    ffUid: zod_1.z.string().min(3).max(25),
    ffIgn: zod_1.z.string().min(1).max(35),
    role: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
});
const bookSlotSchema = zod_1.z.object({
    slotNumber: zod_1.z.number().int().min(1).max(100).optional(),
    slotNumbers: zod_1.z.array(zod_1.z.number().int().min(1).max(100)).min(1).max(100).optional(),
    teamName: zod_1.z.string().max(40).optional(),
    teammates: zod_1.z.array(teammateSchema).optional(),
}).refine(data => data.slotNumber !== undefined || (data.slotNumbers !== undefined && data.slotNumbers.length > 0), {
    message: 'At least one slot number must be selected.',
});
class BookingController {
    static async getSlotGrid(req, res, next) {
        try {
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const currentUserId = req.user?.userId;
            const grid = await booking_service_1.BookingService.getSlotGrid(tournamentId, currentUserId);
            res.status(200).json({ success: true, data: grid });
        }
        catch (err) {
            next(err);
        }
    }
    static async bookSlot(req, res, next) {
        try {
            const userId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const parsed = bookSlotSchema.parse(req.body);
            const entry = await booking_service_1.BookingService.bookSlot(userId, {
                tournamentId,
                slotNumber: parsed.slotNumber,
                slotNumbers: parsed.slotNumbers,
                teamName: parsed.teamName,
                teammates: parsed.teammates,
            });
            const slotMsg = parsed.slotNumbers && parsed.slotNumbers.length > 1
                ? `Slots #${parsed.slotNumbers.join(', #')} booked successfully!`
                : `Slot #${parsed.slotNumber || parsed.slotNumbers?.[0]} booked successfully!`;
            res.status(201).json({
                success: true,
                message: slotMsg,
                data: entry,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async cancelBooking(req, res, next) {
        try {
            const userId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await booking_service_1.BookingService.cancelBooking(userId, tournamentId);
            res.status(200).json({
                success: true,
                message: 'Booking cancelled successfully. Any entry fee paid has been refunded to your wallet.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getMyBookings(req, res, next) {
        try {
            const userId = req.user.userId;
            const bookings = await booking_service_1.BookingService.getMyBookings(userId);
            res.status(200).json({ success: true, count: bookings.length, data: bookings });
        }
        catch (err) {
            next(err);
        }
    }
    static async getWalletBalance(req, res, next) {
        try {
            const userId = req.user.userId;
            const balance = booking_service_1.BookingService.getUserWalletBalance(userId);
            res.status(200).json({ success: true, balance });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.BookingController = BookingController;
