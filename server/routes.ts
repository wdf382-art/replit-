import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import multer from "multer";
import mammoth from "mammoth";
import * as pdfParse from "pdf-parse";
import { storage } from "./storage";
import { openai } from "./replit_integrations/image/client";
import { registerImageRoutes } from "./replit_integrations/image";
import { 
  extractScenesFromScriptWithAI, 
  matchCallSheetToScenesWithAI,
  extractSceneIdentifiersFromCallSheet,
  type ExtractedScene 
} from "./ai-scene-extractor";
import {
  initializeCharacterImageJobQueue,
  enqueueCharacterImageJob,
  getQueueStatus as getCharacterImageQueueStatus,
} from "./character-image-job-queue";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["text/plain", "text/markdown", "application/octet-stream", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"];
    const allowedExts = [".txt", ".md", ".fountain", ".docx", ".pdf"];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf("."));
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("不支持的文件格式。请上传 .txt, .md, .fountain, .docx 或 .pdf 格式的剧本文件"));
    }
  },
});
import {
  insertProjectSchema,
  insertScriptSchema,
  insertSceneSchema,
  insertShotSchema,
  insertCharacterSchema,
  insertPerformanceGuideSchema,
  insertSceneAnalysisSchema,
  insertProductionNotesSchema,
  insertCallSheetSchema,
  directorStyleInfo,
  directorStyleRulesV2,
  universalCinematographyRules,
  visualStyleInfo,
  shotTypeInfo,
  cameraAngleInfo,
  cameraMovementInfo,
  PerformanceGuideV2GenerationSchema,
  ScriptAnalysisGlobalGenerationSchema,
  type DirectorStyle,
  type VisualStyle,
  type AspectRatio,
  type ProjectType,
  characterPoseTypes,
  characterPoseTypeLabels,
  type CharacterPoseType,
  type ImageProvider,
} from "@shared/schema";

const ScriptGenerationSchema = z.object({
  script: z.string().default(""),
  scenes: z.array(z.object({
    sceneNumber: z.number().default(1),
    title: z.string().default("未命名场次"),
    location: z.string().optional(),
    timeOfDay: z.string().optional(),
    description: z.string().optional(),
    dialogue: z.string().optional(),
    action: z.string().optional(),
  })).default([]),
  characters: z.array(z.object({
    name: z.string().default("未命名角色"),
    description: z.string().optional(),
  })).default([]),
  suggestions: z.string().optional(),
});

const ShotsGenerationSchema = z.object({
  shots: z.array(z.object({
    shotNumber: z.number().default(1),
    description: z.string().default("镜头描述待生成"),
    shotType: z.string().optional(),
    cameraAngle: z.string().optional(),
    cameraMovement: z.string().optional(),
    duration: z.number().optional(),
    atmosphere: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),
});

const PerformanceGuideSchema = z.object({
  emotionBefore: z.string().optional(),
  emotionDuring: z.string().optional(),
  emotionAfter: z.string().optional(),
  directorNotes: z.string().optional(),
  performanceOptions: z.array(z.object({
    option: z.string().default("方案"),
    description: z.string().default("描述待生成"),
    actions: z.array(z.string()).default([]),
  })).default([]),
  dialogueSuggestions: z.string().optional(),
  actionSuggestions: z.string().optional(),
});

const ProductionNotesSchema = z.object({
  notes: z.array(z.object({
    characterName: z.string().optional(),
    characterId: z.string().nullable().optional(),
    costumeNotes: z.string().optional(),
    makeupNotes: z.string().optional(),
    propsRequired: z.array(z.string()).default([]),
    continuityNotes: z.string().optional(),
  })).default([]),
});

const defaultFallbacks = {
  script: { script: "", scenes: [], characters: [], suggestions: "" },
  shots: { shots: [] },
  performance: { emotionBefore: "", emotionDuring: "", emotionAfter: "", directorNotes: "", performanceOptions: [], dialogueSuggestions: "", actionSuggestions: "" },
  production: { notes: [] },
  scriptAnalysisGlobal: { characterArcs: [], relationships: [], emotionMap: [], keyScenes: [], overallTheme: "" },
  performanceGuideV2: { 
    sceneHook: { hookDescription: "", hookType: "", hookPosition: "", hookTrigger: "", emotionCurve: { opening: 50, buildup: 50, climax: 50, ending: 50 }, beforeAfterContrast: { before: "", during: "", after: "" } },
    sceneDiagnosis: { isFlatScene: false, flatReasons: [], solutions: [] },
    emotionalChain: { previousScene: null, currentScene: { emotionalStartpoint: "", emotionalEndpoint: "", sceneObjective: "" }, nextScene: null, directorTip: "" },
    characterPerformances: [],
    scriptSuggestions: { issues: [], improvements: [] },
    propPerformance: [],
    costumeProgression: [],
  },
};

// Standalone function to extract scene content from script
// This function can be reused by call sheet parsing, scene preview, and scene creation
export function extractSceneContentFromScript(scriptContent: string, sceneNum: number): { 
  title: string | null; 
  location: string | null; 
  timeOfDay: string | null; 
  description: string | null; 
  dialogue: string | null; 
  action: string | null; 
} {
  if (!scriptContent) {
    console.log(`[Scene Extract] No script content available for scene ${sceneNum}`);
    return { title: null, location: null, timeOfDay: null, description: null, dialogue: null, action: null };
  }
  
  console.log(`[Scene Extract] Attempting to extract scene ${sceneNum} from script (${scriptContent.length} chars)`);
  
  // Match scene header line patterns, supporting multiple formats:
  // 第1场, 1-1, 1.1, 场次1 etc.
  const scenePatterns = [
    // Most common: match "第X场" format (e.g., "第1场 医院走廊 日 内")
    new RegExp(`(?:^|[\\n\\r])\\s*(第\\s*${sceneNum}\\s*[场集次][^\\n\\r]*)([\\s\\S]*?)(?=[\\n\\r]\\s*第\\s*[一二三四五六七八九十百\\d]+\\s*[场集次]|[\\n\\r]\\s*\\d+[-.]\\d+\\s|$)`, 'i'),
    // Match "X-Y" or "X.Y" format (e.g., 1-1, 4-8, 4.1)
    new RegExp(`(?:^|[\\n\\r])\\s*(${sceneNum}[-.]\\d+[^\\n\\r]*)([\\s\\S]*?)(?=[\\n\\r]\\s*\\d+[-.]\\d+\\s|[\\n\\r]\\s*第[一二三四五六七八九十百\\d]+[场集]|$)`, 'i'),
    // Match plain "场次X" format
    new RegExp(`(?:^|[\\n\\r])\\s*(场次\\s*${sceneNum}[^\\n\\r]*)([\\s\\S]*?)(?=[\\n\\r]\\s*场次\\s*\\d+|[\\n\\r]\\s*第\\d+场|$)`, 'i'),
  ];
  
  let matchedContent = '';
  let matchedTitle = '';
  
  for (let i = 0; i < scenePatterns.length; i++) {
    const pattern = scenePatterns[i];
    const match = scriptContent.match(pattern);
    if (match) {
      matchedTitle = match[1]?.trim() || '';
      matchedContent = match[2]?.trim() || '';
      console.log(`[Scene Extract] Pattern ${i + 1} matched for scene ${sceneNum}: title="${matchedTitle.substring(0, 50)}..."`);
      break;
    }
  }
  
  if (!matchedContent && !matchedTitle) {
    console.log(`[Scene Extract] No match found for scene ${sceneNum}`);
    return { title: null, location: null, timeOfDay: null, description: null, dialogue: null, action: null };
  }
  
  console.log(`[Scene Extract] Found content for scene ${sceneNum}: ${matchedContent.length} chars`);
  
  // Parse time and location (usually in the title line)
  let location: string | null = null;
  let timeOfDay: string | null = null;
  
  // Match location (usually in title, e.g., "医院走廊", "秦天家")
  const locationMatch = matchedTitle.match(/([^\d\s年月日夜内外]+(?:家|院|室|厅|房|街|道|楼|场|店|局|处|所|馆|园|村|镇|城|区|河边|别墅|走廊|书房|卧室|办公室)[^\s]*)/);
  if (locationMatch) {
    location = locationMatch[1];
  }
  
  // Match time (日、夜、黄昏 etc.)
  const timeMatch = matchedTitle.match(/(日|夜|黄昏|清晨|傍晚|午后|凌晨)/);
  if (timeMatch) {
    timeOfDay = timeMatch[1];
  }
  
  // Separate dialogue and action descriptions
  const lines = matchedContent.split('\n');
  const dialogueLines: string[] = [];
  const actionLines: string[] = [];
  const descriptionLines: string[] = [];
  
  let currentSection = 'description';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Determine if it's dialogue or action
    // Dialogue usually formatted as: 角色名：对白内容 or 角色名（VO）：对白
    if (/^[^\s△▲●○◆◇【】\[\]]+[:：]/.test(trimmedLine) || /\(VO\)|（VO）/.test(trimmedLine)) {
      dialogueLines.push(trimmedLine);
      currentSection = 'dialogue';
    } 
    // Action descriptions usually start with △ or ▲
    else if (/^[△▲]/.test(trimmedLine)) {
      actionLines.push(trimmedLine.replace(/^[△▲]\s*/, ''));
      currentSection = 'action';
    }
    // Character line
    else if (/^人物[:：]/.test(trimmedLine)) {
      descriptionLines.push(trimmedLine);
    }
    // Other content goes to description
    else {
      if (currentSection === 'dialogue' && dialogueLines.length > 0) {
        // Possibly continuation of dialogue
        dialogueLines.push(trimmedLine);
      } else {
        descriptionLines.push(trimmedLine);
      }
    }
  }
  
  return {
    title: matchedTitle || null,
    location,
    timeOfDay,
    description: descriptionLines.length > 0 ? descriptionLines.join('\n') : null,
    dialogue: dialogueLines.length > 0 ? dialogueLines.join('\n') : null,
    action: actionLines.length > 0 ? actionLines.join('\n') : null,
  };
}

function safeParseJSON<T>(content: string, schema: z.ZodSchema<T>, fallbackKey?: keyof typeof defaultFallbacks): T {
  try {
    const parsed = JSON.parse(content);
    const validated = schema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    console.error("Validation errors:", validated.error);
    const fallback = fallbackKey ? defaultFallbacks[fallbackKey] : {};
    return schema.parse(fallback) as T;
  } catch (error) {
    console.error("JSON parse error:", error);
    const fallback = fallbackKey ? defaultFallbacks[fallbackKey] : {};
    return schema.parse(fallback) as T;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize video job queue with storage update function
  const { initializeVideoJobQueue } = await import("./video-job-queue");
  initializeVideoJobQueue(async (shotId, updates) => {
    return storage.updateShot(shotId, updates);
  });
  
  // Initialize character image job queue with storage update function
  initializeCharacterImageJobQueue(async (variantId, updates) => {
    return storage.updateCharacterImageVariant(variantId, updates);
  });
  
  registerImageRoutes(app);
  
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const project = await storage.createProject(parsed.data);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.get("/api/scripts", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const scripts = await storage.getScripts(projectId);
      res.json(scripts);
    } catch (error) {
      console.error("Error fetching scripts:", error);
      res.status(500).json({ error: "Failed to fetch scripts" });
    }
  });

  app.post("/api/scripts", async (req, res) => {
    try {
      const script = await storage.createScript({
        projectId: req.body.projectId,
        content: req.body.content,
        isActive: true,
      });
      res.status(201).json(script);
    } catch (error) {
      console.error("Error creating script:", error);
      res.status(500).json({ error: "Failed to create script" });
    }
  });

  app.post("/api/scripts/generate", async (req, res) => {
    try {
      const { idea, type, duration, projectId } = req.body as {
        idea: string;
        type: ProjectType;
        duration: number;
        projectId?: string;
      };

      const typeNames: Record<ProjectType, string> = {
        advertisement: "广告",
        short_video: "短视频",
        movie: "电影",
        web_series: "网剧",
        micro_film: "微电影",
        documentary: "纪录片",
        mv: "MV",
      };

      const prompt = `你是一位专业的编剧。请根据以下创意，生成一个${typeNames[type]}剧本。
目标时长：${duration}分钟
创意/故事梗概：${idea}

请生成标准剧本格式，包含：
1. 场景设定（INT/EXT、地点、时间）
2. 动作描写
3. 对白
4. 过渡提示

同时请提取所有场次信息和角色信息。

请以JSON格式返回，包含以下字段：
{
  "script": "完整剧本内容",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "场次标题",
      "location": "地点",
      "timeOfDay": "日/夜",
      "description": "场景描述",
      "dialogue": "对白内容",
      "action": "动作描写"
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "description": "角色描述"
    }
  ],
  "suggestions": "对剧本的优化建议"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = safeParseJSON(content, ScriptGenerationSchema, "script");

      let actualProjectId = projectId;
      if (!actualProjectId) {
        const project = await storage.createProject({
          title: result.scenes[0]?.title || "新项目",
          type,
          description: idea.substring(0, 200),
          targetDuration: duration * 60,
        });
        actualProjectId = project.id;
      }

      const script = await storage.createScript({
        projectId: actualProjectId,
        content: result.script,
        suggestions: result.suggestions,
        isActive: true,
      });

      for (const scene of result.scenes) {
        await storage.createScene({
          projectId: actualProjectId,
          scriptId: script.id,
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          location: scene.location,
          timeOfDay: scene.timeOfDay,
          description: scene.description,
          dialogue: scene.dialogue,
          action: scene.action,
        });
      }

      for (const character of result.characters) {
        await storage.createCharacter({
          projectId: actualProjectId,
          name: character.name,
          description: character.description,
        });
      }

      res.json({ script, projectId: actualProjectId });
    } catch (error) {
      console.error("Error generating script:", error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });

  app.post("/api/scripts/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "请上传剧本文件" });
      }

      const { projectId, extractScenes } = req.body as {
        projectId?: string;
        extractScenes?: string;
      };

      const ext = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf("."));
      let content: string;
      
      if (ext === ".docx") {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        content = result.value;
      } else if (ext === ".pdf") {
        const result = await pdfParse(req.file.buffer);
        content = result.text;
      } else {
        content = req.file.buffer.toString("utf-8");
      }
      
      const fileName = req.file.originalname.replace(/\.[^/.]+$/, "");

      let actualProjectId = projectId;
      if (!actualProjectId) {
        const project = await storage.createProject({
          title: fileName || "上传的剧本",
          type: "movie",
          description: `通过文件上传: ${req.file.originalname}`,
          targetDuration: 90 * 60,
        });
        actualProjectId = project.id;
      }

      const script = await storage.createScript({
        projectId: actualProjectId,
        content,
        isActive: true,
      });

      // 自动提取所有场次 - 使用正则表达式从剧本中识别场次标记
      const autoExtractedSceneNumbers: number[] = [];
      
      // 辅助函数：将中文数字转换为阿拉伯数字
      const chineseToNumber = (str: string): number => {
        const map: { [key: string]: number } = {
          '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
          '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
          '十': 10, '百': 100, '千': 1000
        };
        let result = 0;
        let temp = 0;
        for (const char of str) {
          const val = map[char];
          if (val === undefined) continue;
          if (val >= 10) {
            if (temp === 0) temp = 1;
            result += temp * val;
            temp = 0;
          } else {
            temp = val;
          }
        }
        return result + temp;
      };

      // Pattern 1: 第X场 with Arabic numbers
      const arabicPattern = /(?:^|[\n\r])\s*第\s*(\d+)\s*[场集次]/gi;
      let match;
      while ((match = arabicPattern.exec(content)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && !autoExtractedSceneNumbers.includes(num)) {
          autoExtractedSceneNumbers.push(num);
        }
      }

      // Pattern 2: 第X场 with Chinese numbers (一二三...)
      const chinesePattern = /(?:^|[\n\r])\s*第\s*([一二三四五六七八九十百千零]+)\s*[场集次]/gi;
      while ((match = chinesePattern.exec(content)) !== null) {
        const num = chineseToNumber(match[1]);
        if (num > 0 && !autoExtractedSceneNumbers.includes(num)) {
          autoExtractedSceneNumbers.push(num);
        }
      }

      // Pattern 3: X-Y or X.Y format (e.g., 1-1, 4-8)
      const dashPattern = /(?:^|[\n\r])\s*(\d+)[-.](\d+)\s/gi;
      while ((match = dashPattern.exec(content)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && !autoExtractedSceneNumbers.includes(num)) {
          autoExtractedSceneNumbers.push(num);
        }
      }

      // Pattern 4: 场次X format
      const sceneNumPattern = /(?:^|[\n\r])\s*场次\s*(\d+)/gi;
      while ((match = sceneNumPattern.exec(content)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && !autoExtractedSceneNumbers.includes(num)) {
          autoExtractedSceneNumbers.push(num);
        }
      }

      // Sort and create scenes automatically
      autoExtractedSceneNumbers.sort((a, b) => a - b);
      console.log(`[Script Upload] Auto-extracted ${autoExtractedSceneNumbers.length} scenes: ${autoExtractedSceneNumbers.join(', ')}`);

      // 获取项目中已存在的场次，避免重复创建
      const existingScenes = await storage.getScenes(actualProjectId);
      const existingSceneNumbers = new Set(existingScenes.map(s => s.sceneNumber));

      const createdScenes = [];
      const updatedScenes = [];
      for (const sceneNum of autoExtractedSceneNumbers) {
        const extracted = extractSceneContentFromScript(content, sceneNum);
        
        // 检查场次是否已存在
        const existingScene = existingScenes.find(s => s.sceneNumber === sceneNum);
        
        if (existingScene) {
          // 更新已存在的场次内容
          await storage.updateScene(existingScene.id, {
            scriptId: script.id,
            title: extracted.title || existingScene.title,
            location: extracted.location || existingScene.location,
            timeOfDay: extracted.timeOfDay || existingScene.timeOfDay,
            description: extracted.description || existingScene.description,
            dialogue: extracted.dialogue || existingScene.dialogue,
            action: extracted.action || existingScene.action,
          });
          updatedScenes.push(existingScene);
        } else {
          // 创建新场次
          const scene = await storage.createScene({
            projectId: actualProjectId,
            scriptId: script.id,
            sceneNumber: sceneNum,
            title: extracted.title || `第 ${sceneNum} 场`,
            location: extracted.location,
            timeOfDay: extracted.timeOfDay,
            description: extracted.description,
            dialogue: extracted.dialogue,
            action: extracted.action,
          });
          createdScenes.push(scene);
        }
      }

      console.log(`[Script Upload] Created ${createdScenes.length} new scenes, updated ${updatedScenes.length} existing scenes for project ${actualProjectId}`);

      res.json({ 
        script, 
        projectId: actualProjectId, 
        fileName: req.file.originalname,
        extractedScenes: createdScenes.length,
        sceneNumbers: autoExtractedSceneNumbers
      });
    } catch (error) {
      console.error("Error uploading script:", error);
      res.status(500).json({ error: "上传失败，请重试" });
    }
  });

  app.get("/api/scenes", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const scenes = await storage.getScenes(projectId);
      res.json(scenes);
    } catch (error) {
      console.error("Error fetching scenes:", error);
      res.status(500).json({ error: "Failed to fetch scenes" });
    }
  });

  app.post("/api/scenes/preview", async (req, res) => {
    try {
      const { projectId, sceneNumber } = req.body as { projectId: string; sceneNumber: number };
      if (!projectId || !sceneNumber) {
        return res.status(400).json({ error: "projectId and sceneNumber are required" });
      }

      const scripts = await storage.getScripts(projectId);
      const activeScript = scripts.find(s => s.isActive);
      
      if (!activeScript?.content) {
        return res.json({ 
          found: false, 
          message: "没有找到活动的剧本",
          title: null,
          location: null, 
          timeOfDay: null, 
          description: null, 
          dialogue: null, 
          action: null 
        });
      }

      const extracted = extractSceneContentFromScript(activeScript.content, sceneNumber);
      
      if (!extracted.title && !extracted.description && !extracted.dialogue && !extracted.action) {
        return res.json({ 
          found: false, 
          message: `剧本中未找到场次 ${sceneNumber} 的内容`,
          ...extracted
        });
      }

      res.json({ 
        found: true, 
        message: `已从剧本中提取场次 ${sceneNumber} 的内容`,
        scriptId: activeScript.id,
        ...extracted 
      });
    } catch (error) {
      console.error("Error previewing scene:", error);
      res.status(500).json({ error: "Failed to preview scene content" });
    }
  });

  // Extract all scenes from script using AI
  app.post("/api/scenes/extract-all", async (req, res) => {
    try {
      const { projectId, forceRefresh } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const scripts = await storage.getScripts(projectId);
      const activeScript = scripts.find(s => s.isActive);
      
      if (!activeScript?.content) {
        return res.status(400).json({ error: "没有找到活动的剧本或剧本内容为空" });
      }

      // Get existing scenes
      const existingScenes = await storage.getScenes(projectId);
      
      // If forceRefresh is true, delete all existing scenes first
      if (forceRefresh && existingScenes.length > 0) {
        console.log(`[Extract All] Force refresh - deleting ${existingScenes.length} existing scenes`);
        for (const scene of existingScenes) {
          await storage.deleteScene(scene.id);
        }
      }

      // Use AI to extract scenes
      console.log("[Extract All] Using AI to extract scenes from script");
      const extractedScenes = await extractScenesFromScriptWithAI(activeScript.content);
      
      if (extractedScenes.length === 0) {
        return res.status(400).json({ error: "AI 未能从剧本中识别出场次，请检查剧本格式" });
      }

      // Create scenes from AI extraction
      const createdScenes = [];
      const existingIdentifiers = forceRefresh 
        ? new Set<string>() 
        : new Set(existingScenes.map(s => s.sceneIdentifier || s.title));

      for (const extracted of extractedScenes) {
        // Skip if this scene identifier already exists
        if (existingIdentifiers.has(extracted.sceneIdentifier)) {
          console.log(`[Extract All] Skipping existing scene: ${extracted.sceneIdentifier}`);
          continue;
        }

        // Extract scene number from identifier for backwards compatibility
        const sceneNumMatch = extracted.sceneIdentifier.match(/^(\d+)/);
        const sceneNumber = sceneNumMatch ? parseInt(sceneNumMatch[1], 10) : extracted.sortOrder + 1;
        
        const scene = await storage.createScene({
          projectId,
          sceneNumber,
          sceneIdentifier: extracted.sceneIdentifier,
          sortOrder: extracted.sortOrder,
          scriptId: activeScript.id,
          title: extracted.title || extracted.sceneIdentifier,
          location: extracted.location,
          timeOfDay: extracted.timeOfDay,
          description: extracted.description,
          dialogue: extracted.dialogue,
          action: extracted.action,
          scriptContent: extracted.scriptContent,
        });
        
        createdScenes.push(scene);
        existingIdentifiers.add(extracted.sceneIdentifier);
      }

      res.status(201).json({ 
        message: `成功从剧本提取并创建了 ${createdScenes.length} 个场次`,
        totalFound: extractedScenes.length,
        created: createdScenes.length,
        skipped: extractedScenes.length - createdScenes.length,
        scenes: createdScenes
      });
    } catch (error) {
      console.error("Error extracting all scenes:", error);
      res.status(500).json({ error: "Failed to extract scenes from script" });
    }
  });

  // AI-powered call sheet scene matching
  app.post("/api/call-sheets/match-scenes", async (req, res) => {
    try {
      const { projectId, callSheetText } = req.body;
      if (!projectId || !callSheetText) {
        return res.status(400).json({ error: "projectId and callSheetText are required" });
      }

      // Get existing scenes for the project
      const existingScenes = await storage.getScenes(projectId);
      if (existingScenes.length === 0) {
        return res.status(400).json({ error: "项目中没有场次，请先从剧本提取场次" });
      }

      // Format scenes for AI matching
      const scenesForMatching = existingScenes.map(s => ({
        identifier: s.sceneIdentifier || s.title || `场次${s.sceneNumber}`,
        title: s.title,
        content: s.scriptContent || s.description || s.action || ""
      }));

      // Use AI to match call sheet references to scenes
      const matches = await matchCallSheetToScenesWithAI(callSheetText, scenesForMatching);

      // Update scenes that are matched as being in call sheet
      const matchedSceneIds: string[] = [];
      for (const match of matches) {
        const matchedScene = existingScenes.find(s => 
          s.sceneIdentifier === match.matchedSceneIdentifier ||
          s.title === match.matchedSceneIdentifier
        );
        if (matchedScene) {
          await storage.updateScene(matchedScene.id, { isInCallSheet: true });
          matchedSceneIds.push(matchedScene.id);
        }
      }

      res.json({
        message: `成功匹配 ${matches.length} 个场次`,
        matches,
        matchedSceneIds
      });
    } catch (error) {
      console.error("Error matching call sheet to scenes:", error);
      res.status(500).json({ error: "Failed to match call sheet to scenes" });
    }
  });

  app.post("/api/scenes", async (req, res) => {
    try {
      const parsed = insertSceneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const { projectId, sceneNumber, title } = parsed.data;
      
      const scripts = await storage.getScripts(projectId);
      const activeScript = scripts.find(s => s.isActive);
      
      let sceneData = { ...parsed.data };
      
      if (activeScript?.content) {
        const extracted = extractSceneContentFromScript(activeScript.content, sceneNumber);
        
        sceneData = {
          ...sceneData,
          scriptId: activeScript.id,
          title: title || extracted.title || `第 ${sceneNumber} 场`,
          location: sceneData.location || extracted.location,
          timeOfDay: sceneData.timeOfDay || extracted.timeOfDay,
          description: sceneData.description || extracted.description,
          dialogue: sceneData.dialogue || extracted.dialogue,
          action: sceneData.action || extracted.action,
        };
      }
      
      const scene = await storage.createScene(sceneData);
      res.status(201).json(scene);
    } catch (error) {
      console.error("Error creating scene:", error);
      res.status(500).json({ error: "Failed to create scene" });
    }
  });

  app.patch("/api/scenes/:id", async (req, res) => {
    try {
      const scene = await storage.updateScene(req.params.id, req.body);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }
      res.json(scene);
    } catch (error) {
      console.error("Error updating scene:", error);
      res.status(500).json({ error: "Failed to update scene" });
    }
  });

  app.delete("/api/scenes/:id", async (req, res) => {
    try {
      const scene = await storage.getScene(req.params.id);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }
      await storage.deleteScene(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scene:", error);
      res.status(500).json({ error: "Failed to delete scene" });
    }
  });

  app.get("/api/shots", async (req, res) => {
    try {
      const sceneId = req.query.sceneId as string;
      const directorStyle = req.query.directorStyle as string | undefined;
      if (!sceneId) {
        return res.status(400).json({ error: "sceneId is required" });
      }
      const shots = await storage.getShots(sceneId, directorStyle);
      res.json(shots);
    } catch (error) {
      console.error("Error fetching shots:", error);
      res.status(500).json({ error: "Failed to fetch shots" });
    }
  });

  const GenerateShotsSchema = z.object({
    sceneId: z.string().min(1),
    directorStyle: z.string(),
    customDirectorStyle: z.string().optional(),
    visualStyle: z.string(),
    customVisualStyle: z.string().optional(),
    aspectRatio: z.string().default("16:9"),
    customAspectRatio: z.string().optional(),
  }).refine(data => {
    if (data.directorStyle === "custom" && !data.customDirectorStyle?.trim()) {
      return false;
    }
    return true;
  }, { message: "Custom director style description is required when using custom style" })
  .refine(data => {
    if (data.visualStyle === "custom" && !data.customVisualStyle?.trim()) {
      return false;
    }
    return true;
  }, { message: "Custom visual style description is required when using custom style" })
  .refine(data => {
    if (data.aspectRatio === "custom" && !data.customAspectRatio?.trim()) {
      return false;
    }
    return true;
  }, { message: "Custom aspect ratio is required when using custom ratio" });

  app.post("/api/shots/generate", async (req, res) => {
    try {
      const parsed = GenerateShotsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const { sceneId, directorStyle, customDirectorStyle, visualStyle, customVisualStyle, aspectRatio, customAspectRatio } = parsed.data;

      const scene = await storage.getScene(sceneId);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      const isCustomDirector = directorStyle === "custom";
      const isCustomVisual = visualStyle === "custom";
      const isCustomAspect = aspectRatio === "custom";
      
      const director = !isCustomDirector ? directorStyleInfo[directorStyle as DirectorStyle] : null;
      const visual = !isCustomVisual ? visualStyleInfo[visualStyle as VisualStyle] : null;
      const finalAspectRatio = isCustomAspect ? customAspectRatio : aspectRatio;

      const directorDescription = isCustomDirector 
        ? `自定义导演风格：${customDirectorStyle}`
        : `${director!.nameCN}（${director!.name}）的导演风格。\n${director!.nameCN}的风格特点：${director!.traits}\n代表作品：${director!.works}`;
      
      const visualDescription = isCustomVisual
        ? `自定义画面风格：${customVisualStyle}`
        : `${visual!.nameCN}`;

      const directorRules = !isCustomDirector 
        ? directorStyleRulesV2[directorStyle as DirectorStyle]
        : null;

      const buildRuleVariantsSection = (rules: typeof directorRules) => {
        if (!rules) return "";
        const rv = rules.ruleVariants;
        return `### 对通用规则的处理方式
| 规则 | 处理 | 说明 |
|------|------|------|
| A1 景别过渡 | ${rv.A1_景别过渡.variant} | ${rv.A1_景别过渡.description} |
| A2 30度规则 | ${rv.A2_30度规则.variant} | ${rv.A2_30度规则.description} |
| A3 轴线规则 | ${rv.A3_轴线规则.variant} | ${rv.A3_轴线规则.description} |
| B1 镜头时长 | ${rv.B1_镜头时长.variant} | ${rv.B1_镜头时长.description} |
| B2 开场方式 | ${rv.B2_开场方式.variant} | ${rv.B2_开场方式.description} |
| B3 高潮处理 | ${rv.B3_高潮处理.variant} | ${rv.B3_高潮处理.description} |
| C1 视线匹配 | ${rv.C1_视线匹配.variant} | ${rv.C1_视线匹配.description} |
| C2 动作衔接 | ${rv.C2_动作衔接.variant} | ${rv.C2_动作衔接.description} |
| C3 情绪承接 | ${rv.C3_情绪承接.variant} | ${rv.C3_情绪承接.description} |
| D 叙事结构 | ${rv.D_叙事结构.variant} | ${rv.D_叙事结构.description} |`;
      };

      const directorRulesSection = isCustomDirector 
        ? `\n## 导演专属分镜策略\n根据用户自定义风格：${customDirectorStyle}\n请据此设计符合该风格的镜头语言。`
        : `\n## 导演专属分镜策略（${director!.nameCN}）

${buildRuleVariantsSection(directorRules)}

### 摄影机运动 (E)
- 运动类型：${directorRules!.cameraMovement.E1_运动类型}
- 运动节奏：${directorRules!.cameraMovement.E2_运动节奏}
- 运动动机：${directorRules!.cameraMovement.E3_运动动机}

### 构图风格 (F)
- 对称性：${directorRules!.composition.F1_对称性}
- 空间深度：${directorRules!.composition.F2_空间深度}
- 画面重心：${directorRules!.composition.F3_画面重心}
- 框架利用：${directorRules!.composition.F4_框架利用}

### 色彩风格 (G)
- 色调倾向：${directorRules!.color.G1_色调倾向}
- 饱和度：${directorRules!.color.G2_饱和度}
- 色彩叙事：${directorRules!.color.G3_色彩叙事}

### 光线风格 (H)
- 光源类型：${directorRules!.lighting.H1_光源类型}
- 光影对比：${directorRules!.lighting.H2_光影对比}
- 光线叙事：${directorRules!.lighting.H3_光线叙事}

### 标志性技法
${directorRules!.signatures.map(s => `- ${s}`).join('\n')}`;

      const sceneContentLength = (scene.description?.length || 0) + (scene.dialogue?.length || 0) + (scene.action?.length || 0) + ((scene as any).scriptContent?.length || 0);
      const estimatedMinutes = Math.max(0.5, sceneContentLength / 300);
      const estimatedSeconds = Math.round(estimatedMinutes * 60);

      const prompt = `你是一位专业的电影分镜师，精通${directorDescription}

请为以下场次设计分镜头：
场次${scene.sceneNumber}：${scene.title}
地点：${scene.location || "未指定"}
时间：${scene.timeOfDay || "未指定"}
描述：${scene.description || ""}
动作：${scene.action || ""}
对白：${scene.dialogue || ""}

画面风格要求：${visualDescription}
画幅比例：${finalAspectRatio || "16:9"}

## 镜头数量参考
- 该场次剧本约${sceneContentLength}字，预估成片时长约${estimatedSeconds}秒（${estimatedMinutes.toFixed(1)}分钟）
- 请根据内容量和节奏需要自行决定镜头数量，确保所有镜头的duration总和接近预估时长
- 电视剧平均每分钟约15-25个镜头（快节奏）或8-15个镜头（慢节奏）

## 专业分镜规则（必须遵守）

### 1. 景别衔接原则
- 循序渐进：景别变化应有过渡，避免直接从远景跳到特写
- 30度规则：相邻镜头机位变化至少30度，避免跳切感
- 轴线规则：保持180度轴线，确保空间方向连贯

### 2. 镜头节奏控制
- 长短搭配：激烈/紧张场景用短镜头（2-3秒），抒情/沉思场景用长镜头（5-8秒）
- 开场建立：第一个镜头通常是环境交代（远景或全景）
- 高潮递进：情绪高潮前镜头逐渐加快、景别逐渐收紧

### 3. 视觉引导与衔接
- 视线匹配：角色看向画外时，下一镜头展示其视线方向
- 动作衔接：动作在前一镜头开始/进行，后一镜头接续/完成
- 情绪承接：相邻镜头的氛围应有逻辑过渡

### 4. 场景叙事结构
- 起：建立场景空间和人物位置
- 承：展开叙事，推进情节
- 转：情绪或事件转折点
- 合：场景收尾，留有余韵
${directorRulesSection}

请根据场次内容设计合适数量的镜头，严格遵守通用分镜规则的同时，重点体现上述导演专属分镜策略。

返回JSON格式：
{
  "shots": [
    {
      "shotNumber": 1,
      "description": "镜头详细描述（包含画面内容、人物动作、光影氛围）",
      "shotType": "景别（extreme_wide/wide/full/medium/close_up/extreme_close_up/over_shoulder/pov）",
      "cameraAngle": "角度（eye_level/low_angle/high_angle/bird_eye/dutch_angle/worm_eye）",
      "cameraMovement": "运动（static/pan/tilt/dolly/tracking/crane/handheld/steadicam/zoom）",
      "duration": 持续秒数,
      "atmosphere": "画面气氛描述",
      "notes": "导演风格体现 + 与前后镜头的衔接逻辑说明"
    }
  ]
}`;

      console.log(`[Shots Generate] Scene content: ${sceneContentLength} chars, estimated: ${estimatedSeconds}s`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "{}";
      console.log("[Shots Generate] OpenAI response:", content.substring(0, 500));
      const result = safeParseJSON(content, ShotsGenerationSchema, "shots");
      console.log("[Shots Generate] Parsed shots count:", result.shots.length);

      const createdShots = [];
      for (const shot of result.shots) {
        const createdShot = await storage.createShot({
          sceneId,
          shotNumber: shot.shotNumber,
          description: shot.description,
          shotType: shot.shotType,
          cameraAngle: shot.cameraAngle,
          cameraMovement: shot.cameraMovement,
          duration: shot.duration,
          directorStyle: isCustomDirector ? "custom" : directorStyle as DirectorStyle,
          customDirectorStyle: isCustomDirector ? customDirectorStyle : undefined,
          visualStyle: isCustomVisual ? "custom" : visualStyle as VisualStyle,
          customVisualStyle: isCustomVisual ? customVisualStyle : undefined,
          aspectRatio: isCustomAspect ? "custom" : aspectRatio as AspectRatio,
          customAspectRatio: isCustomAspect ? customAspectRatio : undefined,
          atmosphere: shot.atmosphere,
          notes: shot.notes,
        });
        createdShots.push(createdShot);
      }

      res.json(createdShots);
    } catch (error) {
      console.error("Error generating shots:", error);
      res.status(500).json({ error: "Failed to generate shots" });
    }
  });

  app.patch("/api/shots/:id", async (req, res) => {
    try {
      const shot = await storage.updateShot(req.params.id, req.body);
      if (!shot) {
        return res.status(404).json({ error: "Shot not found" });
      }
      res.json(shot);
    } catch (error) {
      console.error("Error updating shot:", error);
      res.status(500).json({ error: "Failed to update shot" });
    }
  });

  // Generate image for a single shot with auto-retry
  app.post("/api/shots/:id/generate-image", async (req, res) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 2000;
    
    try {
      const shot = await storage.getShot(req.params.id);
      if (!shot) {
        return res.status(404).json({ error: "Shot not found" });
      }

      const scene = await storage.getScene(shot.sceneId);
      const provider = (req.body?.provider as ImageProvider) || "openai";
      
      const imagePrompt = `Film storyboard frame, cinematic style:
Scene: ${scene?.title || ""}
Location: ${scene?.location || ""}
Time: ${scene?.timeOfDay || ""}

Shot ${shot.shotNumber}: ${shot.description}
Shot type: ${shot.shotType || "medium shot"}
Camera angle: ${shot.cameraAngle || "eye level"}
Camera movement: ${shot.cameraMovement || "static"}
${shot.atmosphere ? `Atmosphere: ${shot.atmosphere}` : ""}

Requirements: Professional film cinematography, cinematic lighting, high quality, movie style, 16:9 aspect ratio`;

      const { generateImage } = await import("./image-providers");
      
      let imageBuffer: Buffer | null = null;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Generating image for shot ${shot.id} using ${provider}, attempt ${attempt}/${MAX_RETRIES}`);
          const result = await generateImage(imagePrompt, provider);
          imageBuffer = result.buffer;
          break;
        } catch (err) {
          lastError = err as Error;
          console.error(`Image generation attempt ${attempt} failed:`, err);
          if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt - 1);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (!imageBuffer) {
        throw lastError || new Error("Failed to generate image after all retries");
      }
      
      const imageBase64 = imageBuffer.toString("base64");

      const updatedShot = await storage.updateShot(shot.id, {
        imageBase64: imageBase64,
      });

      res.json(updatedShot);
    } catch (error) {
      console.error("Error generating shot image:", error);
      res.status(500).json({ error: "Failed to generate shot image" });
    }
  });

  // Generate images for all shots in a scene with SSE progress streaming
  app.get("/api/scenes/:id/generate-all-images-stream", async (req, res) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 2000;
    
    // Track connection state
    let isConnectionClosed = false;
    
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    
    // Handle client disconnect
    req.on("close", () => {
      isConnectionClosed = true;
      console.log("[SSE] Client disconnected from image generation stream");
    });
    
    const sendProgress = (data: object) => {
      if (isConnectionClosed) return;
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        isConnectionClosed = true;
      }
    };
    
    try {
      const scene = await storage.getScene(req.params.id);
      if (!scene) {
        sendProgress({ type: "error", message: "Scene not found" });
        if (!isConnectionClosed) res.end();
        return;
      }

      const shots = await storage.getShots(req.params.id);
      if (!shots || shots.length === 0) {
        sendProgress({ type: "error", message: "No shots to generate images for" });
        if (!isConnectionClosed) res.end();
        return;
      }

      const provider = (req.query?.provider as ImageProvider) || "openai";
      const { generateImage } = await import("./image-providers");
      const results: { id: string; shotNumber: number; success: boolean; error?: string }[] = [];
      const total = shots.length;
      
      sendProgress({ type: "start", total, message: `开始生成 ${total} 张图片...` });
      
      for (let i = 0; i < shots.length; i++) {
        // Check if client disconnected
        if (isConnectionClosed) {
          console.log("[SSE] Stopping image generation - client disconnected");
          break;
        }
        
        const shot = shots[i];
        const currentIndex = i + 1;
        const progress = Math.round((i / total) * 100);
        
        sendProgress({ 
          type: "progress", 
          current: currentIndex, 
          total, 
          progress, 
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          message: `正在生成第 ${currentIndex}/${total} 张图片 (镜头 #${shot.shotNumber})...` 
        });
        
        const imagePrompt = `Film storyboard frame, cinematic style:
Scene: ${scene.title || ""}
Location: ${scene.location || ""}
Time: ${scene.timeOfDay || ""}

Shot ${shot.shotNumber}: ${shot.description}
Shot type: ${shot.shotType || "medium shot"}
Camera angle: ${shot.cameraAngle || "eye level"}
Camera movement: ${shot.cameraMovement || "static"}
${shot.atmosphere ? `Atmosphere: ${shot.atmosphere}` : ""}

Requirements: Professional film cinematography, cinematic lighting, high quality, movie style, 16:9 aspect ratio`;

        let imageBuffer: Buffer | null = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`Generating image for shot ${shot.id} (${shot.shotNumber}) using ${provider}, attempt ${attempt}/${MAX_RETRIES}`);
            const result = await generateImage(imagePrompt, provider);
            imageBuffer = result.buffer;
            break;
          } catch (err) {
            console.error(`Image generation attempt ${attempt} for shot ${shot.id} failed:`, err);
            if (attempt < MAX_RETRIES) {
              const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt - 1);
              sendProgress({ 
                type: "retry", 
                current: currentIndex, 
                total, 
                attempt, 
                maxRetries: MAX_RETRIES,
                message: `重试第 ${attempt}/${MAX_RETRIES} 次...` 
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (imageBuffer) {
          const imageBase64 = imageBuffer.toString("base64");
          await storage.updateShot(shot.id, {
            imageBase64: imageBase64,
          });
          results.push({ id: shot.id, shotNumber: shot.shotNumber, success: true });
          sendProgress({ 
            type: "complete", 
            current: currentIndex, 
            total, 
            progress: Math.round((currentIndex / total) * 100),
            shotId: shot.id,
            shotNumber: shot.shotNumber,
            success: true,
            message: `镜头 #${shot.shotNumber} 生成完成` 
          });
        } else {
          console.error(`Failed to generate image for shot ${shot.id} after ${MAX_RETRIES} attempts`);
          results.push({ id: shot.id, shotNumber: shot.shotNumber, success: false, error: "Generation failed after retries" });
          sendProgress({ 
            type: "complete", 
            current: currentIndex, 
            total, 
            progress: Math.round((currentIndex / total) * 100),
            shotId: shot.id,
            shotNumber: shot.shotNumber,
            success: false,
            message: `镜头 #${shot.shotNumber} 生成失败` 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      sendProgress({ 
        type: "done", 
        results, 
        totalGenerated: successCount,
        total,
        progress: 100,
        message: `完成! 成功生成 ${successCount}/${total} 张图片` 
      });
      if (!isConnectionClosed) res.end();
    } catch (error) {
      console.error("Error generating scene images:", error);
      sendProgress({ type: "error", message: "生成图片时发生错误" });
      if (!isConnectionClosed) res.end();
    }
  });

  // Generate images for all shots in a scene (non-streaming fallback)
  app.post("/api/scenes/:id/generate-all-images", async (req, res) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 2000;
    
    try {
      const scene = await storage.getScene(req.params.id);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      const shots = await storage.getShots(req.params.id);
      if (!shots || shots.length === 0) {
        return res.status(400).json({ error: "No shots to generate images for" });
      }

      const provider = (req.body?.provider as ImageProvider) || "openai";
      const { generateImage } = await import("./image-providers");
      const results = [];
      
      for (const shot of shots) {
        const imagePrompt = `Film storyboard frame, cinematic style:
Scene: ${scene.title || ""}
Location: ${scene.location || ""}
Time: ${scene.timeOfDay || ""}

Shot ${shot.shotNumber}: ${shot.description}
Shot type: ${shot.shotType || "medium shot"}
Camera angle: ${shot.cameraAngle || "eye level"}
Camera movement: ${shot.cameraMovement || "static"}
${shot.atmosphere ? `Atmosphere: ${shot.atmosphere}` : ""}

Requirements: Professional film cinematography, cinematic lighting, high quality, movie style, 16:9 aspect ratio`;

        let imageBuffer: Buffer | null = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`Generating image for shot ${shot.id} (${shot.shotNumber}) using ${provider}, attempt ${attempt}/${MAX_RETRIES}`);
            const result = await generateImage(imagePrompt, provider);
            imageBuffer = result.buffer;
            break;
          } catch (err) {
            console.error(`Image generation attempt ${attempt} for shot ${shot.id} failed:`, err);
            if (attempt < MAX_RETRIES) {
              const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt - 1);
              console.log(`Retrying shot ${shot.id} in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (imageBuffer) {
          const imageBase64 = imageBuffer.toString("base64");
          await storage.updateShot(shot.id, {
            imageBase64: imageBase64,
          });
          results.push({ id: shot.id, shotNumber: shot.shotNumber, success: true });
        } else {
          console.error(`Failed to generate image for shot ${shot.id} after ${MAX_RETRIES} attempts`);
          results.push({ id: shot.id, shotNumber: shot.shotNumber, success: false, error: "Generation failed after retries" });
        }
      }

      res.json({ results, totalGenerated: results.filter(r => r.success).length });
    } catch (error) {
      console.error("Error generating scene images:", error);
      res.status(500).json({ error: "Failed to generate scene images" });
    }
  });

  // Generate video for a single shot from its image (async - returns immediately)
  app.post("/api/shots/:id/generate-video", async (req, res) => {
    try {
      const { model = "veo" } = req.body as { model?: "veo" | "kling" | "jimeng" };
      
      const shot = await storage.getShot(req.params.id);
      if (!shot) {
        return res.status(404).json({ error: "Shot not found" });
      }

      if (!shot.imageBase64) {
        return res.status(400).json({ error: "Shot must have an image before generating video" });
      }

      // Update status to generating
      await storage.updateShot(shot.id, {
        videoStatus: "generating",
        videoModel: model,
      });

      const scene = await storage.getScene(shot.sceneId);
      const videoDescription = `${shot.description}. Camera: ${shot.cameraMovement || "static"}. ${shot.atmosphere || ""}. Scene: ${scene?.title || ""}`;

      // Enqueue job for async processing
      const { enqueueVideoJob } = await import("./video-job-queue");
      const jobId = enqueueVideoJob(shot.id, model, shot.imageBase64, videoDescription, shot.duration || 5);

      // Return immediately with job info
      res.json({ 
        jobId, 
        shotId: shot.id, 
        status: "generating",
        message: "Video generation started. Poll GET /api/shots/:id to check status." 
      });
    } catch (error) {
      console.error("Error starting video generation:", error);
      res.status(500).json({ error: "Failed to start video generation" });
    }
  });

  // Generate videos for all shots in a scene (async - returns immediately)
  app.post("/api/scenes/:id/generate-all-videos", async (req, res) => {
    try {
      const { model = "veo" } = req.body as { model?: "veo" | "kling" | "jimeng" };
      
      const scene = await storage.getScene(req.params.id);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      const shots = await storage.getShots(req.params.id);
      const shotsWithImages = shots.filter(s => s.imageBase64);
      
      if (shotsWithImages.length === 0) {
        return res.status(400).json({ error: "No shots with images to generate videos for" });
      }

      const { enqueueVideoJob } = await import("./video-job-queue");
      const jobs: { jobId: string; shotId: string; shotNumber: number }[] = [];

      // Batch update all shots to generating status in parallel
      await Promise.all(shotsWithImages.map(shot => 
        storage.updateShot(shot.id, {
          videoStatus: "generating",
          videoModel: model,
        })
      ));

      // Enqueue all jobs (non-blocking)
      for (const shot of shotsWithImages) {
        const videoDescription = `${shot.description}. Camera: ${shot.cameraMovement || "static"}. ${shot.atmosphere || ""}. Scene: ${scene.title || ""}`;
        const jobId = enqueueVideoJob(shot.id, model, shot.imageBase64!, videoDescription, shot.duration || 5);
        jobs.push({ jobId, shotId: shot.id, shotNumber: shot.shotNumber });
      }

      // Return immediately with job info
      res.json({ 
        jobs,
        total: jobs.length,
        message: "Video generation started for all shots. Poll GET /api/shots to check status." 
      });
    } catch (error) {
      console.error("Error starting scene video generation:", error);
      res.status(500).json({ error: "Failed to start video generation" });
    }
  });

  // Check video API key availability
  app.get("/api/video-models/availability", async (req, res) => {
    res.json({
      veo: !!process.env.VEO_API_KEY,
      kling: !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY),
      jimeng: !!process.env.JIMENG_API_KEY,
    });
  });

  // Get video job queue status
  app.get("/api/video-jobs/status", async (req, res) => {
    const { getQueueStatus } = await import("./video-job-queue");
    res.json(getQueueStatus());
  });

  app.get("/api/characters", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const characters = await storage.getCharacters(projectId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching characters:", error);
      res.status(500).json({ error: "Failed to fetch characters" });
    }
  });

  // Extract characters from script using AI
  app.post("/api/projects/:projectId/characters/extract", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Get the active script for this project
      const scripts = await storage.getScripts(projectId);
      const activeScript = scripts.find(s => s.isActive);
      
      if (!activeScript || !activeScript.content) {
        return res.status(400).json({ error: "No active script found for this project" });
      }

      // Get existing characters to avoid duplicates
      const existingCharacters = await storage.getCharacters(projectId);
      const existingNames = new Set(existingCharacters.map(c => c.name.toLowerCase()));

      const prompt = `你是一位专业的剧本分析师。请仔细阅读以下剧本内容，分析并提取所有角色信息。

剧本内容：
${activeScript.content}

请识别剧本中的所有角色，并为每个角色提供：
1. 角色名称
2. 角色类型（男主/女主/反一/反二/配角/客串/群演/其他）
3. 外貌描述（年龄、体型、发型、穿着风格等，用于生成AI图片）
4. 角色简介

返回JSON格式：
{
  "characters": [
    {
      "name": "角色名称",
      "roleType": "male_lead|female_lead|antagonist_1|antagonist_2|supporting|cameo|extra|other",
      "appearance": "详细的外貌描述，包括年龄、体型、发型、典型穿着等，越详细越好，用于AI绘图",
      "description": "角色性格和背景简介"
    }
  ]
}

注意：
- 只返回有台词或重要戏份的角色
- roleType必须使用英文值
- appearance字段要尽量详细，便于AI生成一致的角色形象`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      const extractedCharacters = parsed.characters || [];

      const createdCharacters = [];
      for (const char of extractedCharacters) {
        // Skip if character already exists
        if (existingNames.has(char.name.toLowerCase())) {
          // Update existing character with new info
          const existing = existingCharacters.find(c => c.name.toLowerCase() === char.name.toLowerCase());
          if (existing) {
            await storage.updateCharacter(existing.id, {
              roleType: char.roleType,
              imageReferencePrompt: char.appearance,
              description: char.description || existing.description,
              isAutoExtracted: true,
            });
            createdCharacters.push({ ...existing, updated: true });
          }
          continue;
        }

        const created = await storage.createCharacter({
          projectId,
          name: char.name,
          roleType: char.roleType,
          description: char.description,
          imageReferencePrompt: char.appearance,
          isAutoExtracted: true,
        });
        createdCharacters.push(created);
      }

      res.json({ 
        message: `成功提取 ${createdCharacters.length} 个角色`,
        characters: createdCharacters 
      });
    } catch (error) {
      console.error("Error extracting characters:", error);
      res.status(500).json({ error: "Failed to extract characters from script" });
    }
  });

  // Get characters with their references for a project
  app.get("/api/projects/:projectId/characters/references", async (req, res) => {
    try {
      const { projectId } = req.params;
      const characters = await storage.getCharacters(projectId);
      
      // Fetch asset references for each character
      const charactersWithAssets = await Promise.all(
        characters.map(async (char) => {
          const assets = await storage.getCharacterAssetReferences(char.id);
          return {
            ...char,
            assets: {
              clothing: assets.filter(a => a.assetType === "clothing"),
              shoe: assets.filter(a => a.assetType === "shoe"),
              prop: assets.filter(a => a.assetType === "prop"),
            }
          };
        })
      );

      res.json(charactersWithAssets);
    } catch (error) {
      console.error("Error fetching character references:", error);
      res.status(500).json({ error: "Failed to fetch character references" });
    }
  });

  // Update character (including reference image)
  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateCharacter(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // Upload character reference image (base64)
  app.post("/api/characters/:id/reference-image", async (req, res) => {
    try {
      const { id } = req.params;
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      const updated = await storage.updateCharacter(id, {
        imageReferenceUrl: imageBase64,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error uploading character reference image:", error);
      res.status(500).json({ error: "Failed to upload character reference image" });
    }
  });

  // Get character asset references
  app.get("/api/characters/:id/assets", async (req, res) => {
    try {
      const { id } = req.params;
      const assetType = req.query.type as string | undefined;
      
      const assets = await storage.getCharacterAssetReferences(id, assetType as any);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching character assets:", error);
      res.status(500).json({ error: "Failed to fetch character assets" });
    }
  });

  // Add character asset reference
  app.post("/api/characters/:id/assets", async (req, res) => {
    try {
      const { id } = req.params;
      const { assetType, imageUrl, description } = req.body;
      
      if (!assetType || !imageUrl) {
        return res.status(400).json({ error: "assetType and imageUrl are required" });
      }

      const asset = await storage.createCharacterAssetReference({
        characterId: id,
        assetType,
        imageUrl,
        description,
      });
      res.json(asset);
    } catch (error) {
      console.error("Error adding character asset:", error);
      res.status(500).json({ error: "Failed to add character asset" });
    }
  });

  // Delete character asset reference
  app.delete("/api/characters/:id/assets/:assetId", async (req, res) => {
    try {
      const { assetId } = req.params;
      await storage.deleteCharacterAssetReference(assetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting character asset:", error);
      res.status(500).json({ error: "Failed to delete character asset" });
    }
  });

  // Delete character
  app.delete("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCharacter(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting character:", error);
      res.status(500).json({ error: "Failed to delete character" });
    }
  });

  // Create new character manually
  app.post("/api/characters", async (req, res) => {
    try {
      const data = insertCharacterSchema.parse(req.body);
      const character = await storage.createCharacter(data);
      res.json(character);
    } catch (error) {
      console.error("Error creating character:", error);
      res.status(500).json({ error: "Failed to create character" });
    }
  });

  // Get character image variants
  app.get("/api/characters/:id/image-variants", async (req, res) => {
    try {
      const { id } = req.params;
      const variants = await storage.getCharacterImageVariants(id);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching character image variants:", error);
      res.status(500).json({ error: "Failed to fetch character image variants" });
    }
  });

  // Generate character images (all 4 poses)
  app.post("/api/characters/:id/generate-images", async (req, res) => {
    try {
      const { id } = req.params;
      const requestedProvider = (req.body?.provider || "openai") as ImageProvider;
      
      // Validate that the provider is available
      const availableProviders: ImageProvider[] = ["openai", "gemini"];
      if (!availableProviders.includes(requestedProvider)) {
        return res.status(400).json({ error: `Provider "${requestedProvider}" is not yet available. Please use: ${availableProviders.join(", ")}` });
      }
      const provider = requestedProvider;
      
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      // Get project to access script for character description extraction
      const project = await storage.getProject(character.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get scripts to extract detailed character description
      const scripts = await storage.getScripts(character.projectId);
      const scriptContent = scripts.map(s => s.content || "").join("\n");

      // Generate appearance descriptor using AI
      if (!openai) {
        return res.status(500).json({ error: "OpenAI client not configured" });
      }
      
      const appearancePrompt = `根据以下剧本内容，提取角色"${character.name}"的详细外貌描述。

剧本内容：
${scriptContent.substring(0, 8000)}

角色名称：${character.name}
角色描述：${character.description || "无"}
角色类型：${character.roleType || "配角"}

请分析剧本和角色描述，提取以下外貌特征。如果剧本中没有明确说明，请根据角色类型和故事背景做出合理推断。

返回JSON格式：
{
  "hair": "发型和发色描述",
  "face": "面部特征描述（五官、表情气质）",
  "body": "身材体型描述",
  "clothing": "典型服装风格描述",
  "age": "年龄段描述",
  "gender": "性别",
  "style": "整体视觉风格（如：现代都市、古装、民国等）"
}`;

      const appearanceResponse = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: appearancePrompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1024,
      });

      const appearanceContent = appearanceResponse.choices[0]?.message?.content || "{}";
      let appearanceDescriptor: {
        hair?: string;
        face?: string;
        body?: string;
        clothing?: string;
        age?: string;
        gender?: string;
        style?: string;
      };
      
      try {
        appearanceDescriptor = JSON.parse(appearanceContent);
      } catch {
        appearanceDescriptor = {
          hair: "黑色短发",
          face: "五官端正",
          body: "标准身材",
          clothing: "休闲服装",
          age: "青年",
          gender: "未知",
          style: "现代",
        };
      }

      // Generate batch ID for this generation session
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get the next version number (increment from current max)
      const currentMaxVersion = await storage.getLatestVersionNumber(id);
      const newVersion = currentMaxVersion + 1;

      // Create variants for all 4 poses with new version number and enqueue generation jobs
      const variants = [];
      for (const poseType of characterPoseTypes) {
        const poseLabel = characterPoseTypeLabels[poseType];
        
        // Build detailed prompt for each pose
        let posePrompt = `电影角色定妆照：${character.name}，${appearanceDescriptor.gender || "角色"}，${appearanceDescriptor.age || "成年"}

外貌特征：
- 发型：${appearanceDescriptor.hair || "自然发型"}
- 面部：${appearanceDescriptor.face || "五官端正"}
- 身材：${appearanceDescriptor.body || "标准身材"}
- 服装：${appearanceDescriptor.clothing || "角色服装"}

风格：${appearanceDescriptor.style || "电影质感"}，专业摄影，高清画质，柔和打光，纯色背景

`;
        
        if (poseType === "full_body") {
          posePrompt += "全身照：从头到脚完整展示，站立姿势，正面朝向镜头";
        } else if (poseType === "front_face") {
          posePrompt += "正脸近景：面部特写，正面朝向镜头，眼睛直视前方";
        } else if (poseType === "left_profile") {
          posePrompt += "左侧脸近景：面部特写，向右转头，展示左侧面轮廓";
        } else if (poseType === "right_profile") {
          posePrompt += "右侧脸近景：面部特写，向左转头，展示右侧面轮廓";
        }

        const variant = await storage.createCharacterImageVariant({
          characterId: id,
          poseType,
          prompt: posePrompt,
          appearanceDescriptor,
          status: "pending",
          generationBatchId: batchId,
          version: newVersion,
          provider,
        });

        variants.push(variant);

        // Enqueue the image generation job
        enqueueCharacterImageJob(
          variant.id,
          id,
          character.name,
          poseType,
          posePrompt,
          batchId,
          provider
        );
      }

      res.json({
        success: true,
        batchId,
        version: newVersion,
        variants,
        message: "Image generation started for all 4 poses",
      });
    } catch (error) {
      console.error("Error generating character images:", error);
      res.status(500).json({ error: "Failed to generate character images" });
    }
  });

  // Apply character image variant (copy to main reference image)
  app.post("/api/characters/:characterId/image-variants/:variantId/apply", async (req, res) => {
    try {
      const { characterId, variantId } = req.params;
      
      const variant = await storage.getCharacterImageVariants(characterId);
      const targetVariant = variant.find(v => v.id === variantId);
      
      if (!targetVariant || !targetVariant.imageUrl) {
        return res.status(404).json({ error: "Image variant not found or not ready" });
      }

      // Update character with the selected image
      await storage.updateCharacter(characterId, {
        imageReferenceUrl: targetVariant.imageUrl,
        imageReferencePrompt: targetVariant.prompt,
      });

      // Mark this variant as applied
      await storage.updateCharacterImageVariant(variantId, {
        isApplied: true,
        status: "applied",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error applying character image variant:", error);
      res.status(500).json({ error: "Failed to apply character image variant" });
    }
  });

  // Get character image generation queue status
  app.get("/api/character-image-jobs/status", async (_req, res) => {
    try {
      const status = getCharacterImageQueueStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting character image job status:", error);
      res.status(500).json({ error: "Failed to get job status" });
    }
  });

  // Get all version numbers for a character's image variants
  app.get("/api/characters/:id/image-versions", async (req, res) => {
    try {
      const { id } = req.params;
      const versions = await storage.getVersionNumbers(id);
      res.json(versions);
    } catch (error) {
      console.error("Error getting character image versions:", error);
      res.status(500).json({ error: "Failed to get image versions" });
    }
  });

  // Get character image variants by version
  app.get("/api/characters/:id/image-variants/version/:version", async (req, res) => {
    try {
      const { id, version } = req.params;
      const versionNum = parseInt(version, 10);
      if (isNaN(versionNum)) {
        return res.status(400).json({ error: "Invalid version number" });
      }
      const variants = await storage.getCharacterImageVariantsByVersion(id, versionNum);
      res.json(variants);
    } catch (error) {
      console.error("Error getting character image variants by version:", error);
      res.status(500).json({ error: "Failed to get variants by version" });
    }
  });

  app.get("/api/performance-guides", async (req, res) => {
    try {
      const sceneId = req.query.sceneId as string;
      const characterId = req.query.characterId as string | undefined;
      if (!sceneId) {
        return res.status(400).json({ error: "sceneId is required" });
      }
      const guides = await storage.getPerformanceGuides(sceneId, characterId);
      res.json(guides);
    } catch (error) {
      console.error("Error fetching performance guides:", error);
      res.status(500).json({ error: "Failed to fetch performance guides" });
    }
  });

  app.post("/api/performance-guides/generate", async (req, res) => {
    try {
      const { sceneId, characterId } = req.body as {
        sceneId: string;
        characterId: string;
      };

      const scene = await storage.getScene(sceneId);
      const character = await storage.getCharacter(characterId);

      if (!scene || !character) {
        return res.status(404).json({ error: "Scene or character not found" });
      }

      const prompt = `你是一位经验丰富的导演，专门提供表演指导。

请为以下场次中的角色提供详细的表演指导：

场次${scene.sceneNumber}：${scene.title}
地点：${scene.location || "未指定"}
描述：${scene.description || ""}
动作：${scene.action || ""}
对白：${scene.dialogue || ""}

角色：${character.name}
角色描述：${character.description || ""}

请提供：
1. 该角色在此场次前后的情绪状态
2. 详细的导演级表演指导
3. 多个表演方案供选择
4. 具体的动作设计建议
5. 台词处理建议（如果有对白）

返回JSON格式：
{
  "emotionBefore": "场次之前的情绪状态",
  "emotionDuring": "场次中的情绪变化",
  "emotionAfter": "场次之后的情绪状态",
  "directorNotes": "详细的导演级表演指导（200字以上）",
  "performanceOptions": [
    {
      "option": "方案名称",
      "description": "方案描述",
      "actions": ["具体动作1", "具体动作2", "具体动作3"]
    }
  ],
  "dialogueSuggestions": "台词处理建议",
  "actionSuggestions": "动作设计建议"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = safeParseJSON(content, PerformanceGuideSchema, "performance");

      const guide = await storage.createPerformanceGuide({
        sceneId,
        characterId,
        emotionBefore: result.emotionBefore,
        emotionDuring: result.emotionDuring,
        emotionAfter: result.emotionAfter,
        directorNotes: result.directorNotes,
        performanceOptions: result.performanceOptions,
        dialogueSuggestions: result.dialogueSuggestions,
        actionSuggestions: result.actionSuggestions,
      });

      res.json(guide);
    } catch (error) {
      console.error("Error generating performance guide:", error);
      res.status(500).json({ error: "Failed to generate performance guide" });
    }
  });

  app.get("/api/production-notes", async (req, res) => {
    try {
      const sceneId = req.query.sceneId as string;
      if (!sceneId) {
        return res.status(400).json({ error: "sceneId is required" });
      }
      const notes = await storage.getProductionNotes(sceneId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching production notes:", error);
      res.status(500).json({ error: "Failed to fetch production notes" });
    }
  });

  app.post("/api/production-notes/generate", async (req, res) => {
    try {
      const { sceneId } = req.body as { sceneId: string };

      const scene = await storage.getScene(sceneId);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      const project = await storage.getProject(scene.projectId);
      const characters = await storage.getCharacters(scene.projectId);
      const allScenes = await storage.getScenes(scene.projectId);

      const prevScene = allScenes.find((s) => s.sceneNumber === scene.sceneNumber - 1);
      const nextScene = allScenes.find((s) => s.sceneNumber === scene.sceneNumber + 1);

      const prompt = `你是一位专业的服化道总监。

请为以下场次生成详细的服化道提示：

场次${scene.sceneNumber}：${scene.title}
地点：${scene.location || "未指定"}
时间：${scene.timeOfDay || "未指定"}
描述：${scene.description || ""}

角色列表：${characters.map((c) => c.name).join("、") || "未定义"}

上一场次：${prevScene ? `场次${prevScene.sceneNumber} - ${prevScene.title}` : "无"}
下一场次：${nextScene ? `场次${nextScene.sceneNumber} - ${nextScene.title}` : "无"}

请为每个可能出场的角色生成：
1. 服装要求
2. 化妆要求
3. 所需道具
4. 接戏提醒（与前后场次的连贯性）

返回JSON格式：
{
  "notes": [
    {
      "characterName": "角色名（如无特定角色则为'通用'）",
      "characterId": "角色ID或null",
      "costumeNotes": "服装详细要求",
      "makeupNotes": "化妆详细要求",
      "propsRequired": ["道具1", "道具2"],
      "continuityNotes": "接戏提醒"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = safeParseJSON(content, ProductionNotesSchema, "production");

      const createdNotes = [];
      for (const note of result.notes) {
        const character = note.characterName ? characters.find((c) => c.name === note.characterName) : null;
        const createdNote = await storage.createProductionNotes({
          sceneId,
          characterId: character?.id || null,
          costumeNotes: note.costumeNotes,
          makeupNotes: note.makeupNotes,
          propsRequired: note.propsRequired,
          continuityNotes: note.continuityNotes,
        });
        createdNotes.push(createdNote);
      }

      res.json(createdNotes);
    } catch (error) {
      console.error("Error generating production notes:", error);
      res.status(500).json({ error: "Failed to generate production notes" });
    }
  });

  app.post("/api/export", async (req, res) => {
    try {
      const { projectId, modules, format, sceneIds, includeVersions } = req.body as {
        projectId: string;
        modules: string[];
        format: "pdf" | "excel" | "word";
        sceneIds: string[];
        includeVersions: boolean;
      };

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const exportData: Record<string, unknown> = {
        project: {
          id: project.id,
          title: project.title,
          type: project.type,
          description: project.description,
          createdAt: project.createdAt,
        },
        exportedAt: new Date().toISOString(),
        format,
        includeVersions,
      };

      if (modules.includes("script")) {
        const scripts = await storage.getScripts(projectId);
        exportData.scripts = includeVersions ? scripts : scripts.filter(s => s.isActive);
      }

      if (modules.includes("storyboard") || modules.includes("analysis") || modules.includes("performance") || modules.includes("production")) {
        const scenes = await storage.getScenes(projectId);
        const filteredScenes = sceneIds.length > 0 
          ? scenes.filter(s => sceneIds.includes(s.id))
          : scenes;
        
        exportData.scenes = await Promise.all(filteredScenes.map(async (scene) => {
          const sceneData: Record<string, unknown> = { ...scene };
          
          if (modules.includes("storyboard")) {
            sceneData.shots = await storage.getShots(scene.id);
          }
          
          if (modules.includes("performance")) {
            sceneData.performanceGuides = await storage.getPerformanceGuides(scene.id);
          }
          
          if (modules.includes("production")) {
            sceneData.productionNotes = await storage.getProductionNotes(scene.id);
          }
          
          if (modules.includes("analysis")) {
            sceneData.analysis = await storage.getSceneAnalysis(scene.id);
          }
          
          return sceneData;
        }));
      }

      const characters = await storage.getCharacters(projectId);
      exportData.characters = characters;

      res.json({
        success: true,
        message: `数据已准备完成（${format.toUpperCase()}格式）`,
        projectTitle: project.title,
        data: exportData,
      });
    } catch (error) {
      console.error("Error exporting:", error);
      res.status(500).json({ error: "Failed to export" });
    }
  });

  app.get("/api/call-sheets", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const callSheets = await storage.getCallSheets(projectId);
      res.json(callSheets);
    } catch (error) {
      console.error("Error fetching call sheets:", error);
      res.status(500).json({ error: "Failed to fetch call sheets" });
    }
  });

  app.post("/api/call-sheets", async (req, res) => {
    try {
      const parsed = insertCallSheetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const callSheet = await storage.createCallSheet(parsed.data);
      res.status(201).json(callSheet);
    } catch (error) {
      console.error("Error creating call sheet:", error);
      res.status(500).json({ error: "Failed to create call sheet" });
    }
  });

  const callSheetUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"];
      const allowedExts = [".txt", ".docx", ".pdf"];
      const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf("."));
      if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("不支持的文件格式。请上传 .txt, .docx 或 .pdf 格式的通告单文件"));
      }
    },
  });

  app.post("/api/call-sheets/upload", callSheetUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "未上传文件" });
      }

      const { projectId, title } = req.body;
      if (!projectId || !title) {
        return res.status(400).json({ error: "projectId和title是必需的" });
      }

      let rawText = "";
      const ext = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf("."));

      if (ext === ".txt") {
        rawText = req.file.buffer.toString("utf-8");
      } else if (ext === ".docx") {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        rawText = result.value;
      } else if (ext === ".pdf") {
        const pdfData = await pdfParse.default(req.file.buffer);
        rawText = pdfData.text;
      }

      // 辅助函数：将中文数字转换为阿拉伯数字
      const chineseToNumber = (str: string): number => {
        const chineseNums: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
          '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9, '拾': 10
        };
        
        if (/^\d+$/.test(str)) return parseInt(str);
        
        let result = 0;
        let temp = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          const val = chineseNums[char];
          if (val === undefined) continue;
          
          if (val === 10) {
            if (temp === 0) result += 10;
            else result += temp * 10;
            temp = 0;
          } else {
            temp = val;
          }
        }
        return result + temp;
      };

      // 增强场次识别 - 支持多种格式
      const sceneNumbersFound: number[] = [];
      
      // 格式1: "第X场", "第X集", "X场" 等 (X可以是阿拉伯数字或中文数字)
      const chineseScenePattern = /(?:第?\s*([一二三四五六七八九十百\d]+)\s*[场集次])/gi;
      for (const match of rawText.matchAll(chineseScenePattern)) {
        const num = chineseToNumber(match[1]);
        if (!isNaN(num) && num > 0) sceneNumbersFound.push(num);
      }
      
      // 格式2: "场次: 1, 2, 3" 或 "场次：1、2、3" - 逗号/顿号分隔的数字列表（支持阿拉伯和中文数字）
      const listPattern = /场次[:：\s]?\s*([^。\n]+)/gi;
      for (const match of rawText.matchAll(listPattern)) {
        const numberList = match[1];
        const tokens = numberList.split(/[,，、\s]+/).filter(s => s.trim());
        for (const token of tokens) {
          const trimmed = token.trim();
          if (!trimmed) continue;
          // 尝试解析阿拉伯数字或中文数字
          const num = chineseToNumber(trimmed);
          if (!isNaN(num) && num > 0) sceneNumbersFound.push(num);
        }
      }
      
      // 格式3: X-Y 或 X.Y 格式 (如 "1-1", "4-8")
      const dashPattern = /(\d+)[-.](\d+)/g;
      for (const match of rawText.matchAll(dashPattern)) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > 0) sceneNumbersFound.push(num);
      }
      
      // 格式4: 独立的 "场次 X" 格式
      const standalonePattern = /场次\s*[:：]?\s*(\d+)/gi;
      for (const match of rawText.matchAll(standalonePattern)) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > 0) sceneNumbersFound.push(num);
      }
      
      // 格式5: 中文数字列表格式 如 "一、二、三" 或 "第一、第二、第三"
      const chineseListPattern = /[第]?([一二三四五六七八九十百]+)[、，,\s]+[第]?([一二三四五六七八九十百]+)/gi;
      for (const match of rawText.matchAll(chineseListPattern)) {
        const num1 = chineseToNumber(match[1]);
        const num2 = chineseToNumber(match[2]);
        if (!isNaN(num1) && num1 > 0) sceneNumbersFound.push(num1);
        if (!isNaN(num2) && num2 > 0) sceneNumbersFound.push(num2);
      }
      
      const uniqueSceneNumbers = [...new Set(sceneNumbersFound)].sort((a, b) => a - b);
      console.log(`[Call Sheet Upload] Extracted scene numbers: ${uniqueSceneNumbers.join(', ')} from file: ${req.file.originalname}`);

      const callSheet = await storage.createCallSheet({
        projectId,
        title,
        rawText,
        sceneNumbers: uniqueSceneNumbers,
        fileMetadata: {
          fileName: req.file.originalname,
          fileType: ext.slice(1),
          uploadedAt: new Date().toISOString(),
        },
      });

      res.status(201).json(callSheet);
    } catch (error) {
      console.error("Error uploading call sheet:", error);
      res.status(500).json({ error: "Failed to upload call sheet" });
    }
  });

  app.post("/api/call-sheets/parse-text", async (req, res) => {
    try {
      const { projectId, title, rawText, useAI } = req.body;
      if (!projectId || !title || !rawText) {
        return res.status(400).json({ error: "projectId, title和rawText是必需的" });
      }

      // 获取项目中已有的场次
      const allProjectScenes = await storage.getScenes(projectId);
      console.log(`[Call Sheet Parse] Found ${allProjectScenes.length} total scenes in project`);

      // 获取当前活动的剧本
      const scripts = await storage.getScripts(projectId);
      const activeScript = scripts.find(s => s.isActive);
      console.log(`[Call Sheet] Active script found: ${activeScript ? 'Yes' : 'No'}`);

      let matchedSceneIds: string[] = [];
      let extractedIdentifiers: string[] = [];

      if (useAI !== false && allProjectScenes.length > 0) {
        // 使用 AI 智能匹配通告单到场次
        console.log("[Call Sheet Parse] Using AI to match call sheet to scenes");
        
        const scenesForMatching = allProjectScenes.map(s => ({
          identifier: s.sceneIdentifier || s.title || `场次${s.sceneNumber}`,
          title: s.title,
          content: s.scriptContent || s.description || s.action || ""
        }));

        const matches = await matchCallSheetToScenesWithAI(rawText, scenesForMatching);
        
        // 更新匹配的场次
        for (const match of matches) {
          const matchedScene = allProjectScenes.find(s => 
            s.sceneIdentifier === match.matchedSceneIdentifier ||
            s.title === match.matchedSceneIdentifier ||
            s.title.includes(match.matchedSceneIdentifier)
          );
          if (matchedScene) {
            await storage.updateScene(matchedScene.id, { isInCallSheet: true });
            matchedSceneIds.push(matchedScene.id);
            extractedIdentifiers.push(match.matchedSceneIdentifier);
          }
        }

        console.log(`[Call Sheet Parse] AI matched ${matches.length} scenes`);
      } else {
        // 如果没有场次或禁用 AI，先用 AI 提取场次标识符
        console.log("[Call Sheet Parse] Using AI to extract scene identifiers");
        extractedIdentifiers = await extractSceneIdentifiersFromCallSheet(rawText);
        
        // 如果项目有剧本但没有场次，提示用户先提取场次
        if (allProjectScenes.length === 0 && activeScript?.content) {
          console.log("[Call Sheet Parse] No scenes exist, need to extract from script first");
        }
      }

      // 转换为数字数组以兼容旧格式
      const sceneNumbers = extractedIdentifiers.map(id => {
        const match = id.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }).filter(n => n > 0);

      const callSheet = await storage.createCallSheet({
        projectId,
        title,
        rawText,
        sceneNumbers: [...new Set(sceneNumbers)],
      });

      res.status(201).json({
        ...callSheet,
        matchedSceneIds,
        extractedIdentifiers
      });
    } catch (error) {
      console.error("Error parsing call sheet text:", error);
      res.status(500).json({ error: "Failed to parse call sheet" });
    }
  });

  app.get("/api/scripts/:id/versions", async (req, res) => {
    try {
      const versions = await storage.getScriptVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching script versions:", error);
      res.status(500).json({ error: "无法获取剧本版本历史" });
    }
  });

  app.post("/api/scripts/:id/versions", async (req, res) => {
    try {
      const script = await storage.getScript(req.params.id);
      if (!script) {
        return res.status(404).json({ error: "剧本不存在" });
      }

      const version = await storage.createScriptVersion({
        scriptId: script.id,
        projectId: script.projectId,
        content: script.content,
        version: script.version,
        changeDescription: req.body.changeDescription,
        changedBy: req.body.changedBy,
      });

      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating script version:", error);
      res.status(500).json({ error: "无法保存剧本版本" });
    }
  });

  app.post("/api/scripts/:id/versions/:versionId/restore", async (req, res) => {
    try {
      const restored = await storage.restoreScriptVersion(req.params.id, req.params.versionId);
      if (!restored) {
        return res.status(404).json({ error: "找不到对应版本或剧本" });
      }
      res.json(restored);
    } catch (error) {
      console.error("Error restoring script version:", error);
      res.status(500).json({ error: "无法恢复剧本版本" });
    }
  });

  app.get("/api/shots/:id/versions", async (req, res) => {
    try {
      const versions = await storage.getShotVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching shot versions:", error);
      res.status(500).json({ error: "无法获取分镜版本历史" });
    }
  });

  app.post("/api/shots/:id/versions", async (req, res) => {
    try {
      const shot = await storage.getShot(req.params.id);
      if (!shot) {
        return res.status(404).json({ error: "分镜不存在" });
      }

      const version = await storage.createShotVersion({
        shotId: shot.id,
        sceneId: shot.sceneId,
        description: shot.description,
        shotType: shot.shotType,
        cameraAngle: shot.cameraAngle,
        cameraMovement: shot.cameraMovement,
        duration: shot.duration,
        atmosphere: shot.atmosphere,
        notes: shot.notes,
        imageUrl: shot.imageUrl,
        imageBase64: shot.imageBase64,
        version: shot.version,
        changeDescription: req.body.changeDescription,
        changedBy: req.body.changedBy,
      });

      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating shot version:", error);
      res.status(500).json({ error: "无法保存分镜版本" });
    }
  });

  app.post("/api/shots/:id/versions/:versionId/restore", async (req, res) => {
    try {
      const restored = await storage.restoreShotVersion(req.params.id, req.params.versionId);
      if (!restored) {
        return res.status(404).json({ error: "找不到对应版本或分镜" });
      }
      res.json(restored);
    } catch (error) {
      console.error("Error restoring shot version:", error);
      res.status(500).json({ error: "无法恢复分镜版本" });
    }
  });

  app.get("/api/projects/:id/analysis", async (req, res) => {
    try {
      const projectId = req.params.id;
      const scenes = await storage.getScenes(projectId);
      const characters = await storage.getCharacters(projectId);

      // Character Dialogue Analysis
      const characterDialogue = characters.map(char => {
        let dialogueCount = 0;
        scenes.forEach(scene => {
          if (scene.dialogue?.includes(char.name)) {
            // Very simple heuristic: count occurrences of name followed by colon or newline
            const regex = new RegExp(`${char.name}[:：\\n]`, 'g');
            dialogueCount += (scene.dialogue.match(regex) || []).length;
          }
        });
        return {
          name: char.name,
          count: dialogueCount
        };
      }).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

      // Scene Duration Analysis
      const sceneDurations = scenes.map(scene => ({
        sceneNumber: scene.sceneNumber,
        duration: scene.duration || (scene.action?.length || 0) / 10 + (scene.dialogue?.length || 0) / 5 || 30 // Fallback estimate in seconds
      }));

      res.json({
        characterDialogue,
        sceneDurations
      });
    } catch (error) {
      console.error("Error analyzing project:", error);
      res.status(500).json({ error: "Failed to analyze project" });
    }
  });

  // ============================================
  // 全剧分析 API (Script Analysis Global)
  // ============================================

  app.get("/api/script-analysis-global/:projectId", async (req, res) => {
    try {
      const analysis = await storage.getScriptAnalysisGlobal(req.params.projectId);
      res.json(analysis || null);
    } catch (error) {
      console.error("Error fetching script analysis global:", error);
      res.status(500).json({ error: "获取全剧分析失败" });
    }
  });

  app.post("/api/script-analysis-global/generate", async (req, res) => {
    try {
      const { projectId } = req.body as { projectId: string };

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "项目不存在" });
      }

      const scripts = await storage.getScripts(projectId);
      const activeScript = scripts.find(s => s.isActive);
      if (!activeScript) {
        return res.status(400).json({ error: "请先上传剧本" });
      }

      const scenes = await storage.getScenes(projectId);
      const characters = await storage.getCharacters(projectId);

      const prompt = `你是一位资深电影导演和剧本分析师。请对以下完整剧本进行深度分析，为后续的表演指导提供基础。

【项目信息】
标题：${project.title}
类型：${project.type}
描述：${project.description || "无"}

【完整剧本】
${activeScript.content}

【已识别的场次】
${scenes.map(s => `第${s.sceneNumber}场 - ${s.title} | 地点：${s.location || "未指定"} | 时间：${s.timeOfDay || "未指定"}`).join("\n")}

【已识别的角色】
${characters.map(c => `${c.name}: ${c.description || "暂无描述"}`).join("\n") || "暂无角色信息"}

请分析并严格按照以下JSON格式返回（注意：字段名必须用英文camelCase，数值必须是数字不是字符串）：

{
  "characterArcs": [
    {
      "characterId": "unknown",
      "characterName": "角色真实名字",
      "arcDescription": "这个角色在全剧中的完整人物弧光描述，例如：从自卑懦弱到找到自信的成长历程",
      "startState": "故事开始时的人物状态，例如：一个沉默寡言、逃避责任的普通职员",
      "endState": "故事结束时的人物状态，例如：敢于面对过去、承担责任的成熟男人",
      "turningPoints": [
        {"sceneNumber": 3, "description": "第一个转折点的描述"},
        {"sceneNumber": 8, "description": "第二个转折点的描述"}
      ],
      "emotionByScene": [
        {"sceneNumber": 1, "emotion": "压抑", "intensity": 40},
        {"sceneNumber": 2, "emotion": "紧张", "intensity": 60}
      ]
    }
  ],
  "relationships": [
    {
      "character1Name": "角色A的名字",
      "character2Name": "角色B的名字",
      "relationshipType": "父子/夫妻/朋友/对手等",
      "conflictPoints": ["第一个冲突点", "第二个冲突点"],
      "evolutionDescription": "两人关系在剧中如何演变"
    }
  ],
  "emotionMap": [
    {
      "sceneNumber": 1,
      "overallEmotion": "这场戏的整体情绪氛围",
      "intensity": 45,
      "isKeyScene": false
    },
    {
      "sceneNumber": 5,
      "overallEmotion": "高潮场次的情绪氛围",
      "intensity": 90,
      "isKeyScene": true
    }
  ],
  "keyScenes": [5, 12, 18],
  "overallTheme": "全剧的核心主题，例如：关于父子和解与自我救赎的故事"
}

【重要】
- characterArcs必须为每个主要角色生成，至少包含剧中有对白的所有角色
- emotionByScene的intensity是0-100的数字
- emotionMap的intensity也是0-100的数字
- keyScenes是场次编号的数字数组
- 请根据实际剧本内容填写真实分析，不要使用示例中的占位文字`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = safeParseJSON(content, ScriptAnalysisGlobalGenerationSchema, "scriptAnalysisGlobal");

      // Check if analysis already exists
      const existingAnalysis = await storage.getScriptAnalysisGlobal(projectId);
      
      let analysis;
      if (existingAnalysis) {
        analysis = await storage.updateScriptAnalysisGlobal(existingAnalysis.id, {
          characterArcs: result.characterArcs.map(arc => ({
            ...arc,
            characterId: characters.find(c => c.name === arc.characterName)?.id || arc.characterId,
          })),
          relationships: result.relationships.map(rel => ({
            ...rel,
            character1Id: characters.find(c => c.name === rel.character1Name)?.id || "unknown",
            character2Id: characters.find(c => c.name === rel.character2Name)?.id || "unknown",
          })),
          emotionMap: result.emotionMap.map(em => ({
            ...em,
            sceneId: scenes.find(s => s.sceneNumber === em.sceneNumber)?.id || "unknown",
          })),
          keyScenes: result.keyScenes,
          overallTheme: result.overallTheme,
          version: (existingAnalysis.version || 0) + 1,
        });
      } else {
        analysis = await storage.createScriptAnalysisGlobal({
          projectId,
          characterArcs: result.characterArcs.map(arc => ({
            ...arc,
            characterId: characters.find(c => c.name === arc.characterName)?.id || arc.characterId,
          })),
          relationships: result.relationships.map(rel => ({
            ...rel,
            character1Id: characters.find(c => c.name === rel.character1Name)?.id || "unknown",
            character2Id: characters.find(c => c.name === rel.character2Name)?.id || "unknown",
          })),
          emotionMap: result.emotionMap.map(em => ({
            ...em,
            sceneId: scenes.find(s => s.sceneNumber === em.sceneNumber)?.id || "unknown",
          })),
          keyScenes: result.keyScenes,
          overallTheme: result.overallTheme,
        });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error generating script analysis global:", error);
      res.status(500).json({ error: "生成全剧分析失败" });
    }
  });

  // ============================================
  // 表演指导V2 API (Performance Guides V2)
  // ============================================

  app.get("/api/performance-guides-v2/:sceneId", async (req, res) => {
    try {
      const guide = await storage.getPerformanceGuideV2(req.params.sceneId);
      res.json(guide || null);
    } catch (error) {
      console.error("Error fetching performance guide v2:", error);
      res.status(500).json({ error: "获取表演指导失败" });
    }
  });

  app.get("/api/performance-guides-v2", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const guides = await storage.getPerformanceGuidesV2ByProject(projectId);
      res.json(guides);
    } catch (error) {
      console.error("Error fetching performance guides v2:", error);
      res.status(500).json({ error: "获取表演指导列表失败" });
    }
  });

  app.post("/api/performance-guides-v2/generate", async (req, res) => {
    try {
      const { sceneId } = req.body as { sceneId: string };

      const scene = await storage.getScene(sceneId);
      if (!scene) {
        return res.status(404).json({ error: "场次不存在" });
      }

      const project = await storage.getProject(scene.projectId);
      if (!project) {
        return res.status(404).json({ error: "项目不存在" });
      }

      // Get full script for context
      const scripts = await storage.getScripts(scene.projectId);
      const activeScript = scripts.find(s => s.isActive);

      // Get all scenes for prev/next context
      const allScenes = await storage.getScenes(scene.projectId);
      const sortedScenes = allScenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
      const currentIndex = sortedScenes.findIndex(s => s.id === sceneId);
      const prevScene = currentIndex > 0 ? sortedScenes[currentIndex - 1] : null;
      const nextScene = currentIndex < sortedScenes.length - 1 ? sortedScenes[currentIndex + 1] : null;

      // Get characters
      const characters = await storage.getCharacters(scene.projectId);

      // Get global analysis if available
      const globalAnalysis = await storage.getScriptAnalysisGlobal(scene.projectId);

      const prompt = `你是一位资深电影导演，专门提供详细的表演指导。现在需要为一场戏设计完整的表演方案。

【重要】你必须先通读完整剧本，理解整个故事脉络，再来设计这一场的表演。

【完整剧本】
${activeScript?.content || "剧本内容未上传"}

【全剧分析参考】
${globalAnalysis ? `
主题：${globalAnalysis.overallTheme || "未分析"}
关键场次：第${(globalAnalysis.keyScenes || []).join("、")}场
角色弧光：${(globalAnalysis.characterArcs || []).map(a => `${a.characterName}: ${a.arcDescription}`).join("\n")}
` : "暂无全剧分析，请根据剧本内容自行分析"}

【上一场】
${prevScene ? `
第${prevScene.sceneNumber}场 - ${prevScene.title}
地点：${prevScene.location || "未指定"} | 时间：${prevScene.timeOfDay || "未指定"}
内容：${prevScene.scriptContent || prevScene.description || ""}
对白：${prevScene.dialogue || "无"}
动作：${prevScene.action || "无"}
` : "这是第一场，没有上一场"}

【本场内容】
第${scene.sceneNumber}场 - ${scene.title}
地点：${scene.location || "未指定"} | 时间：${scene.timeOfDay || "未指定"}
描述：${scene.description || ""}
原始剧本：${scene.scriptContent || ""}
对白：${scene.dialogue || "无"}
动作：${scene.action || "无"}

【下一场】
${nextScene ? `
第${nextScene.sceneNumber}场 - ${nextScene.title}
地点：${nextScene.location || "未指定"} | 时间：${nextScene.timeOfDay || "未指定"}
内容：${nextScene.scriptContent || nextScene.description || ""}
` : "这是最后一场，没有下一场"}

【本场涉及角色】
${characters.map(c => `${c.name}: ${c.description || "暂无描述"}`).join("\n") || "请从剧本中识别角色"}

请生成完整的表演指导，必须严格按照以下JSON格式返回（注意：字段名必须用英文camelCase，数值必须是数字不是字符串）：

{
  "sceneHook": {
    "hookDescription": "本场核心戏点的详细描述，例如：父子情感冲突在沉默中爆发",
    "hookType": "情感爆发",
    "hookPosition": "高潮",
    "hookTrigger": "当秦天说出那句'我从没怪过你'时",
    "emotionCurve": {
      "opening": 30,
      "buildup": 55,
      "climax": 90,
      "ending": 60
    },
    "beforeAfterContrast": {
      "before": "场景开始前的氛围状态描述",
      "during": "戏点发生时的强烈变化描述",
      "after": "戏点过后的情绪沉淀描述"
    }
  },
  "sceneDiagnosis": {
    "isFlatScene": false,
    "flatReasons": ["如果是平场，列出原因"],
    "solutions": [
      {
        "title": "破平方案标题",
        "description": "详细描述如何改进这场戏，可以改台词、改动作、删戏、加戏等",
        "implementationSteps": ["第一步做什么", "第二步做什么"]
      }
    ]
  },
  "emotionalChain": {
    "previousScene": {
      "sceneNumber": 1,
      "emotionalEndpoint": "上一场结束时的情绪状态",
      "keyEvent": "上一场的关键事件"
    },
    "currentScene": {
      "emotionalStartpoint": "本场开始时演员应该带入的情绪",
      "emotionalEndpoint": "本场结束时应该达到的情绪",
      "sceneObjective": "本场的核心目标是什么"
    },
    "nextScene": {
      "sceneNumber": 3,
      "emotionalStartpoint": "下一场需要承接的情绪起点",
      "transitionNote": "情绪如何过渡到下一场"
    },
    "directorTip": "开拍前导演应该提醒演员的关键点"
  },
  "characterPerformances": [
    {
      "characterId": "unknown",
      "characterName": "角色名",
      "positioning": {
        "currentAppearance": "第3/共12场",
        "characterArc": "角色在全剧中的人物弧光",
        "currentPhase": "角色当前处于弧光的哪个阶段",
        "sceneSignificance": "这场戏对角色发展的重要意义"
      },
      "performanceLayers": {
        "surface": "表层：观众直接看到的表现",
        "middle": "中层：角色此刻的真实情绪",
        "core": "核心：驱动角色行为的深层动机"
      },
      "directorScript": [
        {
          "segment": "开场",
          "content": "用第二人称'你'的口吻写给演员的详细表演指导，例如：你一进门就要带着疲惫，但又努力掩饰，因为你不想让家人担心..."
        },
        {
          "segment": "中段",
          "content": "详细的中段表演指导..."
        },
        {
          "segment": "高潮",
          "content": "详细的高潮段落表演指导..."
        },
        {
          "segment": "结尾",
          "content": "详细的结尾表演指导..."
        }
      ],
      "actionDesign": [
        {"timing": "开场", "action": "具体动作描述", "meaning": "动作的含义"}
      ],
      "subtext": [
        {"originalLine": "原台词", "realMeaning": "潜台词/真正想说的"}
      ],
      "interactionNotes": [
        {"withCharacter": "对手角色名", "eyeContact": "眼神接触方式", "physicalDistance": "身体距离", "bodyContact": "身体接触"}
      ]
    }
  ],
  "scriptSuggestions": {
    "issues": [{"type": "类型", "originalContent": "原内容", "problem": "问题"}],
    "improvements": [{"title": "改进标题", "original": "原文", "suggested": "建议改为", "reason": "原因"}]
  },
  "propPerformance": [{"prop": "道具名", "usage": "使用方式", "emotionalMeaning": "情感意义"}],
  "costumeProgression": [{"timing": "时间点", "state": "服装状态", "meaning": "含义"}]
}

【重要】
- emotionCurve的值必须是0-100的数字（如30, 55, 90），不能是字符串
- previousScene如果是第一场则设为null
- nextScene如果是最后一场则设为null
- characterPerformances必须为每个出场角色生成详细指导
- directorScript是最重要的部分，要用"你"的口吻，非常详细具体地指导演员如何表演`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = safeParseJSON(content, PerformanceGuideV2GenerationSchema, "performanceGuideV2");

      // Map character names to IDs
      const mappedPerformances = result.characterPerformances.map(perf => ({
        ...perf,
        characterId: characters.find(c => c.name === perf.characterName)?.id || "unknown",
      }));

      // Check if guide already exists for this scene
      const existingGuide = await storage.getPerformanceGuideV2(sceneId);

      let guide;
      if (existingGuide) {
        guide = await storage.updatePerformanceGuideV2(existingGuide.id, {
          sceneHook: result.sceneHook,
          sceneDiagnosis: result.sceneDiagnosis,
          emotionalChain: result.emotionalChain,
          characterPerformances: mappedPerformances,
          scriptSuggestions: result.scriptSuggestions,
          propPerformance: result.propPerformance,
          costumeProgression: result.costumeProgression,
          version: (existingGuide.version || 0) + 1,
        });
      } else {
        guide = await storage.createPerformanceGuideV2({
          sceneId,
          projectId: scene.projectId,
          sceneHook: result.sceneHook,
          sceneDiagnosis: result.sceneDiagnosis,
          emotionalChain: result.emotionalChain,
          characterPerformances: mappedPerformances,
          scriptSuggestions: result.scriptSuggestions,
          propPerformance: result.propPerformance,
          costumeProgression: result.costumeProgression,
        });
      }

      res.json(guide);
    } catch (error) {
      console.error("Error generating performance guide v2:", error);
      res.status(500).json({ error: "生成表演指导失败" });
    }
  });

  return httpServer;
}
