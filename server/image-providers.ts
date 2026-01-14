import { Buffer } from "node:buffer";
import { ImageProvider } from "@shared/schema";
import { generateImageBuffer } from "./replit_integrations/image/client";
import { generateCharacterImage as geminiGenerateImage } from "./gemini-image-client";

export interface ImageGenerationResult {
  buffer: Buffer;
  provider: ImageProvider;
}

export async function generateImage(
  prompt: string,
  provider: ImageProvider = "openai"
): Promise<ImageGenerationResult> {
  switch (provider) {
    case "openai":
      const openaiBuffer = await generateImageBuffer(prompt, "1024x1024");
      return { buffer: openaiBuffer, provider: "openai" };
      
    case "gemini":
      const geminiBuffer = await geminiGenerateImage(prompt);
      return { buffer: geminiBuffer, provider: "gemini" };
      
    case "jimeng":
    case "kling":
    case "hailuo":
    case "tongyi":
      throw new Error(`Provider "${provider}" is not yet implemented. Please use openai or gemini.`);
      
    default:
      throw new Error(`Unknown image provider: ${provider}`);
  }
}

export const providerLabels: Record<ImageProvider, string> = {
  openai: "OpenAI DALL-E",
  gemini: "NANO BANANA PRO (Gemini)",
  jimeng: "记梦 4.0",
  kling: "可灵",
  hailuo: "海螺",
  tongyi: "通义万象",
};

export const availableProviders: ImageProvider[] = ["openai", "gemini"];
