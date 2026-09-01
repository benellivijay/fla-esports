import { Router } from 'express';
import { WalletController } from './wallet.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';

const router = Router();

router.get('/summary', authenticateToken, WalletController.getSummary);
router.post('/deposit/create-order', authenticateToken, WalletController.createOrder);
router.post('/deposit/verify', authenticateToken, WalletController.verifyDeposit);
router.post('/deposit/upi-qr', authenticateToken, uploadMiddleware.single('screenshot'), WalletController.submitQrDeposit);
router.get('/transactions', authenticateToken, WalletController.getTransactions);

export const walletRoutes = router;
