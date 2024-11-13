import { Router } from 'express';
import multer from 'multer';
import { VirtualTryOnController } from '../controllers/virtualTryOnController.js';

const router = Router();
const upload = multer();
const controller = new VirtualTryOnController();

// Create an initialization state tracker
let isInitialized = false;
let initializationError: Error | null = null;

// Initialize the controller
(async () => {
    try {
        await controller.initialize();
        isInitialized = true;
        console.log('Virtual Try-On service initialized successfully');
    } catch (error) {
        initializationError = error as Error;
        console.error('Failed to initialize Virtual Try-On service:', error);
    }
})();

// Middleware to check initialization status
const checkInitialization = async (req: any, res: any, next: any) => {
    if (isInitialized) {
        next();
    } else if (initializationError) {
        res.status(500).json({
            success: false,
            error: 'Service initialization failed. Please try again later.',
            details: initializationError.message
        });
    } else {
        res.status(503).json({
            success: false,
            error: 'Service is still initializing. Please try again in a few moments.'
        });
    }
};

router.post(
    '/generate',
    checkInitialization,  // Add the initialization check middleware
    upload.fields([
        { name: 'humanImage', maxCount: 1 },
        { name: 'garmentImage', maxCount: 1 }
    ]),
    controller.generateTryOn
);

// Add a status endpoint to check initialization status
router.get('/status', (req, res) => {
    res.json({
        initialized: isInitialized,
        error: initializationError ? initializationError.message : null
    });
});

export default router;