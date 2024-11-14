import { client } from "@gradio/client";
import { ClientOptions } from "../types/gradioTypes.js";
import { TryOnResponse } from "../types/virtualTryOnTypes.js";

export class VirtualTryOnService {
  private client: any = null;
  private options: ClientOptions;
  private initializationRetries = 3;
  private retryDelay = 30000; // 20 seconds

  constructor(hfToken: string | null = null) {
    console.log("VirtualTryOnService: Constructor called");
    if (hfToken) {
      if (!hfToken.startsWith("hf_")) {
        throw new Error('Hugging Face token must start with "hf_"');
      }
      this.options = {
        hf_token: hfToken as `hf_${string}`,
        timeout: 120000, // increased timeout to 2 minutes
        logging: true,
      };
    } else {
      this.options = {
        timeout: 120000,
        logging: true,
      };
    }
    console.log("VirtualTryOnService: Constructor completed with options:", {
      ...this.options,
      hf_token: this.options.hf_token ? "[REDACTED]" : undefined,
    });
  }

  async initialize(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.initializationRetries; attempt++) {
      try {
        console.log(
          `VirtualTryOnService: Initialization attempt ${attempt}/${this.initializationRetries}`
        );
        console.log(
          "VirtualTryOnService: Attempting to connect to Gradio client..."
        );

        // Add memory usage logging
        const used = process.memoryUsage();
        console.log("Memory usage before client initialization:", {
          heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
          rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
        });

        this.client = await client("yisol/IDM-VTON", this.options);

        console.log(
          "VirtualTryOnService: Successfully connected to IDM-VTON API"
        );

        // Verify client connection
        if (!this.client) {
          throw new Error(
            "Client connection succeeded but client object is null"
          );
        }

        // Basic client verification (checking if it's an object with expected properties)
        if (typeof this.client.predict !== "function") {
          throw new Error(
            "Client initialized but predict method is not available"
          );
        }

        console.log(
          "VirtualTryOnService: Client verification completed successfully"
        );
        return;
      } catch (error) {
        lastError = error as Error;
        console.error("VirtualTryOnService: Initialization attempt failed:", {
          attempt,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });

        if (attempt < this.initializationRetries) {
          console.log(
            `VirtualTryOnService: Retrying in ${
              this.retryDelay / 1000
            } seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    const finalError = new Error(
      `Failed to initialize after ${this.initializationRetries} attempts. Last error: ${lastError?.message}`
    );
    console.error("VirtualTryOnService: Initialization finally failed:", {
      error: finalError.message,
      stack: finalError.stack,
      lastError: lastError?.message,
      timestamp: new Date().toISOString(),
    });
    throw finalError;
  }

  isInitialized(): boolean {
    return this.client !== null && typeof this.client.predict === "function";
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
