// virtualTryOnRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import { VirtualTryOnController } from '../controllers/virtualTryOnController.js';

const router = Router();
const upload = multer();
const controller = new VirtualTryOnController();

// Create an initialization state tracker with detailed status
let initializationState = {
  isInitialized: false,
  isInitializing: false,
  error: null as Error | null,
  lastAttempt: null as Date | null
};

// Initialize the controller with retry mechanism
const initializeController = async () => {
  if (initializationState.isInitializing) return;
  
  initializationState.isInitializing = true;
  initializationState.lastAttempt = new Date();

  try {
    console.log('Starting Virtual Try-On service initialization...');
    await controller.initialize();
    initializationState.isInitialized = true;
    initializationState.error = null;
    console.log('Virtual Try-On service initialized successfully');
  } catch (error) {
    initializationState.error = error as Error;
    console.error('Failed to initialize Virtual Try-On service:', error);
    
    // Schedule a retry after 1 minute if initialization failed
    setTimeout(initializeController, 60000);
  } finally {
    initializationState.isInitializing = false;
  }
};

// Start initial initialization
initializeController();

// Enhanced status endpoint
router.get('/status', (req, res) => {
  res.json({
    initialized: initializationState.isInitialized,
    initializing: initializationState.isInitializing,
    lastAttempt: initializationState.lastAttempt,
    error: initializationState.error ? {
      message: initializationState.error.message,
      stack: process.env.NODE_ENV === 'development' ? initializationState.error.stack : undefined
    } : null
  });
});

// Enhanced middleware to check initialization
const checkInitialization = async (req: any, res: any, next: any) => {
  if (initializationState.isInitialized) {
    next();
  } else {
    res.status(503).json({
      success: false,
      error: 'Service is not ready',
      details: {
        initializing: initializationState.isInitializing,
        lastAttempt: initializationState.lastAttempt,
        error: initializationState.error?.message
      }
    });
  }
};

router.post(
  '/generate',
  checkInitialization,
  upload.fields([
    { name: 'humanImage', maxCount: 1 },
    { name: 'garmentImage', maxCount: 1 }
  ]),
  controller.generateTryOn
);

export default router;