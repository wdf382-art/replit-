import type { VideoModel } from "@shared/schema";

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

export async function generateVideoFromImage(
  imageBase64: string,
  description: string,
  model: VideoModel,
  duration: number = 5
): Promise<VideoGenerationResult> {
  switch (model) {
    case "veo":
      return generateWithVeo(imageBase64, description, duration);
    case "kling":
      return generateWithKling(imageBase64, description, duration);
    case "jimeng":
      return generateWithJimeng(imageBase64, description, duration);
    default:
      return { success: false, error: "Unknown video model" };
  }
}

function getGeminiApiConfig() {
  const replitApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const replitBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  
  if (replitApiKey && replitBaseUrl) {
    console.log("[VEO] Using Replit AI Integrations");
    return {
      apiKey: replitApiKey,
      baseUrl: replitBaseUrl.replace(/\/$/, ""),
    };
  }
  
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    console.log("[VEO] Using GEMINI_API_KEY");
    return {
      apiKey: geminiKey,
      baseUrl: "https://generativelanguage.googleapis.com",
    };
  }
  
  return null;
}

async function generateWithVeo(
  imageBase64: string,
  description: string,
  duration: number
): Promise<VideoGenerationResult> {
  const apiConfig = getGeminiApiConfig();
  if (!apiConfig) {
    return { success: false, error: "Gemini API not configured. Please set up Replit AI Integrations or add GEMINI_API_KEY." };
  }

  try {
    const apiUrl = `${apiConfig.baseUrl}/v1beta/models/veo-2.0-generate-001:predictLongRunning`;
    console.log("[VEO] Sending request to:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiConfig.apiKey,
      },
      body: JSON.stringify({
        instances: [{
          prompt: description,
          image: {
            bytesBase64Encoded: imageBase64,
          },
        }],
        parameters: {
          aspectRatio: "16:9",
          durationSeconds: duration,
          personGeneration: "allow_adult",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VEO] API error:", errorText);
      return { success: false, error: `VEO API error: ${response.status}` };
    }

    const result = await response.json();
    
    if (result.name) {
      const videoUrl = await pollForVeoResult(result.name, apiConfig);
      if (videoUrl) {
        return { success: true, videoUrl };
      }
      return { success: false, error: "Video generation timed out" };
    }

    return { success: false, error: "Unexpected VEO response" };
  } catch (error) {
    console.error("[VEO] Error:", error);
    return { success: false, error: `VEO generation failed: ${error}` };
  }
}

async function pollForVeoResult(operationName: string, apiConfig: { apiKey: string; baseUrl: string }): Promise<string | null> {
  const maxAttempts = 60;
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const pollUrl = `${apiConfig.baseUrl}/v1beta/${operationName}`;
      const response = await fetch(pollUrl, {
        headers: {
          "x-goog-api-key": apiConfig.apiKey,
        },
      });

      if (!response.ok) continue;

      const result = await response.json();
      
      if (result.done) {
        const video = result.response?.generatedSamples?.[0]?.video;
        if (video?.uri) {
          return video.uri;
        }
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("[VEO] Polling error:", error);
    }
  }

  return null;
}

async function generateWithKling(
  imageBase64: string,
  description: string,
  duration: number
): Promise<VideoGenerationResult> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
  
  if (!accessKey || !secretKey) {
    return { success: false, error: "Kling API keys not configured. Please add KLING_ACCESS_KEY and KLING_SECRET_KEY secrets." };
  }

  try {
    const response = await fetch("https://api.klingai.com/v1/videos/image2video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessKey}`,
      },
      body: JSON.stringify({
        model_name: "kling-v1",
        image: `data:image/png;base64,${imageBase64}`,
        prompt: description,
        duration: String(duration),
        mode: "std",
        cfg_scale: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Kling] API error:", errorText);
      return { success: false, error: `Kling API error: ${response.status}` };
    }

    const result = await response.json();
    
    if (result.data?.task_id) {
      const videoUrl = await pollForKlingResult(result.data.task_id, accessKey);
      if (videoUrl) {
        return { success: true, videoUrl };
      }
      return { success: false, error: "Video generation timed out" };
    }

    return { success: false, error: "Unexpected Kling response" };
  } catch (error) {
    console.error("[Kling] Error:", error);
    return { success: false, error: `Kling generation failed: ${error}` };
  }
}

async function pollForKlingResult(taskId: string, accessKey: string): Promise<string | null> {
  const maxAttempts = 60;
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${accessKey}`,
        },
      });

      if (!response.ok) continue;

      const result = await response.json();
      
      if (result.data?.task_status === "succeed") {
        return result.data?.task_result?.videos?.[0]?.url || null;
      }
      
      if (result.data?.task_status === "failed") {
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("[Kling] Polling error:", error);
    }
  }

  return null;
}

async function generateWithJimeng(
  imageBase64: string,
  description: string,
  duration: number
): Promise<VideoGenerationResult> {
  const apiKey = process.env.JIMENG_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "Jimeng API key not configured. Please add JIMENG_API_KEY secret." };
  }

  try {
    const response = await fetch("https://jimeng.jianying.com/api/v1/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "jimeng-4.0",
        image: imageBase64,
        prompt: description,
        duration: duration,
        aspect_ratio: "16:9",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Jimeng] API error:", errorText);
      return { success: false, error: `Jimeng API error: ${response.status}` };
    }

    const result = await response.json();
    
    if (result.task_id) {
      const videoUrl = await pollForJimengResult(result.task_id, apiKey);
      if (videoUrl) {
        return { success: true, videoUrl };
      }
      return { success: false, error: "Video generation timed out" };
    }

    return { success: false, error: "Unexpected Jimeng response" };
  } catch (error) {
    console.error("[Jimeng] Error:", error);
    return { success: false, error: `Jimeng generation failed: ${error}` };
  }
}

async function pollForJimengResult(taskId: string, apiKey: string): Promise<string | null> {
  const maxAttempts = 60;
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://jimeng.jianying.com/api/v1/video/query?task_id=${taskId}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) continue;

      const result = await response.json();
      
      if (result.status === "completed") {
        return result.video_url || null;
      }
      
      if (result.status === "failed") {
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("[Jimeng] Polling error:", error);
    }
  }

  return null;
}
