import { Router } from 'express';
import { ProfileController } from './profile.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/me', ProfileController.getProfile);
router.put('/me', ProfileController.updateProfile);
router.post('/ff-uid/initiate', ProfileController.initiateFFVerification);
router.post('/ff-uid/submit-proof', uploadMiddleware.single('proofImage'), ProfileController.submitFFProof);

export const profileRoutes = router;
