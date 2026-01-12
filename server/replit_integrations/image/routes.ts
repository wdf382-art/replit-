import type { Express, Request, Response } from "express";
import { openai } from "./client";

export function registerImageRoutes(app: Express): void {
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      if (!openai) {
        return res.status(503).json({ 
          error: "Image generation service is not configured. Please set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY." 
        });
      }
      
      const { prompt, aspectRatio = "16:9" } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      });

      const base64 = response.data[0]?.b64_json ?? "";
      
      if (!base64) {
        return res.status(500).json({ error: "No image data in response" });
      }

      res.json({
        b64_json: base64,
        mimeType: "image/png",
        aspectRatio,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}
