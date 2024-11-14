// virtualTryOnService.ts
import { client } from "@gradio/client";
import { ClientOptions } from "../types/gradioTypes.js";
import { TryOnResponse } from "../types/virtualTryOnTypes.js";

export class VirtualTryOnService {
    private static instance: any = null;
    private options: ClientOptions;
    private static isInitializing = false;
    private static lastInitAttempt: Date | null = null;
    private static initializationPromise: Promise<any> | null = null;

    constructor(hfToken: string | null = null) {
        this.options = {
            hf_token: hfToken?.startsWith("hf_") ? (hfToken as `hf_${string}`) : undefined,
            timeout: 300000, // 5 minutes
            logging: true,
        };
        
        console.log("VirtualTryOnService constructed with options:", {
            hasToken: !!hfToken,
            timeout: this.options.timeout,
            logging: this.options.logging
        });
    }

    private async getClient(): Promise<any> {
        try {
            if (VirtualTryOnService.instance) {
                return VirtualTryOnService.instance;
            }

            if (VirtualTryOnService.initializationPromise) {
                return await VirtualTryOnService.initializationPromise;
            }

            VirtualTryOnService.isInitializing = true;
            VirtualTryOnService.lastInitAttempt = new Date();

            console.log("Starting Gradio client initialization...");
            console.log("Memory usage:", process.memoryUsage());

            VirtualTryOnService.initializationPromise = client("yisol/IDM-VTON", this.options);

            VirtualTryOnService.instance = await VirtualTryOnService.initializationPromise;
            
            if (!VirtualTryOnService.instance || typeof VirtualTryOnService.instance.predict !== "function") {
                throw new Error("Invalid client initialization");
            }

            console.log("Gradio client initialized successfully");
            return VirtualTryOnService.instance;

        } catch (error) {
            console.error("Failed to initialize Gradio client:", error);
            VirtualTryOnService.instance = null;
            VirtualTryOnService.initializationPromise = null;
            throw error;
        } finally {
            VirtualTryOnService.isInitializing = false;
            VirtualTryOnService.initializationPromise = null;
        }
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
        console.log("Starting generateTryOn...");
        
        try {
            const gradioClient = await this.getClient();
            console.log("Client obtained, preparing images...");

            // Convert images to base64
            const humanDataUrl = `data:image/jpeg;base64,${humanImage.toString("base64")}`;
            const garmentDataUrl = `data:image/jpeg;base64,${garmentImage.toString("base64")}`;

            // Convert to blobs
            const humanBlob = await fetch(humanDataUrl).then(r => r.blob());
            const garmentBlob = await fetch(garmentDataUrl).then(r => r.blob());

            const imageEditorInput = {
                background: humanBlob,
                layers: [],
                composite: null,
            };

            console.log("Making prediction request...");
            const result = await gradioClient.predict(
                2,
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
                    timeout: 300000,
                }
            );

            if (!result.data || !Array.isArray(result.data) || result.data.length < 2) {
                throw new Error(`Invalid response from API: ${JSON.stringify(result)}`);
            }

            return {
                generatedImage: result.data[0],
                maskedImage: result.data[1],
            };

        } catch (error) {
            console.error("Error in generateTryOn:", error);
            // Reset instance on error to force re-initialization next time
            VirtualTryOnService.instance = null;
            throw error;
        }
    }

    // Method to check initialization status
    static getStatus() {
        return {
            isInitialized: !!VirtualTryOnService.instance,
            isInitializing: VirtualTryOnService.isInitializing,
            lastInitAttempt: VirtualTryOnService.lastInitAttempt,
        };
    }
}