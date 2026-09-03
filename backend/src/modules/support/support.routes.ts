import { Router } from 'express';
import { SupportController } from './support.controller';
import { optionalAuthToken } from '../../middleware/auth.middleware';

export const supportRoutes = Router();

// GET /api/v1/support/info - Public support channels info
supportRoutes.get('/info', SupportController.getSupportInfo);

// POST /api/v1/support/tickets - Raise a complaint / ticket
supportRoutes.post('/tickets', optionalAuthToken, SupportController.createTicket);

// GET /api/v1/support/tickets/my - View user's tickets
supportRoutes.get('/tickets/my', optionalAuthToken, SupportController.getMyTickets);
