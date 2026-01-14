import type { CharacterPoseType, CharacterImageVariantStatus, ImageProvider } from "@shared/schema";
import { generateImage } from "./image-providers";

interface CharacterImageJob {
  id: string;
  variantId: string;
  characterId: string;
  characterName: string;
  poseType: CharacterPoseType;
  prompt: string;
  batchId: string;
  provider: ImageProvider;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
}

const jobQueue: CharacterImageJob[] = [];
const processingJobs = new Set<string>();
const MAX_CONCURRENT_JOBS = 2;
let isProcessing = false;

type VariantUpdater = (variantId: string, updates: Record<string, unknown>) => Promise<unknown>;
let variantUpdateFn: VariantUpdater | null = null;

export function initializeCharacterImageJobQueue(updateVariant: VariantUpdater) {
  variantUpdateFn = updateVariant;
  console.log("[CharacterImageJobQueue] Initialized");
}

export function enqueueCharacterImageJob(
  variantId: string,
  characterId: string,
  characterName: string,
  poseType: CharacterPoseType,
  prompt: string,
  batchId: string,
  provider: ImageProvider = "openai"
): string {
  const jobId = `char_img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const job: CharacterImageJob = {
    id: jobId,
    variantId,
    characterId,
    characterName,
    poseType,
    prompt,
    batchId,
    provider,
    status: "pending",
    createdAt: new Date(),
  };

  jobQueue.push(job);
  console.log(`[CharacterImageJobQueue] Enqueued job ${jobId} for variant ${variantId} using ${provider}`);

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

async function updateVariantWithRetry(variantId: string, updates: Record<string, unknown>, maxRetries = 3): Promise<boolean> {
  if (!variantUpdateFn) return false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await variantUpdateFn(variantId, updates);
      return true;
    } catch (error) {
      console.error(`[CharacterImageJobQueue] Storage update failed (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return false;
}

async function processJob(job: CharacterImageJob) {
  console.log(`[CharacterImageJobQueue] Processing job ${job.id} for variant ${job.variantId} using ${job.provider}`);

  await updateVariantWithRetry(job.variantId, {
    status: "generating" as CharacterImageVariantStatus,
  });

  try {
    const result = await generateImage(job.prompt, job.provider);
    const base64Image = `data:image/png;base64,${result.buffer.toString("base64")}`;

    console.log(`[CharacterImageJobQueue] Job ${job.id} completed successfully with ${result.provider}`);
    const updated = await updateVariantWithRetry(job.variantId, {
      imageUrl: base64Image,
      status: "completed" as CharacterImageVariantStatus,
      errorMessage: null,
    });
    if (!updated) {
      console.error(`[CharacterImageJobQueue] Failed to update variant ${job.variantId} after retries`);
    }
  } catch (error) {
    console.error(`[CharacterImageJobQueue] Job ${job.id} error:`, error);
    await updateVariantWithRetry(job.variantId, {
      status: "failed" as CharacterImageVariantStatus,
      errorMessage: String(error),
    });
  }
}

export function getQueueStatus() {
  return {
    pending: jobQueue.filter(j => j.status === "pending").length,
    processing: processingJobs.size,
    total: jobQueue.length + processingJobs.size,
  };
}

export function getPendingJobsForCharacter(characterId: string): CharacterImageJob[] {
  return jobQueue.filter(j => j.characterId === characterId);
}
