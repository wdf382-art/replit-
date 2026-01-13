import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table (keeping original)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Project types
export const projectTypes = ["advertisement", "short_video", "movie", "web_series", "micro_film", "documentary", "mv"] as const;
export type ProjectType = typeof projectTypes[number];

// Director styles
export const directorStyles = [
  "quentin_tarantino",
  "steven_spielberg", 
  "christopher_nolan",
  "zhang_yimou",
  "stanley_kubrick",
  "james_cameron",
  "bela_tarr",
  "bi_gan",
  "wong_kar_wai",
  "wes_anderson",
  "david_fincher",
  "alfonso_cuaron",
  "denis_villeneuve",
  "park_chan_wook",
  "hirokazu_koreeda",
  "hou_hsiao_hsien",
  "tsai_ming_liang",
  "custom"
] as const;
export type DirectorStyle = typeof directorStyles[number];

// Visual styles
export const visualStyles = [
  "realistic",
  "cinematic",
  "vintage_film",
  "neon_cyberpunk",
  "black_white",
  "dreamy_soft",
  "documentary",
  "animation_storyboard",
  "custom"
] as const;
export type VisualStyle = typeof visualStyles[number];

// Shot types
export const shotTypes = ["extreme_wide", "wide", "full", "medium", "close_up", "extreme_close_up", "over_shoulder", "pov"] as const;
export type ShotType = typeof shotTypes[number];

// Camera angles
export const cameraAngles = ["eye_level", "low_angle", "high_angle", "bird_eye", "dutch_angle", "worm_eye"] as const;
export type CameraAngle = typeof cameraAngles[number];

// Camera movements
export const cameraMovements = ["static", "pan", "tilt", "dolly", "tracking", "crane", "handheld", "steadicam", "zoom"] as const;
export type CameraMovement = typeof cameraMovements[number];

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull().$type<ProjectType>(),
  description: text("description"),
  targetDuration: integer("target_duration"), // in seconds
  targetWordCount: integer("target_word_count"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Scripts table
export const scripts = pgTable("scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  suggestions: text("suggestions"), // AI suggestions for improvements
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertScriptSchema = createInsertSchema(scripts).omit({
  id: true,
  createdAt: true,
});

export type InsertScript = z.infer<typeof insertScriptSchema>;
export type Script = typeof scripts.$inferSelect;

// Scenes table
export const scenes = pgTable("scenes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scriptId: varchar("script_id").references(() => scripts.id, { onDelete: "set null" }),
  sceneNumber: integer("scene_number").notNull(),
  sceneIdentifier: text("scene_identifier"), // Full scene identifier like "1-1", "2-3" etc.
  sortOrder: integer("sort_order").notNull().default(0), // For ordering scenes
  title: text("title").notNull(),
  location: text("location"),
  timeOfDay: text("time_of_day"),
  description: text("description"),
  dialogue: text("dialogue"),
  action: text("action"),
  scriptContent: text("script_content"), // Original script content for this scene
  duration: integer("duration"), // in seconds
  isInCallSheet: boolean("is_in_call_sheet").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSceneSchema = createInsertSchema(scenes).omit({
  id: true,
  createdAt: true,
});

export type InsertScene = z.infer<typeof insertSceneSchema>;
export type Scene = typeof scenes.$inferSelect;

// Call sheets table
export const callSheets = pgTable("call_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  rawText: text("raw_text"),
  sceneNumbers: jsonb("scene_numbers").$type<number[]>(),
  fileMetadata: jsonb("file_metadata").$type<{fileName?: string; fileType?: string; uploadedAt?: string}>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCallSheetSchema = createInsertSchema(callSheets).omit({
  id: true,
  createdAt: true,
});

export type InsertCallSheet = z.infer<typeof insertCallSheetSchema>;
export type CallSheet = typeof callSheets.$inferSelect;

// Aspect ratios for storyboard images
export const aspectRatios = ["16:9", "2.35:1", "4:3", "1:1", "9:16", "1.85:1", "custom"] as const;
export type AspectRatio = typeof aspectRatios[number];

// Video generation models
export const videoModels = ["veo", "kling", "jimeng"] as const;
export type VideoModel = typeof videoModels[number];

export const videoModelInfo: Record<VideoModel, { name: string; nameCN: string; description: string }> = {
  veo: { name: "Google VEO", nameCN: "VEO", description: "Google's latest video generation model" },
  kling: { name: "Kling O1", nameCN: "可灵O1", description: "Kuaishou's video generation model" },
  jimeng: { name: "Jimeng 4.0", nameCN: "即梦4.0", description: "ByteDance's video generation model" },
};

// Video generation status
export const videoStatuses = ["pending", "generating", "completed", "failed"] as const;
export type VideoStatus = typeof videoStatuses[number];

// Shots/Storyboards table
export const shots = pgTable("shots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  shotNumber: integer("shot_number").notNull(),
  description: text("description").notNull(),
  shotType: text("shot_type").$type<ShotType>(),
  cameraAngle: text("camera_angle").$type<CameraAngle>(),
  cameraMovement: text("camera_movement").$type<CameraMovement>(),
  duration: integer("duration"), // in seconds
  directorStyle: text("director_style").$type<DirectorStyle>(),
  customDirectorStyle: text("custom_director_style"),
  visualStyle: text("visual_style").$type<VisualStyle>(),
  customVisualStyle: text("custom_visual_style"),
  aspectRatio: text("aspect_ratio").$type<AspectRatio>().default("16:9"),
  customAspectRatio: text("custom_aspect_ratio"),
  imageUrl: text("image_url"),
  imageBase64: text("image_base64"),
  videoUrl: text("video_url"),
  videoModel: text("video_model").$type<VideoModel>(),
  videoStatus: text("video_status").$type<VideoStatus>(),
  videoError: text("video_error"),
  atmosphere: text("atmosphere"),
  notes: text("notes"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertShotSchema = createInsertSchema(shots).omit({
  id: true,
  createdAt: true,
});

export type InsertShot = z.infer<typeof insertShotSchema>;
export type Shot = typeof shots.$inferSelect;

// Script version history table
export const scriptVersions = pgTable("script_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scriptId: varchar("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  version: integer("version").notNull(),
  changeDescription: text("change_description"),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertScriptVersionSchema = createInsertSchema(scriptVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertScriptVersion = z.infer<typeof insertScriptVersionSchema>;
export type ScriptVersion = typeof scriptVersions.$inferSelect;

// Shot version history table
export const shotVersions = pgTable("shot_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shotId: varchar("shot_id").notNull().references(() => shots.id, { onDelete: "cascade" }),
  sceneId: varchar("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  shotType: text("shot_type").$type<ShotType>(),
  cameraAngle: text("camera_angle").$type<CameraAngle>(),
  cameraMovement: text("camera_movement").$type<CameraMovement>(),
  duration: integer("duration"),
  atmosphere: text("atmosphere"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  imageBase64: text("image_base64"),
  version: integer("version").notNull(),
  changeDescription: text("change_description"),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertShotVersionSchema = createInsertSchema(shotVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertShotVersion = z.infer<typeof insertShotVersionSchema>;
export type ShotVersion = typeof shotVersions.$inferSelect;

// Characters table
export const characters = pgTable("characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  emotionArc: jsonb("emotion_arc").$type<{sceneId: string; emotion: string; intensity: number}[]>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// Performance guides table
export const performanceGuides = pgTable("performance_guides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  characterId: varchar("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  emotionBefore: text("emotion_before"),
  emotionDuring: text("emotion_during"),
  emotionAfter: text("emotion_after"),
  performanceOptions: jsonb("performance_options").$type<{option: string; description: string; actions: string[]}[]>(),
  dialogueSuggestions: text("dialogue_suggestions"),
  actionSuggestions: text("action_suggestions"),
  directorNotes: text("director_notes"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPerformanceGuideSchema = createInsertSchema(performanceGuides).omit({
  id: true,
  createdAt: true,
});

export type InsertPerformanceGuide = z.infer<typeof insertPerformanceGuideSchema>;
export type PerformanceGuide = typeof performanceGuides.$inferSelect;

// Scene analysis table
export const sceneAnalysis = pgTable("scene_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  dramaticPoint: text("dramatic_point"),
  openingDesign: text("opening_design"),
  climaxPoint: text("climax_point"),
  rhythmNotes: text("rhythm_notes"),
  transitionIn: text("transition_in"),
  transitionOut: text("transition_out"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSceneAnalysisSchema = createInsertSchema(sceneAnalysis).omit({
  id: true,
  createdAt: true,
});

export type InsertSceneAnalysis = z.infer<typeof insertSceneAnalysisSchema>;
export type SceneAnalysis = typeof sceneAnalysis.$inferSelect;

// Costume/Props/Makeup notes table
export const productionNotes = pgTable("production_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  characterId: varchar("character_id").references(() => characters.id, { onDelete: "set null" }),
  costumeNotes: text("costume_notes"),
  makeupNotes: text("makeup_notes"),
  propsRequired: jsonb("props_required").$type<string[]>(),
  continuityNotes: text("continuity_notes"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProductionNotesSchema = createInsertSchema(productionNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertProductionNotes = z.infer<typeof insertProductionNotesSchema>;
export type ProductionNotes = typeof productionNotes.$inferSelect;

// ============================================
// 全剧分析表 (Script Analysis Global)
// 存储完整剧本的人物弧光、情绪地图、关系网络
// ============================================

export interface CharacterArcData {
  characterId: string;
  characterName: string;
  arcDescription: string;
  startState: string;
  endState: string;
  turningPoints: Array<{
    sceneNumber: number;
    description: string;
  }>;
  emotionByScene: Array<{
    sceneNumber: number;
    emotion: string;
    intensity: number;
  }>;
}

export interface RelationshipData {
  character1Id: string;
  character1Name: string;
  character2Id: string;
  character2Name: string;
  relationshipType: string;
  conflictPoints: string[];
  evolutionDescription: string;
}

export interface SceneEmotionMapData {
  sceneNumber: number;
  sceneId: string;
  overallEmotion: string;
  intensity: number;
  isKeyScene: boolean;
  keySceneType?: string;
}

export const scriptAnalysisGlobal = pgTable("script_analysis_global", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characterArcs: jsonb("character_arcs").$type<CharacterArcData[]>(),
  relationships: jsonb("relationships").$type<RelationshipData[]>(),
  emotionMap: jsonb("emotion_map").$type<SceneEmotionMapData[]>(),
  keyScenes: jsonb("key_scenes").$type<number[]>(),
  overallTheme: text("overall_theme"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertScriptAnalysisGlobalSchema = createInsertSchema(scriptAnalysisGlobal).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScriptAnalysisGlobal = z.infer<typeof insertScriptAnalysisGlobalSchema>;
export type ScriptAnalysisGlobal = typeof scriptAnalysisGlobal.$inferSelect;

// ============================================
// 表演指导V2表 (Performance Guides V2)
// 增强版单场表演指导，包含戏点、诊断、导演讲戏稿等
// ============================================

export interface SceneHookData {
  hookDescription: string;
  hookType: string;
  hookPosition: string;
  hookTrigger: string;
  emotionCurve: {
    opening: number;
    buildup: number;
    climax: number;
    ending: number;
  };
  beforeAfterContrast: {
    before: string;
    during: string;
    after: string;
  };
}

export interface SceneDiagnosisData {
  isFlatScene: boolean;
  flatReasons: string[];
  solutions: Array<{
    title: string;
    description: string;
    implementationSteps?: string[];
  }>;
}

export interface EmotionalChainData {
  previousScene: {
    sceneNumber: number;
    emotionalEndpoint: string;
    keyEvent: string;
  } | null;
  currentScene: {
    emotionalStartpoint: string;
    emotionalEndpoint: string;
    sceneObjective: string;
  };
  nextScene: {
    sceneNumber: number;
    emotionalStartpoint: string;
    transitionNote: string;
  } | null;
  directorTip: string;
}

export interface CharacterPerformanceData {
  characterId: string;
  characterName: string;
  positioning: {
    currentAppearance: string;
    characterArc: string;
    currentPhase: string;
    sceneSignificance: string;
  };
  performanceLayers: {
    surface: string;
    middle: string;
    core: string;
  };
  directorScript: Array<{
    segment: string;
    content: string;
  }>;
  actionDesign: Array<{
    timing: string;
    action: string;
    meaning: string;
  }>;
  subtext: Array<{
    originalLine: string;
    realMeaning: string;
  }>;
  interactionNotes: Array<{
    withCharacter: string;
    eyeContact: string;
    physicalDistance: string;
    bodyContact: string;
  }>;
}

export interface ScriptSuggestionData {
  issues: Array<{
    type: string;
    originalContent: string;
    problem: string;
  }>;
  improvements: Array<{
    title: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
}

export interface PropPerformanceData {
  prop: string;
  usage: string;
  emotionalMeaning: string;
}

export interface CostumeProgressionData {
  timing: string;
  state: string;
  meaning: string;
}

export const performanceGuidesV2 = pgTable("performance_guides_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneHook: jsonb("scene_hook").$type<SceneHookData>(),
  sceneDiagnosis: jsonb("scene_diagnosis").$type<SceneDiagnosisData>(),
  emotionalChain: jsonb("emotional_chain").$type<EmotionalChainData>(),
  characterPerformances: jsonb("character_performances").$type<CharacterPerformanceData[]>(),
  scriptSuggestions: jsonb("script_suggestions").$type<ScriptSuggestionData>(),
  propPerformance: jsonb("prop_performance").$type<PropPerformanceData[]>(),
  costumeProgression: jsonb("costume_progression").$type<CostumeProgressionData[]>(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPerformanceGuideV2Schema = createInsertSchema(performanceGuidesV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPerformanceGuideV2 = z.infer<typeof insertPerformanceGuideV2Schema>;
export type PerformanceGuideV2 = typeof performanceGuidesV2.$inferSelect;

// AI生成表演指导时使用的Zod验证schema
export const PerformanceGuideV2GenerationSchema = z.object({
  sceneHook: z.object({
    hookDescription: z.string(),
    hookType: z.string(),
    hookPosition: z.string(),
    hookTrigger: z.string(),
    emotionCurve: z.object({
      opening: z.number(),
      buildup: z.number(),
      climax: z.number(),
      ending: z.number(),
    }),
    beforeAfterContrast: z.object({
      before: z.string(),
      during: z.string(),
      after: z.string(),
    }),
  }),
  sceneDiagnosis: z.object({
    isFlatScene: z.boolean(),
    flatReasons: z.array(z.string()),
    solutions: z.array(z.object({
      title: z.string(),
      description: z.string(),
      implementationSteps: z.array(z.string()).optional(),
    })),
  }),
  emotionalChain: z.object({
    previousScene: z.object({
      sceneNumber: z.number(),
      emotionalEndpoint: z.string(),
      keyEvent: z.string(),
    }).nullable(),
    currentScene: z.object({
      emotionalStartpoint: z.string(),
      emotionalEndpoint: z.string(),
      sceneObjective: z.string(),
    }),
    nextScene: z.object({
      sceneNumber: z.number(),
      emotionalStartpoint: z.string(),
      transitionNote: z.string(),
    }).nullable(),
    directorTip: z.string(),
  }),
  characterPerformances: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    positioning: z.object({
      currentAppearance: z.string(),
      characterArc: z.string(),
      currentPhase: z.string(),
      sceneSignificance: z.string(),
    }),
    performanceLayers: z.object({
      surface: z.string(),
      middle: z.string(),
      core: z.string(),
    }),
    directorScript: z.array(z.object({
      segment: z.string(),
      content: z.string(),
    })),
    actionDesign: z.array(z.object({
      timing: z.string(),
      action: z.string(),
      meaning: z.string(),
    })),
    subtext: z.array(z.object({
      originalLine: z.string(),
      realMeaning: z.string(),
    })),
    interactionNotes: z.array(z.object({
      withCharacter: z.string(),
      eyeContact: z.string(),
      physicalDistance: z.string(),
      bodyContact: z.string(),
    })),
  })),
  scriptSuggestions: z.object({
    issues: z.array(z.object({
      type: z.string(),
      originalContent: z.string(),
      problem: z.string(),
    })),
    improvements: z.array(z.object({
      title: z.string(),
      original: z.string(),
      suggested: z.string(),
      reason: z.string(),
    })),
  }),
  propPerformance: z.array(z.object({
    prop: z.string(),
    usage: z.string(),
    emotionalMeaning: z.string(),
  })),
  costumeProgression: z.array(z.object({
    timing: z.string(),
    state: z.string(),
    meaning: z.string(),
  })),
});

export const ScriptAnalysisGlobalGenerationSchema = z.object({
  characterArcs: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    arcDescription: z.string(),
    startState: z.string(),
    endState: z.string(),
    turningPoints: z.array(z.object({
      sceneNumber: z.number(),
      description: z.string(),
    })),
    emotionByScene: z.array(z.object({
      sceneNumber: z.number(),
      emotion: z.string(),
      intensity: z.number(),
    })),
  })),
  relationships: z.array(z.object({
    character1Id: z.string(),
    character1Name: z.string(),
    character2Id: z.string(),
    character2Name: z.string(),
    relationshipType: z.string(),
    conflictPoints: z.array(z.string()),
    evolutionDescription: z.string(),
  })),
  emotionMap: z.array(z.object({
    sceneNumber: z.number(),
    sceneId: z.string(),
    overallEmotion: z.string(),
    intensity: z.number(),
    isKeyScene: z.boolean(),
    keySceneType: z.string().optional(),
  })),
  keyScenes: z.array(z.number()),
  overallTheme: z.string(),
});

// Director style info for display
export const directorStyleInfo: Record<DirectorStyle, { name: string; nameCN: string; traits: string; works: string }> = {
  quentin_tarantino: { name: "Quentin Tarantino", nameCN: "昆汀·塔伦蒂诺", traits: "长对话、脚部特写、非线性叙事、暴力美学", works: "《低俗小说》《杀死比尔》" },
  steven_spielberg: { name: "Steven Spielberg", nameCN: "史蒂文·斯皮尔伯格", traits: "情感渲染、仰拍英雄、光影运用", works: "《辛德勒的名单》《E.T.》" },
  christopher_nolan: { name: "Christopher Nolan", nameCN: "克里斯托弗·诺兰", traits: "复杂叙事、IMAX构图、实拍偏好", works: "《盗梦空间》《星际穿越》" },
  zhang_yimou: { name: "Zhang Yimou", nameCN: "张艺谋", traits: "色彩美学、对称构图、群像调度", works: "《英雄》《影》" },
  stanley_kubrick: { name: "Stanley Kubrick", nameCN: "斯坦利·库布里克", traits: "单点透视、对称构图、古典音乐、精确控制", works: "《2001太空漫游》《闪灵》" },
  james_cameron: { name: "James Cameron", nameCN: "詹姆斯·卡梅隆", traits: "技术创新、宏大场面、强女主、蓝橙对比", works: "《泰坦尼克号》《阿凡达》" },
  bela_tarr: { name: "Béla Tarr", nameCN: "贝拉·塔尔", traits: "超长镜头、黑白影像、缓慢节奏", works: "《都灵之马》《撒旦探戈》" },
  bi_gan: { name: "Bi Gan", nameCN: "毕赣", traits: "诗意影像、长镜头、梦境感", works: "《路边野餐》《地球最后的夜晚》" },
  wong_kar_wai: { name: "Wong Kar-wai", nameCN: "王家卫", traits: "手持摄影、抽帧、暧昧氛围", works: "《花样年华》《重庆森林》" },
  wes_anderson: { name: "Wes Anderson", nameCN: "韦斯·安德森", traits: "对称构图、糖果色调、平移镜头", works: "《布达佩斯大饭店》" },
  david_fincher: { name: "David Fincher", nameCN: "大卫·芬奇", traits: "冷色调、精准构图、悬疑氛围", works: "《七宗罪》《搏击俱乐部》" },
  alfonso_cuaron: { name: "Alfonso Cuarón", nameCN: "阿方索·卡隆", traits: "长镜头调度、沉浸式体验", works: "《地心引力》《罗马》" },
  denis_villeneuve: { name: "Denis Villeneuve", nameCN: "丹尼斯·维伦纽瓦", traits: "宏大场景、极简对白、压迫感", works: "《银翼杀手2049》《沙丘》" },
  park_chan_wook: { name: "Park Chan-wook", nameCN: "朴赞郁", traits: "复仇主题、精致暴力、对称构图", works: "《老男孩》《小姐》" },
  hirokazu_koreeda: { name: "Hirokazu Koreeda", nameCN: "是枝裕和", traits: "自然光、生活化、细腻情感", works: "《小偷家族》《步履不停》" },
  hou_hsiao_hsien: { name: "Hou Hsiao-hsien", nameCN: "侯孝贤", traits: "固定长镜头、空间感、留白", works: "《悲情城市》《刺客聂隐娘》" },
  tsai_ming_liang: { name: "Tsai Ming-liang", nameCN: "蔡明亮", traits: "极简对白、凝视镜头、都市疏离", works: "《爱情万岁》《郊游》" },
  custom: { name: "Custom", nameCN: "自定义", traits: "用户自定义风格", works: "用户指定" },
};

// Rule variant types
export type RuleVariant = "遵守" | "变化" | "打破" | "强化" | "不适用";

export interface DirectorRuleVariant {
  variant: RuleVariant;
  description: string;
}

// Comprehensive director style rules with 8 dimensions
export interface DirectorStyleRulesV2 {
  // A: 景别衔接
  ruleVariants: {
    A1_景别过渡: DirectorRuleVariant;
    A2_30度规则: DirectorRuleVariant;
    A3_轴线规则: DirectorRuleVariant;
    B1_镜头时长: DirectorRuleVariant;
    B2_开场方式: DirectorRuleVariant;
    B3_高潮处理: DirectorRuleVariant;
    C1_视线匹配: DirectorRuleVariant;
    C2_动作衔接: DirectorRuleVariant;
    C3_情绪承接: DirectorRuleVariant;
    D_叙事结构: DirectorRuleVariant;
  };
  // E: 摄影机运动
  cameraMovement: {
    E1_运动类型: string;
    E2_运动节奏: string;
    E3_运动动机: string;
  };
  // F: 构图
  composition: {
    F1_对称性: string;
    F2_空间深度: string;
    F3_画面重心: string;
    F4_框架利用: string;
  };
  // G: 色彩
  color: {
    G1_色调倾向: string;
    G2_饱和度: string;
    G3_色彩叙事: string;
  };
  // H: 光线
  lighting: {
    H1_光源类型: string;
    H2_光影对比: string;
    H3_光线叙事: string;
  };
  // 标志性技法
  signatures: string[];
}

// Complete 17 directors with 8 dimensions
export const directorStyleRulesV2: Record<DirectorStyle, DirectorStyleRulesV2> = {
  quentin_tarantino: {
    ruleVariants: {
      A1_景别过渡: { variant: "打破", description: "对话中景突然切脚部特写，景别跳跃制造张力" },
      A2_30度规则: { variant: "遵守", description: "对话正反打严格遵守" },
      A3_轴线规则: { variant: "变化", description: "墨西哥对峙场景故意跨轴增加混乱感" },
      B1_镜头时长: { variant: "强化", description: "对话镜头极长（30秒+），暴力场景突然快切" },
      B2_开场方式: { variant: "变化", description: "后备箱仰拍或局部特写开场" },
      B3_高潮处理: { variant: "打破", description: "高潮前反而用长对话酝酿" },
      C1_视线匹配: { variant: "遵守", description: "多人对峙时精确视线交叉" },
      C2_动作衔接: { variant: "打破", description: "暴力场景跳切省略过程" },
      C3_情绪承接: { variant: "打破", description: "章节标题硬切，情绪断裂" },
      D_叙事结构: { variant: "打破", description: "非线性叙事，时间打乱" }
    },
    cameraMovement: {
      E1_运动类型: "推轨跟拍为主、急速变焦(crash zoom)揭示、横摇对切",
      E2_运动节奏: "对话场景稳定缓慢，暴力场景突然加速",
      E3_运动动机: "跟随角色行走、揭示关键道具、强调脚部"
    },
    composition: {
      F1_对称性: "对峙场景严格对称，单人镜头不对称",
      F2_空间深度: "后备箱视角强调纵深，对话场景平面化",
      F3_画面重心: "多用居中构图，强调人物力量感",
      F4_框架利用: "后备箱框架、车窗框架、门框"
    },
    color: {
      G1_色调倾向: "暖色调为主，复古胶片感",
      G2_饱和度: "中高饱和度，鲜艳的70年代感",
      G3_色彩叙事: "用红色强调暴力，黄色强调怀旧"
    },
    lighting: {
      H1_光源类型: "人工光为主，模拟70年代电影光感",
      H2_光影对比: "中等对比，避免过度戏剧化",
      H3_光线叙事: "逆光剪影用于酷感角色登场"
    },
    signatures: ["后备箱仰拍视角", "脚部特写", "章节式叙事", "墨西哥对峙", "急速变焦", "慢动作暴力", "长段对话后的突然爆发"]
  },

  steven_spielberg: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "严格遵循，景别过渡流畅" },
      A2_30度规则: { variant: "遵守", description: "经典好莱坞剪辑" },
      A3_轴线规则: { variant: "遵守", description: "严格保持，空间清晰" },
      B1_镜头时长: { variant: "强化", description: "情感场景长镜头推近，动作快速剪辑" },
      B2_开场方式: { variant: "强化", description: "宏大远景建立世界观" },
      B3_高潮处理: { variant: "强化", description: "交叉剪辑多线推向同一高潮" },
      C1_视线匹配: { variant: "强化", description: "'斯皮尔伯格脸'推镜" },
      C2_动作衔接: { variant: "遵守", description: "精确的动作连续性" },
      C3_情绪承接: { variant: "强化", description: "音乐和光影强化情绪" },
      D_叙事结构: { variant: "遵守", description: "经典三幕剧结构" }
    },
    cameraMovement: {
      E1_运动类型: "平滑推轨、缓慢推近、跟拍长镜头(oner)",
      E2_运动节奏: "稳定流畅，情感时刻缓慢推近",
      E3_运动动机: "推近面部揭示情感、跟随角色发现奇观"
    },
    composition: {
      F1_对称性: "场面调度对称，但人物构图不死板",
      F2_空间深度: "前景/背景深度调度，纵深丰富",
      F3_画面重心: "人物置于画面三分点或稍偏",
      F4_框架利用: "窗户、门框、楼梯扶手"
    },
    color: {
      G1_色调倾向: "根据题材变化：战争冷色、家庭暖色",
      G2_饱和度: "中等饱和度，自然真实",
      G3_色彩叙事: "光束穿透黑暗象征希望"
    },
    lighting: {
      H1_光源类型: "混合光源，强调光束效果",
      H2_光影对比: "高对比，丁达尔效应（光束穿透）",
      H3_光线叙事: "光束=希望、剪影=神秘、逆光=英雄"
    },
    signatures: ["斯皮尔伯格脸推镜", "仰拍英雄时刻", "孩童视角", "光束穿透黑暗", "窗户/门框构图", "长镜头调度(oner)", "交叉剪辑高潮"]
  },

  christopher_nolan: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "每个时空内过渡清晰" },
      A2_30度规则: { variant: "遵守", description: "精确剪辑" },
      A3_轴线规则: { variant: "变化", description: "跨时空剪辑，但每个时空内保持" },
      B1_镜头时长: { variant: "变化", description: "用时长区分不同时间线" },
      B2_开场方式: { variant: "强化", description: "IMAX宏大远景" },
      B3_高潮处理: { variant: "强化", description: "多线交叉同时推向高潮" },
      C1_视线匹配: { variant: "遵守", description: "精确视线匹配" },
      C2_动作衔接: { variant: "强化", description: "实拍动作精密衔接" },
      C3_情绪承接: { variant: "变化", description: "时间错位制造悬念" },
      D_叙事结构: { variant: "变化", description: "非线性但逻辑严密" }
    },
    cameraMovement: {
      E1_运动类型: "稳定跟拍、手持(混乱时)、IMAX航拍",
      E2_运动节奏: "根据时间线变化，主线稳定，高潮加速",
      E3_运动动机: "跟随角色穿越空间、揭示宏大场景"
    },
    composition: {
      F1_对称性: "中心对称构图",
      F2_空间深度: "IMAX纵深，人物渺小于环境",
      F3_画面重心: "居中或稍偏，强调建筑感",
      F4_框架利用: "建筑线条、旋转走廊、镜面"
    },
    color: {
      G1_色调倾向: "冷色调为主，金属质感",
      G2_饱和度: "中低饱和度，写实基调",
      G3_色彩叙事: "不同时间线可能不同色调"
    },
    lighting: {
      H1_光源类型: "实拍自然光为主，少用CG补光",
      H2_光影对比: "中等对比，强调真实感",
      H3_光线叙事: "黑暗=未知、光明=真相"
    },
    signatures: ["IMAX宏大构图", "平行剪辑多时间线", "时间主题", "实拍偏好", "冷色调金属质感", "非线性叙事", "关键信息视觉隐藏"]
  },

  zhang_yimou: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "大远景→中景→特写流畅" },
      A2_30度规则: { variant: "遵守", description: "传统剪辑法则" },
      A3_轴线规则: { variant: "遵守", description: "武戏空间清晰" },
      B1_镜头时长: { variant: "强化", description: "文戏极慢，武戏极快" },
      B2_开场方式: { variant: "强化", description: "大远景群像色彩强烈" },
      B3_高潮处理: { variant: "强化", description: "武戏高潮极快配合鼓点" },
      C1_视线匹配: { variant: "遵守", description: "精确视线交流" },
      C2_动作衔接: { variant: "强化", description: "武术精心编排" },
      C3_情绪承接: { variant: "强化", description: "色彩编码情绪" },
      D_叙事结构: { variant: "遵守", description: "传统结构用色彩区分" }
    },
    cameraMovement: {
      E1_运动类型: "稳定横移、缓慢升降、静态大师镜头、俯拍航拍",
      E2_运动节奏: "文戏缓慢庄重，武戏跟随动作加速",
      E3_运动动机: "揭示群像阵列、跟随武术动作、俯瞰图案"
    },
    composition: {
      F1_对称性: "严格对称，宫殿式构图",
      F2_空间深度: "大纵深群像调度",
      F3_画面重心: "居中对称",
      F4_框架利用: "宫门、竹林、纱幔"
    },
    color: {
      G1_色调倾向: "根据情绪：红=激情、蓝=忧郁、白=纯净、黑=死亡",
      G2_饱和度: "高饱和度，色彩浓烈",
      G3_色彩叙事: "色彩区分阵营、情绪、回忆"
    },
    lighting: {
      H1_光源类型: "自然光与人工光对比，烛光、日光",
      H2_光影对比: "高对比，戏剧化光影",
      H3_光线叙事: "逆光剪影、光束穿透、阴影压迫"
    },
    signatures: ["色彩美学", "对称俯拍", "群像调度如图案", "飘动纱幔", "武术慢动作", "服装色块分区", "自然元素（水、雪、竹）"]
  },

  stanley_kubrick: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "精确控制的景别变化" },
      A2_30度规则: { variant: "遵守", description: "严格遵守" },
      A3_轴线规则: { variant: "遵守", description: "严格保持对称空间" },
      B1_镜头时长: { variant: "强化", description: "镜头普遍较长，让不安感积累" },
      B2_开场方式: { variant: "强化", description: "对称走廊或空间开场" },
      B3_高潮处理: { variant: "变化", description: "用视觉和音乐而非剪辑加速" },
      C1_视线匹配: { variant: "强化", description: "'库布里克凝视'直视镜头" },
      C2_动作衔接: { variant: "遵守", description: "精确衔接" },
      C3_情绪承接: { variant: "强化", description: "古典音乐反差制造不安" },
      D_叙事结构: { variant: "变化", description: "章节式结构，每章独立基调" }
    },
    cameraMovement: {
      E1_运动类型: "稳定跟拍、Steadicam跟随、缓慢推轨、几乎无手持",
      E2_运动节奏: "匀速缓慢，机械般精确",
      E3_运动动机: "跟随角色穿越对称空间、缓慢逼近揭示恐惧"
    },
    composition: {
      F1_对称性: "极度对称，标志性单点透视",
      F2_空间深度: "单点透视强调纵深",
      F3_画面重心: "严格居中",
      F4_框架利用: "走廊、门洞、浴室、镜子"
    },
    color: {
      G1_色调倾向: "根据题材：冷色(太空)、暖色(18世纪)、中性(现代)",
      G2_饱和度: "中等，追求真实质感",
      G3_色彩叙事: "红色=危险/暴力、白色=无菌/异化"
    },
    lighting: {
      H1_光源类型: "自然光或烛光实拍，《巴里·林登》全烛光",
      H2_光影对比: "根据题材：太空高对比、室内柔和",
      H3_光线叙事: "冷白光=异化、暖光=人性、红光=危险"
    },
    signatures: ["单点透视对称构图", "库布里克凝视(角色低头向上直视镜头)", "Steadicam跟随", "古典音乐反差配乐", "超长走廊", "几何化空间", "精确到强迫症的构图", "冷酷的观察视角"]
  },

  james_cameron: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "商业电影流畅过渡" },
      A2_30度规则: { variant: "遵守", description: "清晰的动作剪辑" },
      A3_轴线规则: { variant: "遵守", description: "动作场景空间清晰" },
      B1_镜头时长: { variant: "变化", description: "动作快速剪辑，情感场景较长" },
      B2_开场方式: { variant: "强化", description: "宏大场景建立世界观" },
      B3_高潮处理: { variant: "强化", description: "多线交叉、倒计时递进" },
      C1_视线匹配: { variant: "遵守", description: "精确视线匹配" },
      C2_动作衔接: { variant: "强化", description: "精密的动作编排" },
      C3_情绪承接: { variant: "强化", description: "浪漫+动作的情绪交织" },
      D_叙事结构: { variant: "遵守", description: "经典三幕剧+高潮递进" }
    },
    cameraMovement: {
      E1_运动类型: "跟拍、升降机、水下摄影、360度环绕",
      E2_运动节奏: "动作场景跟随动作，情感场景缓慢环绕",
      E3_运动动机: "跟随角色穿越危险、360度环绕浪漫时刻、仰拍英雄"
    },
    composition: {
      F1_对称性: "场面调度对称，但不死板",
      F2_空间深度: "3D深度强调，前景/中景/背景丰富",
      F3_画面重心: "人物为主，环境为衬",
      F4_框架利用: "潜艇窗、飞船窗、门框"
    },
    color: {
      G1_色调倾向: "蓝色为主(水、太空)、对比橙色(火、危险)",
      G2_饱和度: "中高饱和度，视觉震撼",
      G3_色彩叙事: "蓝=水/科技/未来、橙=火/危险/人性"
    },
    lighting: {
      H1_光源类型: "人工光主导，强调科技感",
      H2_光影对比: "高对比，戏剧化",
      H3_光线叙事: "蓝色科技光、橙色火光、水下光斑"
    },
    signatures: ["水下摄影", "宏大特效场景", "强女主角", "浪漫与动作交织", "倒计时高潮", "3D深度构图", "蓝橙对比色", "技术创新(Steadicam、3D、动捕)", "灾难场景逃生"]
  },

  bela_tarr: {
    ruleVariants: {
      A1_景别过渡: { variant: "打破", description: "极少剪辑，单镜头内完成景别变化" },
      A2_30度规则: { variant: "不适用", description: "极少剪辑，规则无从应用" },
      A3_轴线规则: { variant: "遵守", description: "长镜头内保持空间连贯" },
      B1_镜头时长: { variant: "打破", description: "所有镜头极长（5-10分钟），无短镜头" },
      B2_开场方式: { variant: "变化", description: "缓慢横移逐渐揭示环境" },
      B3_高潮处理: { variant: "打破", description: "无明显高潮，节奏始终缓慢" },
      C1_视线匹配: { variant: "变化", description: "长镜头内跟随视线移动" },
      C2_动作衔接: { variant: "变化", description: "动作在单镜头内完整呈现" },
      C3_情绪承接: { variant: "强化", description: "缓慢节奏让情绪自然流淌" },
      D_叙事结构: { variant: "打破", description: "消解叙事结构，时间即内容" }
    },
    cameraMovement: {
      E1_运动类型: "缓慢横向跟拍、极少升降、稳定器长镜头",
      E2_运动节奏: "极缓慢，如沉默观察者",
      E3_运动动机: "跟随人物行走、无目的地漫游、观察日常动作"
    },
    composition: {
      F1_对称性: "不刻意对称，自然随意",
      F2_空间深度: "水平线构图，远距离观察",
      F3_画面重心: "人物常处于画面边缘或行走穿越",
      F4_框架利用: "窗户、门洞、走廊"
    },
    color: {
      G1_色调倾向: "纯黑白，无彩色",
      G2_饱和度: "不适用（黑白）",
      G3_色彩叙事: "用灰度层次表达情绪"
    },
    lighting: {
      H1_光源类型: "自然光为主，阴天、雨天",
      H2_光影对比: "低对比，灰蒙蒙质感",
      H3_光线叙事: "阴郁光线=存在主义困境"
    },
    signatures: ["超长镜头（单镜5-10分钟）", "横向跟拍人物行走", "黑白影像", "雨水/风/泥泞", "存在主义凝视", "重复日常动作", "环境声主导", "消解叙事"]
  },

  bi_gan: {
    ruleVariants: {
      A1_景别过渡: { variant: "打破", description: "长镜头内景别自由流动" },
      A2_30度规则: { variant: "变化", description: "长镜头无剪辑；剪辑处诗意跳切" },
      A3_轴线规则: { variant: "打破", description: "梦境段落故意打破空间逻辑" },
      B1_镜头时长: { variant: "打破", description: "长镜头为主（可达60分钟）" },
      B2_开场方式: { variant: "变化", description: "诗意碎片式开场" },
      B3_高潮处理: { variant: "打破", description: "情绪如梦境流动，无明确高潮" },
      C1_视线匹配: { variant: "变化", description: "视线常望向虚空" },
      C2_动作衔接: { variant: "打破", description: "时空跳跃，动作不连续" },
      C3_情绪承接: { variant: "强化", description: "诗歌、音乐、光影编织情绪" },
      D_叙事结构: { variant: "打破", description: "梦境逻辑，时间折叠" }
    },
    cameraMovement: {
      E1_运动类型: "自由跟拍、升降机穿越空间、无人机航拍、手持漫游",
      E2_运动节奏: "缓慢流动，如梦游",
      E3_运动动机: "跟随角色穿越时空、无缝转场、揭示记忆空间"
    },
    composition: {
      F1_对称性: "不刻意对称，诗意随性",
      F2_空间深度: "多层空间叠加，3D纵深",
      F3_画面重心: "人物常处于空间中漫游",
      F4_框架利用: "隧道、矿洞、楼梯、镜面"
    },
    color: {
      G1_色调倾向: "青绿色主调，潮湿感",
      G2_饱和度: "中低饱和度，朦胧",
      G3_色彩叙事: "霓虹=梦境、青绿=记忆、暖色=现实"
    },
    lighting: {
      H1_光源类型: "实景光源：霓虹灯、火把、月光",
      H2_光影对比: "低对比，朦胧光晕",
      H3_光线叙事: "光晕=梦境边界、黑暗=记忆深处"
    },
    signatures: ["超长镜头（60分钟）", "3D转场", "霓虹光晕", "诗歌画外音", "镜面反射", "时空折叠", "贵州山水", "梦境与现实无缝"]
  },

  wong_kar_wai: {
    ruleVariants: {
      A1_景别过渡: { variant: "打破", description: "远景直接跳到极近景，跳切疏离感" },
      A2_30度规则: { variant: "打破", description: "小于30度跳切配合抽帧" },
      A3_轴线规则: { variant: "遵守", description: "保持轴线，用镜子制造迷宫" },
      B1_镜头时长: { variant: "强化", description: "情感凝视镜头极长（10-15秒）" },
      B2_开场方式: { variant: "变化", description: "人物特写或局部开场" },
      B3_高潮处理: { variant: "打破", description: "高潮时反而放慢，慢动作留白" },
      C1_视线匹配: { variant: "变化", description: "大量视线镜头，但不揭示对象" },
      C2_动作衔接: { variant: "打破", description: "省略动作中段" },
      C3_情绪承接: { variant: "强化", description: "音乐和色彩强化情绪" },
      D_叙事结构: { variant: "打破", description: "情绪碎片化拼接" }
    },
    cameraMovement: {
      E1_运动类型: "手持摄影、慢动作跟拍、快门拖影",
      E2_运动节奏: "抽帧造成不规则节奏",
      E3_运动动机: "贴近角色、捕捉瞬间情绪、营造亲密感"
    },
    composition: {
      F1_对称性: "不对称，人物常在画面边缘",
      F2_空间深度: "狭窄空间压缩，走廊、楼梯",
      F3_画面重心: "人物偏离中心，留出情绪空间",
      F4_框架利用: "门框、窗帘、镜子、玻璃反射"
    },
    color: {
      G1_色调倾向: "暖色霓虹为主，红绿对比",
      G2_饱和度: "高饱和度，浓烈色彩",
      G3_色彩叙事: "红=欲望、绿=孤独、蓝=忧郁"
    },
    lighting: {
      H1_光源类型: "霓虹灯、路灯、烟雾中的光",
      H2_光影对比: "中高对比，剪影效果",
      H3_光线叙事: "霓虹=都市孤独、烟雾=暧昧、逆光=神秘"
    },
    signatures: ["抽帧（6-12fps）", "手持摄影", "霓虹剪影", "框中框", "画外音独白", "时间字幕", "重复音乐主题", "《加州梦》式配乐"]
  },

  wes_anderson: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "景别过渡清晰，用平移过渡" },
      A2_30度规则: { variant: "变化", description: "偏好正面平视角度切换" },
      A3_轴线规则: { variant: "遵守", description: "严格保持，空间几何化" },
      B1_镜头时长: { variant: "遵守", description: "均匀节奏，喜剧时机精确" },
      B2_开场方式: { variant: "强化", description: "对称构图书页式开场" },
      B3_高潮处理: { variant: "变化", description: "章节卡分隔，节奏均匀" },
      C1_视线匹配: { variant: "变化", description: "演员直视镜头打破第四面墙" },
      C2_动作衔接: { variant: "遵守", description: "动作精确如舞台剧" },
      C3_情绪承接: { variant: "变化", description: "章节标题和配乐转换情绪" },
      D_叙事结构: { variant: "变化", description: "章节式叙事" }
    },
    cameraMovement: {
      E1_运动类型: "平移横摇、垂直升降、几乎无手持",
      E2_运动节奏: "匀速平滑，机械精确",
      E3_运动动机: "揭示对称空间、横移展示场景如舞台"
    },
    composition: {
      F1_对称性: "严格对称，标志性风格",
      F2_空间深度: "平面化舞台感",
      F3_画面重心: "严格居中",
      F4_框架利用: "窗户格子、书架、模型屋"
    },
    color: {
      G1_色调倾向: "糖果色调，粉黄蓝绿",
      G2_饱和度: "高饱和度，人工美感",
      G3_色彩叙事: "每部电影有专属色板"
    },
    lighting: {
      H1_光源类型: "人工均匀光，无明显光源感",
      H2_光影对比: "低对比，平光为主",
      H3_光线叙事: "光线服务于色彩而非情绪"
    },
    signatures: ["严格对称构图", "糖果色调", "平移横摇", "俯拍插入镜头", "章节卡", "直视镜头", "微缩模型", "60年代流行乐"]
  },

  david_fincher: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "精确流畅" },
      A2_30度规则: { variant: "遵守", description: "精准剪辑" },
      A3_轴线规则: { variant: "遵守", description: "严格保持" },
      B1_镜头时长: { variant: "变化", description: "整体紧凑，快速交叉溶解省略时间" },
      B2_开场方式: { variant: "强化", description: "精心设计片头序列" },
      B3_高潮处理: { variant: "遵守", description: "悬疑递进，信息逐层揭示" },
      C1_视线匹配: { variant: "遵守", description: "精确视线匹配" },
      C2_动作衔接: { variant: "遵守", description: "精密衔接" },
      C3_情绪承接: { variant: "强化", description: "冷色调和暗部营造压抑" },
      D_叙事结构: { variant: "遵守", description: "经典悬疑结构，结局反转" }
    },
    cameraMovement: {
      E1_运动类型: "稳定跟拍、CG辅助不可能机位、精准推轨",
      E2_运动节奏: "机械精确，几乎无晃动",
      E3_运动动机: "穿越空间揭示证据、跟随角色调查"
    },
    composition: {
      F1_对称性: "精准对称，强迫症级别",
      F2_空间深度: "利用纵深引导视线到证据",
      F3_画面重心: "居中或三分法精确",
      F4_框架利用: "审讯室窗户、电脑屏幕、门框"
    },
    color: {
      G1_色调倾向: "冷色调，青绿灰",
      G2_饱和度: "低饱和度，压抑感",
      G3_色彩叙事: "冷色=理性/压抑、偶尔暖色=危险信号"
    },
    lighting: {
      H1_光源类型: "人工光精确控制",
      H2_光影对比: "中高对比，暗部细节丰富",
      H3_光线叙事: "阴影隐藏线索、光线揭示真相"
    },
    signatures: ["冷色调", "精准构图", "CG辅助不可能机位", "法医级细节特写", "隐形剪辑", "开场片头设计", "九宫格构图", "多次拍摄追求完美"]
  },

  alfonso_cuaron: {
    ruleVariants: {
      A1_景别过渡: { variant: "变化", description: "长镜头内景别自由变化" },
      A2_30度规则: { variant: "不适用", description: "长镜头为主" },
      A3_轴线规则: { variant: "变化", description: "360度环绕但空间清晰" },
      B1_镜头时长: { variant: "打破", description: "长镜头为主，沉浸式" },
      B2_开场方式: { variant: "强化", description: "长镜头缓慢揭示" },
      B3_高潮处理: { variant: "变化", description: "长镜头内完成高潮" },
      C1_视线匹配: { variant: "变化", description: "单镜头内跟随视线" },
      C2_动作衔接: { variant: "变化", description: "动作在单镜头内完整" },
      C3_情绪承接: { variant: "强化", description: "呼吸式节奏同步体验" },
      D_叙事结构: { variant: "遵守", description: "遵循结构但消解剪辑痕迹" }
    },
    cameraMovement: {
      E1_运动类型: "长镜头跟拍、360度环绕、手持沉浸",
      E2_运动节奏: "与角色呼吸同步，紧张时加速",
      E3_运动动机: "跟随角色穿越危险、环绕揭示空间全貌"
    },
    composition: {
      F1_对称性: "不刻意对称，跟随动作",
      F2_空间深度: "深焦，前中后景同时清晰",
      F3_画面重心: "人物为中心，环境包围",
      F4_框架利用: "车窗、太空舱窗、水面"
    },
    color: {
      G1_色调倾向: "根据题材：《地心引力》冷色、《罗马》暖色",
      G2_饱和度: "中等，自然真实",
      G3_色彩叙事: "色彩服务于真实感"
    },
    lighting: {
      H1_光源类型: "自然光为主",
      H2_光影对比: "自然对比，不戏剧化",
      H3_光线叙事: "太空光=孤独、阳光=希望"
    },
    signatures: ["沉浸式长镜头", "360度环绕", "深焦摄影", "自然光", "动机驱动运镜", "呼吸同步节奏", "灾难中的生存"]
  },

  denis_villeneuve: {
    ruleVariants: {
      A1_景别过渡: { variant: "强化", description: "缓慢推进，从宏大到细节" },
      A2_30度规则: { variant: "遵守", description: "精确剪辑" },
      A3_轴线规则: { variant: "遵守", description: "严格保持" },
      B1_镜头时长: { variant: "变化", description: "整体镜头较长，压迫性缓慢" },
      B2_开场方式: { variant: "强化", description: "纪念碑式大远景" },
      B3_高潮处理: { variant: "变化", description: "缓慢逼近，压迫感胜过速度" },
      C1_视线匹配: { variant: "遵守", description: "精确视线匹配" },
      C2_动作衔接: { variant: "遵守", description: "精密衔接" },
      C3_情绪承接: { variant: "强化", description: "低频音效和雾气营造压迫" },
      D_叙事结构: { variant: "遵守", description: "遵循结构但节奏极度克制" }
    },
    cameraMovement: {
      E1_运动类型: "缓慢推轨、航拍、稳定升降",
      E2_运动节奏: "极缓慢，压迫性逼近",
      E3_运动动机: "揭示宏大场景、逼近未知威胁"
    },
    composition: {
      F1_对称性: "对称构图，纪念碑感",
      F2_空间深度: "极大纵深，人物渺小",
      F3_画面重心: "居中，小人物对宏大环境",
      F4_框架利用: "飞船舱门、沙漠地平线、雾气"
    },
    color: {
      G1_色调倾向: "冷色为主，橙褐沙漠",
      G2_饱和度: "低饱和度，荒凉感",
      G3_色彩叙事: "冷蓝=科技、橙褐=荒漠、黑=未知"
    },
    lighting: {
      H1_光源类型: "自然光+雾气散射",
      H2_光影对比: "高对比，明暗分明",
      H3_光线叙事: "光束穿透雾气=启示、黑暗=未知恐惧"
    },
    signatures: ["宏大远景", "极简对白", "明暗对比", "雾气光束", "低频音效", "压迫感氛围", "人与宏大环境的对比"]
  },

  park_chan_wook: {
    ruleVariants: {
      A1_景别过渡: { variant: "变化", description: "精心编排，常用倾斜揭示" },
      A2_30度规则: { variant: "遵守", description: "精确剪辑" },
      A3_轴线规则: { variant: "变化", description: "用镜像对称暗示角色关系" },
      B1_镜头时长: { variant: "变化", description: "暴力场景慢动作延长" },
      B2_开场方式: { variant: "强化", description: "华丽构图建立风格" },
      B3_高潮处理: { variant: "强化", description: "复仇叙事层层揭示" },
      C1_视线匹配: { variant: "强化", description: "角色对视的张力" },
      C2_动作衔接: { variant: "强化", description: "暴力动作如舞蹈" },
      C3_情绪承接: { variant: "强化", description: "红绿色彩对比强化张力" },
      D_叙事结构: { variant: "遵守", description: "复仇三部曲式叙事" }
    },
    cameraMovement: {
      E1_运动类型: "急速倾斜、横向跟拍、垂直升降",
      E2_运动节奏: "变化丰富，暴力时放慢",
      E3_运动动机: "跟随复仇行动、揭示隐藏真相"
    },
    composition: {
      F1_对称性: "对称构图暗示对立关系",
      F2_空间深度: "分屈光镜制造多层空间",
      F3_画面重心: "精心设计的不平衡感",
      F4_框架利用: "镜子、屏风、监狱栏杆"
    },
    color: {
      G1_色调倾向: "红绿对比为主",
      G2_饱和度: "高饱和度，浓烈",
      G3_色彩叙事: "红=暴力/欲望、绿=病态/嫉妒"
    },
    lighting: {
      H1_光源类型: "人工光精心设计",
      H2_光影对比: "高对比，戏剧化",
      H3_光线叙事: "阴影=秘密、光=暴露"
    },
    signatures: ["对称构图", "急速倾斜", "分屈光镜", "红绿色彩对比", "精致暴力", "章回体叙事", "复仇主题", "走廊打斗长镜头"]
  },

  hirokazu_koreeda: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "自然流畅" },
      A2_30度规则: { variant: "遵守", description: "传统剪辑" },
      A3_轴线规则: { variant: "遵守", description: "严格保持" },
      B1_镜头时长: { variant: "变化", description: "整体较长，生活化节奏" },
      B2_开场方式: { variant: "变化", description: "日常细节开场（枕头镜头）" },
      B3_高潮处理: { variant: "打破", description: "情感高潮极度克制" },
      C1_视线匹配: { variant: "遵守", description: "自然视线交流" },
      C2_动作衔接: { variant: "遵守", description: "日常动作自然连续" },
      C3_情绪承接: { variant: "强化", description: "情绪慢慢渗透，不过度渲染" },
      D_叙事结构: { variant: "变化", description: "生活化叙事，结构松散" }
    },
    cameraMovement: {
      E1_运动类型: "固定机位为主、轻微手持、极少运动",
      E2_运动节奏: "静态观察，偶尔跟随",
      E3_运动动机: "观察日常生活、不干预角色"
    },
    composition: {
      F1_对称性: "不刻意对称，自然随意",
      F2_空间深度: "家庭空间的亲密感",
      F3_画面重心: "人物自然分布",
      F4_框架利用: "餐桌、厨房、走廊"
    },
    color: {
      G1_色调倾向: "暖色调，温馨感",
      G2_饱和度: "中等，自然真实",
      G3_色彩叙事: "色彩服务于真实感"
    },
    lighting: {
      H1_光源类型: "自然光为主",
      H2_光影对比: "低对比，柔和",
      H3_光线叙事: "阳光=家庭温暖、阴天=淡淡忧伤"
    },
    signatures: ["自然光", "餐桌场景", "枕头镜头", "孩童视角", "食物特写", "克制情感", "日常对话", "非专业演员即兴"]
  },

  hou_hsiao_hsien: {
    ruleVariants: {
      A1_景别过渡: { variant: "打破", description: "极少剪辑，单镜头固定景别" },
      A2_30度规则: { variant: "不适用", description: "极少剪辑" },
      A3_轴线规则: { variant: "遵守", description: "固定机位保持空间连贯" },
      B1_镜头时长: { variant: "打破", description: "全部长镜头，固定观察" },
      B2_开场方式: { variant: "变化", description: "远距离观察，前景遮挡" },
      B3_高潮处理: { variant: "打破", description: "无明显高潮，边缘剪辑" },
      C1_视线匹配: { variant: "变化", description: "远距离观察，不强调匹配" },
      C2_动作衔接: { variant: "打破", description: "省略式剪辑，只留片段" },
      C3_情绪承接: { variant: "强化", description: "环境声和留白营造情绪" },
      D_叙事结构: { variant: "打破", description: "省略式叙事，大量留白" }
    },
    cameraMovement: {
      E1_运动类型: "固定机位为主、极少运动",
      E2_运动节奏: "静止观察",
      E3_运动动机: "作为旁观者观察生活"
    },
    composition: {
      F1_对称性: "不刻意对称",
      F2_空间深度: "多层空间，前景遮挡",
      F3_画面重心: "人物常在画面边缘或被遮挡",
      F4_框架利用: "门框、窗户、树木、纱帘"
    },
    color: {
      G1_色调倾向: "自然色调，根据年代变化",
      G2_饱和度: "中等，自然",
      G3_色彩叙事: "色彩服务于时代感"
    },
    lighting: {
      H1_光源类型: "自然光为主",
      H2_光影对比: "自然对比",
      H3_光线叙事: "光线表达时间流逝"
    },
    signatures: ["固定远景", "前景遮挡", "负空间", "环境声桥接", "留白", "省略式剪辑", "边缘剪辑", "历史感"]
  },

  tsai_ming_liang: {
    ruleVariants: {
      A1_景别过渡: { variant: "打破", description: "几乎无景别变化，单镜头固定" },
      A2_30度规则: { variant: "不适用", description: "极少剪辑" },
      A3_轴线规则: { variant: "遵守", description: "固定机位凝视" },
      B1_镜头时长: { variant: "打破", description: "所有镜头极长（5分钟+）" },
      B2_开场方式: { variant: "变化", description: "建筑框架孤立人物" },
      B3_高潮处理: { variant: "打破", description: "无高潮，时间即内容" },
      C1_视线匹配: { variant: "打破", description: "不使用传统视线匹配" },
      C2_动作衔接: { variant: "打破", description: "硬切转场，无过渡" },
      C3_情绪承接: { variant: "变化", description: "只用现场声，情绪自然发生" },
      D_叙事结构: { variant: "打破", description: "消解叙事结构" }
    },
    cameraMovement: {
      E1_运动类型: "固定机位凝视、几乎无运动",
      E2_运动节奏: "静止",
      E3_运动动机: "作为凝视者观察孤独"
    },
    composition: {
      F1_对称性: "建筑几何化",
      F2_空间深度: "建筑空间的压迫感",
      F3_画面重心: "人物孤立于空间中央或边缘",
      F4_框架利用: "建筑框架、走廊、楼梯、废墟"
    },
    color: {
      G1_色调倾向: "冷灰色调为主",
      G2_饱和度: "低饱和度，荒凉",
      G3_色彩叙事: "灰色=都市疏离"
    },
    lighting: {
      H1_光源类型: "自然光、日光灯",
      H2_光影对比: "低对比，平淡",
      H3_光线叙事: "日光灯=都市异化"
    },
    signatures: ["超长静态镜头", "建筑框架", "只用现场声", "雨水/水元素", "硬切", "都市疏离", "极少对白", "身体展示", "时间即内容"]
  },

  custom: {
    ruleVariants: {
      A1_景别过渡: { variant: "遵守", description: "根据用户描述确定" },
      A2_30度规则: { variant: "遵守", description: "根据用户描述确定" },
      A3_轴线规则: { variant: "遵守", description: "根据用户描述确定" },
      B1_镜头时长: { variant: "遵守", description: "根据用户描述确定" },
      B2_开场方式: { variant: "遵守", description: "根据用户描述确定" },
      B3_高潮处理: { variant: "遵守", description: "根据用户描述确定" },
      C1_视线匹配: { variant: "遵守", description: "根据用户描述确定" },
      C2_动作衔接: { variant: "遵守", description: "根据用户描述确定" },
      C3_情绪承接: { variant: "遵守", description: "根据用户描述确定" },
      D_叙事结构: { variant: "遵守", description: "根据用户描述确定" }
    },
    cameraMovement: {
      E1_运动类型: "根据用户描述确定",
      E2_运动节奏: "根据用户描述确定",
      E3_运动动机: "根据用户描述确定"
    },
    composition: {
      F1_对称性: "根据用户描述确定",
      F2_空间深度: "根据用户描述确定",
      F3_画面重心: "根据用户描述确定",
      F4_框架利用: "根据用户描述确定"
    },
    color: {
      G1_色调倾向: "根据用户描述确定",
      G2_饱和度: "根据用户描述确定",
      G3_色彩叙事: "根据用户描述确定"
    },
    lighting: {
      H1_光源类型: "根据用户描述确定",
      H2_光影对比: "根据用户描述确定",
      H3_光线叙事: "根据用户描述确定"
    },
    signatures: ["根据用户描述确定"]
  }
};

// Universal cinematography rules (基础分镜法则)
export const universalCinematographyRules = {
  A_景别衔接: {
    A1_循序渐进: "景别变化应有过渡（远→全→中→近→特），避免跳跃过大",
    A2_30度规则: "相邻镜头机位变化至少30度，避免跳切感",
    A3_轴线规则: "保持180度轴线，确保空间方向连贯"
  },
  B_节奏控制: {
    B1_长短搭配: "激烈场景短镜头（2-3秒），抒情场景长镜头（5-8秒）",
    B2_开场建立: "第一镜通常是环境交代（远景或全景）",
    B3_高潮递进: "情绪高潮前镜头加快、景别收紧"
  },
  C_视觉引导: {
    C1_视线匹配: "角色看向画外→下一镜展示视线方向",
    C2_动作衔接: "动作在前镜开始，后镜接续",
    C3_情绪承接: "相邻镜头氛围有逻辑过渡"
  },
  D_叙事结构: {
    D1_起: "建立场景空间和人物位置",
    D2_承: "展开叙事，推进情节",
    D3_转: "情绪或事件转折点",
    D4_合: "场景收尾，留有余韵"
  }
};

// Visual style info
export const visualStyleInfo: Record<VisualStyle, { name: string; nameCN: string }> = {
  realistic: { name: "Realistic", nameCN: "写实风格" },
  cinematic: { name: "Cinematic", nameCN: "电影感" },
  vintage_film: { name: "Vintage Film", nameCN: "复古胶片感" },
  neon_cyberpunk: { name: "Neon Cyberpunk", nameCN: "霓虹赛博朋克" },
  black_white: { name: "Black & White", nameCN: "黑白影像" },
  dreamy_soft: { name: "Dreamy Soft", nameCN: "梦幻柔光" },
  documentary: { name: "Documentary", nameCN: "纪录片风格" },
  animation_storyboard: { name: "Animation Storyboard", nameCN: "动画分镜风格" },
  custom: { name: "Custom", nameCN: "自定义" },
};

// Project type info
export const projectTypeInfo: Record<ProjectType, { name: string; nameCN: string }> = {
  advertisement: { name: "Advertisement", nameCN: "广告" },
  short_video: { name: "Short Video", nameCN: "短视频" },
  movie: { name: "Movie", nameCN: "电影" },
  web_series: { name: "Web Series", nameCN: "网剧" },
  micro_film: { name: "Micro Film", nameCN: "微电影" },
  documentary: { name: "Documentary", nameCN: "纪录片" },
  mv: { name: "Music Video", nameCN: "MV" },
};

// Shot type info
export const shotTypeInfo: Record<ShotType, { name: string; nameCN: string }> = {
  extreme_wide: { name: "Extreme Wide Shot", nameCN: "大远景" },
  wide: { name: "Wide Shot", nameCN: "远景" },
  full: { name: "Full Shot", nameCN: "全景" },
  medium: { name: "Medium Shot", nameCN: "中景" },
  close_up: { name: "Close-up", nameCN: "近景" },
  extreme_close_up: { name: "Extreme Close-up", nameCN: "特写" },
  over_shoulder: { name: "Over-the-shoulder", nameCN: "过肩镜头" },
  pov: { name: "Point of View", nameCN: "主观镜头" },
};

// Camera angle info
export const cameraAngleInfo: Record<CameraAngle, { name: string; nameCN: string }> = {
  eye_level: { name: "Eye Level", nameCN: "平视" },
  low_angle: { name: "Low Angle", nameCN: "仰拍" },
  high_angle: { name: "High Angle", nameCN: "俯拍" },
  bird_eye: { name: "Bird's Eye View", nameCN: "鸟瞰" },
  dutch_angle: { name: "Dutch Angle", nameCN: "倾斜角度" },
  worm_eye: { name: "Worm's Eye View", nameCN: "蚁视" },
};

// Camera movement info
export const cameraMovementInfo: Record<CameraMovement, { name: string; nameCN: string }> = {
  static: { name: "Static", nameCN: "固定" },
  pan: { name: "Pan", nameCN: "摇镜" },
  tilt: { name: "Tilt", nameCN: "俯仰" },
  dolly: { name: "Dolly", nameCN: "推拉" },
  tracking: { name: "Tracking", nameCN: "跟踪" },
  crane: { name: "Crane", nameCN: "升降" },
  handheld: { name: "Handheld", nameCN: "手持" },
  steadicam: { name: "Steadicam", nameCN: "斯坦尼康" },
  zoom: { name: "Zoom", nameCN: "变焦" },
};
