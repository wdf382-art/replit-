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
  directorStyleRules,
  visualStyleInfo,
  shotTypeInfo,
  cameraAngleInfo,
  cameraMovementInfo,
  type DirectorStyle,
  type VisualStyle,
  type AspectRatio,
  type ProjectType,
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
      if (!sceneId) {
        return res.status(400).json({ error: "sceneId is required" });
      }
      const shots = await storage.getShots(sceneId);
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
        ? directorStyleRules[directorStyle as DirectorStyle]
        : null;

      const directorRulesSection = isCustomDirector 
        ? `\n## 导演专属分镜策略\n根据用户自定义风格：${customDirectorStyle}\n请据此设计符合该风格的镜头语言。`
        : `\n## 导演专属分镜策略（${director!.nameCN}）

### 景别与镜头偏好
${directorRules!.shotPreferences}

### 摄影机运动
${directorRules!.cameraWork}

### 节奏控制
${directorRules!.pacing}

### 构图风格
${directorRules!.composition}

### 标志性技法
${directorRules!.signatures}`;

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

  // Generate image for a single shot
  app.post("/api/shots/:id/generate-image", async (req, res) => {
    try {
      const shot = await storage.getShot(req.params.id);
      if (!shot) {
        return res.status(404).json({ error: "Shot not found" });
      }

      const scene = await storage.getScene(shot.sceneId);
      
      // Build a comprehensive prompt for image generation
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

      // Use OpenAI gpt-image-1 to generate image
      const { generateImageBuffer } = await import("./replit_integrations/image/client");
      
      const imageBuffer = await generateImageBuffer(imagePrompt, "1024x1024");
      const imageBase64 = imageBuffer.toString("base64");

      // Save image to the shot
      const updatedShot = await storage.updateShot(shot.id, {
        imageBase64: imageBase64,
      });

      res.json(updatedShot);
    } catch (error) {
      console.error("Error generating shot image:", error);
      res.status(500).json({ error: "Failed to generate shot image" });
    }
  });

  // Generate images for all shots in a scene
  app.post("/api/scenes/:id/generate-all-images", async (req, res) => {
    try {
      const scene = await storage.getScene(req.params.id);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      const shots = await storage.getShots(req.params.id);
      if (!shots || shots.length === 0) {
        return res.status(400).json({ error: "No shots to generate images for" });
      }

      const { generateImageBuffer } = await import("./replit_integrations/image/client");
      const results = [];
      
      for (const shot of shots) {
        try {
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

          const imageBuffer = await generateImageBuffer(imagePrompt, "1024x1024");
          const imageBase64 = imageBuffer.toString("base64");

          await storage.updateShot(shot.id, {
            imageBase64: imageBase64,
          });
          results.push({ id: shot.id, success: true });
        } catch (err) {
          console.error(`Error generating image for shot ${shot.id}:`, err);
          results.push({ id: shot.id, success: false, error: "Generation failed" });
        }
      }

      res.json({ results, totalGenerated: results.filter(r => r.success).length });
    } catch (error) {
      console.error("Error generating scene images:", error);
      res.status(500).json({ error: "Failed to generate scene images" });
    }
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
        message: `数据已准备完成（${format.toUpperCase()}格式）。完整文件生成功能将在后续版本中提供。`,
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

  return httpServer;
}
