import { GoogleGenAI, Modality } from "@google/genai";
import { Buffer } from "node:buffer";

function createGeminiClient() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  
  if (!apiKey) {
    console.warn("[GeminiImageClient] AI_INTEGRATIONS_GEMINI_API_KEY not set");
    return null;
  }
  
  return new GoogleGenAI({
    apiKey,
    httpOptions: baseUrl ? { baseUrl } : undefined,
  });
}

export const geminiClient = createGeminiClient();

export async function generateCharacterImage(prompt: string): Promise<Buffer> {
  if (!geminiClient) {
    throw new Error("Gemini client is not configured. Please ensure AI_INTEGRATIONS_GEMINI_API_KEY is set.");
  }
  
  try {
    const response = await geminiClient.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    if (!response.candidates || response.candidates.length === 0) {
      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Request blocked by safety filter: ${blockReason}`);
      }
      throw new Error("No candidates returned from model. The request may have been blocked.");
    }
    
    const candidate = response.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      throw new Error(`Generation stopped with reason: ${candidate.finishReason}`);
    }
    
    const parts = candidate.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No content generated in response");
    }
    
    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
    
    throw new Error("No image data found in response. The model may have returned text only.");
  } catch (error) {
    console.error("[GeminiImageClient] Error generating image:", error);
    throw error;
  }
}
