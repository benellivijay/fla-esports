import { Router } from 'express';
import { KYCController } from './kyc.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/status', KYCController.getKYCStatus);
router.post('/submit', uploadMiddleware.single('document'), KYCController.submitKYC);

export const kycRoutes = router;
