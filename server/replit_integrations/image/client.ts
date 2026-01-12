import { GoogleGenAI, Modality } from "@google/genai";
import OpenAI from "openai";
import { Buffer } from "node:buffer";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

/**
 * Generate an image and return as Buffer.
 * Uses gemini-3-pro-image-preview (NANO banana pro) model via Replit AI Integrations.
 * Note: Gemini image generation returns high-quality images by default.
 * The size parameter is included for API compatibility but Gemini determines optimal resolution.
 */
export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  // Include size hint in prompt for better control over output dimensions
  const sizeHint = size === "256x256" ? "small thumbnail image" : 
                   size === "512x512" ? "medium sized image" : 
                   "high resolution detailed image";
  const enhancedPrompt = `${prompt}. Generate as ${sizeHint}.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: enhancedPrompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response from NANO banana pro");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

/**
 * Edit/combine multiple images into a composite.
 * Uses gemini-3-pro-image-preview (NANO banana pro) model via Replit AI Integrations.
 */
export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const fs = await import("node:fs");
  
  // Read images and convert to base64
  const imageParts = imageFiles.map((file) => {
    const imageData = fs.readFileSync(file);
    return {
      inlineData: {
        mimeType: "image/png",
        data: imageData.toString("base64"),
      },
    };
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response from NANO banana pro");
  }

  const imageBytes = Buffer.from(imagePart.inlineData.data, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
