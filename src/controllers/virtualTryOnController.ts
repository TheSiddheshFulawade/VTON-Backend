import { Request, Response } from "express";
import { VirtualTryOnService } from "../services/virtualTryOnService";

export class VirtualTryOnController {
  private tryOnService: VirtualTryOnService;
  private readonly DEFAULT_CONFIG = {
    message: "Processing virtual try-on request",
    useAutoMask: true,
    enhanceResult: true,
    defaultDenoisingSteps: 20,
    defaultSeed: 42
  };

  constructor() {
    this.tryOnService = new VirtualTryOnService();
  }

  async initialize(): Promise<void> {
    await this.tryOnService.initialize();
  }

  generateTryOn = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate required files
      if (!req.files || !("humanImage" in req.files) || !("garmentImage" in req.files)) {
        res.status(400).json({ 
          success: false,
          error: "Missing required files: humanImage and garmentImage are required" 
        });
        return;
      }

      const humanImageFile = req.files.humanImage as Express.Multer.File[];
      const garmentImageFile = req.files.garmentImage as Express.Multer.File[];

      if (!humanImageFile[0] || !garmentImageFile[0]) {
        res.status(400).json({ 
          success: false,
          error: "Invalid file uploads" 
        });
        return;
      }

      // optional parameters
      const denoisingSteps = req.body.denoisingSteps ? 
        parseInt(req.body.denoisingSteps) : 
        this.DEFAULT_CONFIG.defaultDenoisingSteps;

      const seed = req.body.seed ? 
        parseInt(req.body.seed) : 
        this.DEFAULT_CONFIG.defaultSeed;

      // validate numeric parameters
      if (isNaN(denoisingSteps) || isNaN(seed)) {
        res.status(400).json({
          success: false,
          error: "denoisingSteps and seed must be valid numbers"
        });
        return;
      }

      // default configuration
      const result = await this.tryOnService.generateTryOn({
        humanImage: humanImageFile[0].buffer,
        garmentImage: garmentImageFile[0].buffer,
        message: this.DEFAULT_CONFIG.message,
        useAutoMask: this.DEFAULT_CONFIG.useAutoMask,
        enhanceResult: this.DEFAULT_CONFIG.enhanceResult,
        denoisingSteps,
        seed,
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error in generateTryOn:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  };
}