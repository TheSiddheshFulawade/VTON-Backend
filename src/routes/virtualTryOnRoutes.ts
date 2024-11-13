import { Router } from 'express';
import multer from 'multer';
import { VirtualTryOnController } from '../controllers/virtualTryOnController.js';

const router = Router();
const upload = multer();
const controller = new VirtualTryOnController();

// Initialize the controller
controller.initialize().catch(console.error);

router.post(
 '/generate',
 upload.fields([
 { name: 'humanImage', maxCount: 1 },
 { name: 'garmentImage', maxCount: 1 }
 ]),
 controller.generateTryOn
);

export default router;
