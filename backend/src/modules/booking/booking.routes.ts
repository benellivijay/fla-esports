import { Router } from 'express';
import { BookingController } from './booking.controller';
import { authenticateToken, optionalAuthToken } from '../../middleware/auth.middleware';

const router = Router();

// User specific routes
router.get('/user/my-bookings', authenticateToken, BookingController.getMyBookings);
router.get('/wallet/balance', authenticateToken, BookingController.getWalletBalance);

// Tournament specific slot routes
router.get('/:id/slots', optionalAuthToken, BookingController.getSlotGrid);
router.post('/:id/book', authenticateToken, BookingController.bookSlot);
router.post('/:id/cancel-booking', authenticateToken, BookingController.cancelBooking);

export const bookingRoutes = router;
