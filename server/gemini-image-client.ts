import { GoogleGenAI, Modality } from "@google/genai";
import { Buffer } from "node:buffer";

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn("[GeminiImageClient] GEMINI_API_KEY not set");
    return null;
  }
  
  console.log("[GeminiImageClient] Initialized with GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey });
}

export const geminiClient = createGeminiClient();

export async function generateCharacterImage(prompt: string): Promise<Buffer> {
  if (!geminiClient) {
    throw new Error("Gemini client is not configured. Please set GEMINI_API_KEY in environment secrets.");
  }
  
  try {
    console.log("[GeminiImageClient] Generating image with model: gemini-2.0-flash-exp");
    
    const response = await geminiClient.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE],
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
        console.log("[GeminiImageClient] Image generated successfully");
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
    
    throw new Error("No image data found in response. The model may have returned text only.");
  } catch (error) {
    console.error("[GeminiImageClient] Error generating image:", error);
    throw error;
  }
}
