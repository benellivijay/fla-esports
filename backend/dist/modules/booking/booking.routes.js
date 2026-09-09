"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRoutes = void 0;
const express_1 = require("express");
const booking_controller_1 = require("./booking.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// User specific routes
router.get('/user/my-bookings', auth_middleware_1.authenticateToken, booking_controller_1.BookingController.getMyBookings);
router.get('/wallet/balance', auth_middleware_1.authenticateToken, booking_controller_1.BookingController.getWalletBalance);
// Tournament specific slot routes
router.get('/:id/slots', auth_middleware_1.optionalAuthToken, booking_controller_1.BookingController.getSlotGrid);
router.post('/:id/book', auth_middleware_1.authenticateToken, booking_controller_1.BookingController.bookSlot);
router.post('/:id/cancel-booking', auth_middleware_1.authenticateToken, booking_controller_1.BookingController.cancelBooking);
exports.bookingRoutes = router;
