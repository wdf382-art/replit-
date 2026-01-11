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
  title: text("title").notNull(),
  location: text("location"),
  timeOfDay: text("time_of_day"),
  description: text("description"),
  dialogue: text("dialogue"),
  action: text("action"),
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

// Director style info for display
export const directorStyleInfo: Record<DirectorStyle, { name: string; nameCN: string; traits: string; works: string }> = {
  quentin_tarantino: { name: "Quentin Tarantino", nameCN: "昆汀·塔伦蒂诺", traits: "长对话、脚部特写、非线性叙事、暴力美学", works: "《低俗小说》《杀死比尔》" },
  steven_spielberg: { name: "Steven Spielberg", nameCN: "史蒂文·斯皮尔伯格", traits: "情感渲染、仰拍英雄、光影运用", works: "《辛德勒的名单》《E.T.》" },
  christopher_nolan: { name: "Christopher Nolan", nameCN: "克里斯托弗·诺兰", traits: "复杂叙事、IMAX构图、实拍偏好", works: "《盗梦空间》《星际穿越》" },
  zhang_yimou: { name: "Zhang Yimou", nameCN: "张艺谋", traits: "色彩美学、对称构图、群像调度", works: "《英雄》《影》" },
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
