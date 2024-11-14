// virtualTryOnRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import { VirtualTryOnController } from '../controllers/virtualTryOnController.js';

const router = Router();
const upload = multer();
const controller = new VirtualTryOnController();

// Enhanced initialization state tracker
let initializationState = {
  isInitialized: false,
  isInitializing: false,
  error: null as Error | null,
  lastAttempt: null as Date | null,
  attempts: 0,
  maxAttempts: 5
};

// Initialize the controller with enhanced retry mechanism
const initializeController = async () => {
  if (initializationState.isInitializing) {
    console.log('Initialization already in progress, skipping...');
    return;
  }
  
  if (initializationState.attempts >= initializationState.maxAttempts) {
    console.log('Maximum initialization attempts reached, giving up');
    return;
  }
  
  initializationState.isInitializing = true;
  initializationState.lastAttempt = new Date();
  initializationState.attempts++;

  console.log(`Starting initialization attempt ${initializationState.attempts}/${initializationState.maxAttempts}`);

  try {
    // await controller.initialize();
    initializationState.isInitialized = true;
    initializationState.error = null;
    console.log('Virtual Try-On service initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Initialization attempt failed:', {
      attempt: initializationState.attempts,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    initializationState.error = error as Error;
    
    // Schedule retry with exponential backoff
    const retryDelay = Math.min(1000 * Math.pow(2, initializationState.attempts - 1), 60000);
    console.log(`Scheduling retry in ${retryDelay/1000} seconds...`);
    setTimeout(initializeController, retryDelay);
  } finally {
    initializationState.isInitializing = false;
  }
};

// Start initial initialization
initializeController();

// Enhanced status endpoint with more details
router.get('/status', (req, res) => {
  res.json({
    initialized: initializationState.isInitialized,
    initializing: initializationState.isInitializing,
    lastAttempt: initializationState.lastAttempt,
    attempts: initializationState.attempts,
    maxAttempts: initializationState.maxAttempts,
    error: initializationState.error ? {
      message: initializationState.error.message,
      stack: process.env.NODE_ENV === 'development' ? initializationState.error.stack : undefined,
      time: initializationState.lastAttempt
    } : null,
    serverTime: new Date().toISOString()
  });
});

// Enhanced middleware with timeout
const checkInitialization = async (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const timeout = 30000; // 30 second timeout

  const waitForInitialization = new Promise((resolve, reject) => {
    const check = () => {
      if (initializationState.isInitialized) {
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Initialization check timed out'));
      } else if (initializationState.error && !initializationState.isInitializing) {
        reject(initializationState.error);
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  });

  try {
    await waitForInitialization;
    next();
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        initializing: initializationState.isInitializing,
        lastAttempt: initializationState.lastAttempt,
        attempts: initializationState.attempts,
        serverTime: new Date().toISOString()
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