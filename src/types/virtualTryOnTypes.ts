export interface TryOnRequest {
    humanImage: Express.Multer.File;
    garmentImage: Express.Multer.File;
    message?: string;
    useAutoMask?: boolean;
    enhanceResult?: boolean;
    denoisingSteps?: number;
    seed?: number;
  }
  
  export interface TryOnResponse {
    generatedImage: string;
    maskedImage: string;
  }
  