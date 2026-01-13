import type { VideoModel } from "@shared/schema";
import { generateVideoFromImage } from "./video-generator";

interface VideoJob {
  id: string;
  shotId: string;
  model: VideoModel;
  imageBase64: string;
  description: string;
  duration: number;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
}

const jobQueue: VideoJob[] = [];
const processingJobs = new Set<string>();
const MAX_CONCURRENT_JOBS = 2;
let isProcessing = false;

type StorageUpdater = (shotId: string, updates: Record<string, unknown>) => Promise<unknown>;
let storageUpdateFn: StorageUpdater | null = null;

export function initializeVideoJobQueue(updateShot: StorageUpdater) {
  storageUpdateFn = updateShot;
  console.log("[VideoJobQueue] Initialized");
}

export function enqueueVideoJob(
  shotId: string,
  model: VideoModel,
  imageBase64: string,
  description: string,
  duration: number
): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const job: VideoJob = {
    id: jobId,
    shotId,
    model,
    imageBase64,
    description,
    duration,
    status: "pending",
    createdAt: new Date(),
  };
  
  jobQueue.push(job);
  console.log(`[VideoJobQueue] Enqueued job ${jobId} for shot ${shotId}`);
  
  setImmediate(() => processQueue());
  
  return jobId;
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    while (jobQueue.length > 0 && processingJobs.size < MAX_CONCURRENT_JOBS) {
      const job = jobQueue.shift();
      if (!job) break;
      
      processingJobs.add(job.id);
      processJob(job).finally(() => {
        processingJobs.delete(job.id);
        setImmediate(() => processQueue());
      });
    }
  } finally {
    isProcessing = false;
  }
}

async function updateShotWithRetry(shotId: string, updates: Record<string, unknown>, maxRetries = 3): Promise<boolean> {
  if (!storageUpdateFn) return false;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await storageUpdateFn(shotId, updates);
      return true;
    } catch (error) {
      console.error(`[VideoJobQueue] Storage update failed (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return false;
}

async function processJob(job: VideoJob) {
  console.log(`[VideoJobQueue] Processing job ${job.id} for shot ${job.shotId}`);
  
  try {
    const result = await generateVideoFromImage(
      job.imageBase64,
      job.description,
      job.model,
      job.duration
    );
    
    if (result.success && result.videoUrl) {
      console.log(`[VideoJobQueue] Job ${job.id} completed successfully`);
      const updated = await updateShotWithRetry(job.shotId, {
        videoUrl: result.videoUrl,
        videoStatus: "completed",
        videoError: null,
      });
      if (!updated) {
        console.error(`[VideoJobQueue] Failed to update shot ${job.shotId} after retries`);
      }
    } else {
      console.log(`[VideoJobQueue] Job ${job.id} failed: ${result.error}`);
      await updateShotWithRetry(job.shotId, {
        videoStatus: "failed",
        videoError: result.error || "Unknown error",
      });
    }
  } catch (error) {
    console.error(`[VideoJobQueue] Job ${job.id} error:`, error);
    await updateShotWithRetry(job.shotId, {
      videoStatus: "failed",
      videoError: String(error),
    });
  }
}

export function getQueueStatus() {
  return {
    pending: jobQueue.length,
    processing: processingJobs.size,
  };
}
