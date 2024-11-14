import { client } from "@gradio/client";
import { ClientOptions } from "../types/gradioTypes.js";
import { TryOnResponse } from "../types/virtualTryOnTypes.js";

export class VirtualTryOnService {
  private client: any = null;
  private options: ClientOptions;
  private initializationRetries = 5; // Increased retries
  private retryDelay = 10000; // Increased to 10 seconds
  private maxTimeout = 180000; // 3 minutes timeout
  private isInitializing = false;

  constructor(hfToken: string | null = null) {
    console.log("VirtualTryOnService: Constructor called");
    if (hfToken) {
      if (!hfToken.startsWith("hf_")) {
        throw new Error('Hugging Face token must start with "hf_"');
      }
      this.options = {
        hf_token: hfToken as `hf_${string}`,
        timeout: this.maxTimeout,
        logging: true,
      };
    } else {
      this.options = {
        timeout: this.maxTimeout,
        logging: true,
      };
    }

    // Log environment information
    console.log("Environment Information:", {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryLimit: process.env.NODE_OPTIONS || "default",
      timestamp: new Date().toISOString(),
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      throw new Error("Initialization already in progress");
    }

    this.isInitializing = true;
    let lastError: Error | null = null;

    try {
      // Implement garbage collection before initialization
      if (global.gc) {
        global.gc();
      }

      for (let attempt = 1; attempt <= this.initializationRetries; attempt++) {
        try {
          console.log(
            `VirtualTryOnService: Initialization attempt ${attempt}/${this.initializationRetries}`
          );

          // Memory check before initialization
          const memBefore = process.memoryUsage();
          console.log("Memory before initialization:", {
            heapTotal: `${Math.round(memBefore.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`,
            rss: `${Math.round(memBefore.rss / 1024 / 1024)}MB`,
          });

          // Create client with timeout promise
          const clientPromise = client("yisol/IDM-VTON", this.options);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Client initialization timed out")),
              this.maxTimeout
            );
          });

          this.client = await Promise.race([clientPromise, timeoutPromise]);

          // Verify client
          if (!this.client || typeof this.client.predict !== "function") {
            throw new Error("Invalid client initialization");
          }

          // Memory check after initialization
          const memAfter = process.memoryUsage();
          console.log("Memory after initialization:", {
            heapTotal: `${Math.round(memAfter.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`,
            rss: `${Math.round(memAfter.rss / 1024 / 1024)}MB`,
          });

          console.log("VirtualTryOnService: Initialization successful");
          return;
        } catch (error) {
          lastError = error as Error;
          console.error("VirtualTryOnService: Initialization attempt failed:", {
            attempt,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });

          if (attempt < this.initializationRetries) {
            const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`Retrying in ${delay / 1000} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new Error(
        `Failed to initialize after ${this.initializationRetries} attempts. Last error: ${lastError?.message}`
      );
    } finally {
      this.isInitializing = false;
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
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }

  async generateTryOn({
    humanImage,
    garmentImage,
    message = "Processing try-on",
    useAutoMask = true,
    enhanceResult = true,
    denoisingSteps = 20,
    seed = 42,
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
      throw new Error(
        "Client not initialized. Please call initialize() first."
      );
    }

    try {
      console.log("Step 1: Validating parameters");
      this.validateParameters(denoisingSteps, seed);

      console.log("Step 2: Converting human image to base64");
      const humanDataUrl = await this.bufferToBase64(humanImage);
      console.log("Step 3: Converting garment image to base64");
      const garmentDataUrl = await this.bufferToBase64(garmentImage);

      console.log("Step 4: Converting to blobs");
      const humanBlob = await fetch(humanDataUrl).then((r) => r.blob());
      const garmentBlob = await fetch(garmentDataUrl).then((r) => r.blob());

      console.log("Step 5: Preparing request parameters", {
        message,
        useAutoMask,
        enhanceResult,
        denoisingSteps,
        seed,
      });

      const imageEditorInput = {
        background: humanBlob,
        layers: [],
        composite: null,
      };

      console.log("Step 6: Making API request");
      const result = await this.client.predict(
        2, // Changed from "/tryon" to 2 as it might be the fn_index
        [
          imageEditorInput,
          garmentBlob,
          message,
          useAutoMask,
          enhanceResult,
          denoisingSteps,
          seed,
        ],
        {
          batched: false,
          timeout: 300000, // 5 minute timeout
        }
      );

      console.log("Step 7: Processing response", result);

      if (
        !result.data ||
        !Array.isArray(result.data) ||
        result.data.length < 2
      ) {
        throw new Error(
          `Invalid response from IDM-VTON API: ${JSON.stringify(result)}`
        );
      }

      return {
        generatedImage: result.data[0],
        maskedImage: result.data[1],
      };
    } catch (error) {
      console.error("Detailed error in generateTryOn:", error);
      if (error instanceof Error) {
        throw new Error(`Virtual try-on generation failed: ${error.message}`);
      } else {
        throw new Error(
          `Virtual try-on generation failed: ${JSON.stringify(error)}`
        );
      }
    }
  }
}
