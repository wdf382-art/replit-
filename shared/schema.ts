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

// Director detailed storyboarding rules
export const directorStyleRules: Record<DirectorStyle, {
  shotPreferences: string;
  cameraWork: string;
  pacing: string;
  composition: string;
  signatures: string;
}> = {
  quentin_tarantino: {
    shotPreferences: "偏好中景对话镜头、脚部特写、后备箱仰拍视角、墨西哥对峙式多人构图",
    cameraWork: "大量使用推轨跟拍、急速变焦（crash zoom）揭示、横摇对切",
    pacing: "对话场景节奏缓慢，暴力场景突然加速，使用慢动作强化关键时刻",
    composition: "低角度拍摄赋予角色力量感，对称构图用于对峙场景",
    signatures: "章节式叙事、突然的暴力爆发、长段对话后的动作高潮"
  },
  steven_spielberg: {
    shotPreferences: "长镜头调度（oner）、'斯皮尔伯格脸'推镜（角色凝视画外的反应镜头）、仰拍英雄时刻",
    cameraWork: "平滑推轨、缓慢推近面部、前景/背景深度调度",
    pacing: "情感场景用较长镜头酝酿，高潮时用交叉剪辑加速",
    composition: "光束穿透黑暗、剪影逆光、人物置于宏大场景前",
    signatures: "孩童视角仰拍、家庭团聚主题、窗户/门框构图"
  },
  christopher_nolan: {
    shotPreferences: "IMAX级宏大远景、精确的平行剪辑、实拍偏好（少用CG）",
    cameraWork: "手持摄影营造混乱感、稳定跟拍用于清晰叙事",
    pacing: "多线叙事交叉剪辑、时间操控式剪辑节奏",
    composition: "中心对称构图、冷色调金属质感、极简环境",
    signatures: "时间主题、倒叙或非线性、关键信息视觉隐藏"
  },
  zhang_yimou: {
    shotPreferences: "大远景群像调度、对称俯拍、纹理特写（布料、武器、自然元素）",
    cameraWork: "稳定横移跟随、缓慢升降机运动、静态大师镜头",
    pacing: "慢节奏铺垫、武戏快速剪辑、情绪高潮延长",
    composition: "强烈色彩编码（红=激情、蓝=忧郁、白=纯净）、对称构图、服装色块分区",
    signatures: "群演编排如图案、飘动纱幔作为画面元素、自然光与人工光对比"
  },
  bela_tarr: {
    shotPreferences: "超长镜头（单镜可达5-10分钟）、水平线构图、远距离观察式构图",
    cameraWork: "缓慢横向跟拍人物行走、极少剪辑、摄影机如沉默观察者",
    pacing: "极度缓慢、让观众感受时间流逝、动作边缘剪辑",
    composition: "地平线水平分割、灰度影像、雨水/风/泥泞作为视觉元素",
    signatures: "存在主义凝视、日常动作的仪式化、环境声设计"
  },
  bi_gan: {
    shotPreferences: "梦幻长镜头、横向漂移式运动、镜面反射揭示",
    cameraWork: "手持跟拍穿越空间、360度环绕、时空跳跃式长镜头",
    pacing: "诗意节奏、现实与梦境交织、情绪驱动而非情节驱动",
    composition: "霓虹光晕、雾气层叠、水面倒影",
    signatures: "3D长镜头、诗歌画外音、时间折叠叙事"
  },
  wong_kar_wai: {
    shotPreferences: "肩部近景、倾斜走廊视角、抽帧（6-12fps跳帧效果）",
    cameraWork: "手持摄影创造亲密感、慢动作强化情绪、快门拖影",
    pacing: "拉长的凝视时刻、情绪重于情节、省略式叙事",
    composition: "霓虹灯剪影、烟雾弥漫、框中框（门框、镜子）",
    signatures: "重复音乐主题、画外音独白、时间跨度字幕"
  },
  wes_anderson: {
    shotPreferences: "严格对称构图、正面平视角度、垂直俯拍插入",
    cameraWork: "平移横摇（pan）、精确停位、缩放揭示",
    pacing: "章节卡分隔、均匀节奏、喜剧时机精确",
    composition: "糖果色调调色板、居中构图、平面化空间感",
    signatures: "书信/报纸特写插入、微缩模型感、演员直视镜头"
  },
  david_fincher: {
    shotPreferences: "精确锁定机位微调、法医级细节特写、冷色调低对比度",
    cameraWork: "CGI辅助不可能机位、缓慢推近、隐形剪辑",
    pacing: "紧凑高效、快速交叉溶解省略时间、信息密集",
    composition: "绿/青冷色调、暗部细节保留、几何构图",
    signatures: "开场精心设计的信用序列、科技/数字界面、心理悬疑"
  },
  alfonso_cuaron: {
    shotPreferences: "沉浸式长镜头（oner）、动机驱动的摄影机运动、深焦环境叙事",
    cameraWork: "360度手持环绕、跟拍穿越复杂空间、自然光优先",
    pacing: "呼吸式节奏、让观众与角色同步体验时间",
    composition: "深度调度（前景动作+背景叙事）、自然主义光影对比",
    signatures: "单镜头动作场景、角色在真实空间中移动、声音设计沉浸感"
  },
  denis_villeneuve: {
    shotPreferences: "纪念碑式大远景配中心小人物、缓慢推进、极简对白间隙",
    cameraWork: "缓慢推轨靠近、静态凝视、航拍宏观",
    pacing: "压迫性缓慢、沉默比对话多、氛围营造优先",
    composition: "明暗对比（chiaroscuro）、雾气光束、负空间压迫",
    signatures: "低频音效设计、外星/未来环境、存在主义主题"
  },
  park_chan_wook: {
    shotPreferences: "巴洛克式对称构图、急速倾斜揭示（whip-tilt）、分屈光镜（split diopter）",
    cameraWork: "精心编排的复杂运动、镜像对称机位、垂直升降",
    pacing: "精致暴力的慢动作、复仇叙事的层层揭示",
    composition: "红绿色彩对比张力、对称镜像角色、华丽美术设计",
    signatures: "复仇三部曲式叙事、精心设计的暴力美学、章回体结构"
  },
  hirokazu_koreeda: {
    shotPreferences: "平视静态中景、自然光室内、日常细节枕头镜头（pillow shots）",
    cameraWork: "固定机位观察、极少运动、不打扰式拍摄",
    pacing: "生活化节奏、情感慢慢渗透、克制的高潮",
    composition: "餐桌对话构图、窗户自然光、家庭空间",
    signatures: "家庭题材、食物场景、孩童视角"
  },
  hou_hsiao_hsien: {
    shotPreferences: "远距离固定远景、负空间前景遮挡、环境声桥接",
    cameraWork: "几乎不动的摄影机、远距离观察、自然发生式调度",
    pacing: "极度留白、动作边缘剪辑、省略式叙事",
    composition: "前景遮挡物（门框、树枝）、深远空间感、自然光",
    signatures: "历史题材、台湾在地性、沉默多于对话"
  },
  tsai_ming_liang: {
    shotPreferences: "超长静态镜头（单镜可5分钟以上）、建筑框架孤立人物、只用现场声",
    cameraWork: "完全静止凝视、不打扰观察、时间即内容",
    pacing: "挑战观众耐心的缓慢、硬切转场、无过渡",
    composition: "都市疏离空间、雨水/水元素、人物渺小于空间",
    signatures: "极简对白、身体性表演、城市异化主题"
  },
  custom: {
    shotPreferences: "根据用户描述确定",
    cameraWork: "根据用户描述确定",
    pacing: "根据用户描述确定",
    composition: "根据用户描述确定",
    signatures: "根据用户描述确定"
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
