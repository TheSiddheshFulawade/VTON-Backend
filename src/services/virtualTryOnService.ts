import { client } from '@gradio/client';
import { ClientOptions } from '../types/gradioTypes';
import { TryOnResponse } from '../types/virtualTryOnTypes';

export class VirtualTryOnService {
  private client: any = null;
  private options: ClientOptions;

  constructor(hfToken: string | null = null) {
    if (hfToken) {
      if (!hfToken.startsWith('hf_')) {
        throw new Error('Hugging Face token must start with "hf_"');
      }
      this.options = { hf_token: hfToken as `hf_${string}` };
    } else {
      this.options = {};
    }
  }

  async initialize(): Promise<void> {
    try {
      this.client = await client("yisol/IDM-VTON", this.options);
      console.log("Successfully connected to IDM-VTON API");
    } catch (error) {
      console.error("Failed to connect to IDM-VTON API:", error);
      throw error;
    }
  }

  private validateParameters(denoisingSteps: number, seed: number): void {
    if (denoisingSteps < 20) {
      throw new Error("denoisingSteps must be at least 20");
    }
    if (seed < 0) {
      throw new Error("seed must be a non-negative number");
    }
  }

  private async bufferToBase64(buffer: Buffer): Promise<string> {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  async generateTryOn({
    humanImage,
    garmentImage,
    message = "Processing try-on",
    useAutoMask = true,
    enhanceResult = true,
    denoisingSteps = 20,
    seed = 42
  }: {
    humanImage: Buffer;
    garmentImage: Buffer;
    message?: string;
    useAutoMask?: boolean;
    enhanceResult?: boolean;
    denoisingSteps?: number;
    seed?: number;
  }): Promise<TryOnResponse> {
    if (!this.client) {
      throw new Error("Client not initialized. Please call initialize() first.");
    }

    try {
      console.log("Step 1: Validating parameters");
      this.validateParameters(denoisingSteps, seed);

      console.log("Step 2: Converting human image to base64");
      const humanDataUrl = await this.bufferToBase64(humanImage);
      console.log("Step 3: Converting garment image to base64");
      const garmentDataUrl = await this.bufferToBase64(garmentImage);

      console.log("Step 4: Converting to blobs");
      const humanBlob = await fetch(humanDataUrl).then(r => r.blob());
      const garmentBlob = await fetch(garmentDataUrl).then(r => r.blob());

      console.log("Step 5: Preparing request parameters", {
        message,
        useAutoMask,
        enhanceResult,
        denoisingSteps,
        seed
      });

      const imageEditorInput = {
        background: humanBlob,
        layers: [],
        composite: null
      };

      console.log("Step 6: Making API request");
      const result = await this.client.predict(
        2,  // fn_index for the try-on endpoint
        [
          imageEditorInput,
          garmentBlob,
          message,
          useAutoMask,
          enhanceResult,
          denoisingSteps,
          seed
        ],
        {
          batched: false,
          timeout: 300000  // 5 minute timeout
        }
      );

      console.log("Step 7: Processing response", result);

      if (!result.data || !Array.isArray(result.data) || result.data.length < 2) {
        throw new Error(`Invalid response from IDM-VTON API: ${JSON.stringify(result)}`);
      }

      return {
        generatedImage: result.data[0],
        maskedImage: result.data[1]
      };
    } catch (error) {
      console.error("Detailed error in generateTryOn:", error);
      if (error instanceof Error) {
        throw new Error(`Virtual try-on generation failed: ${error.message}`);
      } else {
        throw new Error(`Virtual try-on generation failed: ${JSON.stringify(error)}`);
      }
    }
  }
}