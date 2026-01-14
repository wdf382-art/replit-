import { db } from "./db";
import {
  users,
  projects,
  scripts,
  scenes,
  shots,
  characters,
  characterAssetReferences,
  characterImageVariants,
  performanceGuides,
  sceneAnalysis,
  productionNotes,
  callSheets,
  scriptVersions,
  shotVersions,
  scriptAnalysisGlobal,
  performanceGuidesV2,
} from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  User,
  InsertUser,
  Project,
  InsertProject,
  Script,
  InsertScript,
  Scene,
  InsertScene,
  Shot,
  InsertShot,
  Character,
  InsertCharacter,
  CharacterAssetReference,
  InsertCharacterAssetReference,
  PerformanceGuide,
  InsertPerformanceGuide,
  SceneAnalysis,
  InsertSceneAnalysis,
  ProductionNotes,
  InsertProductionNotes,
  CallSheet,
  InsertCallSheet,
  ScriptVersion,
  InsertScriptVersion,
  ShotVersion,
  InsertShotVersion,
  ScriptAnalysisGlobal,
  InsertScriptAnalysisGlobal,
  PerformanceGuideV2,
  InsertPerformanceGuideV2,
  CharacterAssetType,
  CharacterImageVariant,
  InsertCharacterImageVariant,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  getScripts(projectId: string): Promise<Script[]>;
  getScript(id: string): Promise<Script | undefined>;
  createScript(script: InsertScript): Promise<Script>;
  updateScript(id: string, script: Partial<InsertScript>): Promise<Script | undefined>;

  getScenes(projectId: string): Promise<Scene[]>;
  getScene(id: string): Promise<Scene | undefined>;
  createScene(scene: InsertScene): Promise<Scene>;
  updateScene(id: string, scene: Partial<InsertScene>): Promise<Scene | undefined>;
  deleteScene(id: string): Promise<void>;

  getShots(sceneId: string, directorStyle?: string): Promise<Shot[]>;
  getShot(id: string): Promise<Shot | undefined>;
  createShot(shot: InsertShot): Promise<Shot>;
  updateShot(id: string, shot: Partial<InsertShot>): Promise<Shot | undefined>;
  deleteShot(id: string): Promise<void>;

  getCharacters(projectId: string): Promise<Character[]>;
  getCharacter(id: string): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: string, character: Partial<InsertCharacter>): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<void>;

  getPerformanceGuides(sceneId: string, characterId?: string): Promise<PerformanceGuide[]>;
  getPerformanceGuide(id: string): Promise<PerformanceGuide | undefined>;
  createPerformanceGuide(guide: InsertPerformanceGuide): Promise<PerformanceGuide>;
  updatePerformanceGuide(id: string, guide: Partial<InsertPerformanceGuide>): Promise<PerformanceGuide | undefined>;

  getSceneAnalysis(sceneId: string): Promise<SceneAnalysis | undefined>;
  createSceneAnalysis(analysis: InsertSceneAnalysis): Promise<SceneAnalysis>;
  updateSceneAnalysis(id: string, analysis: Partial<InsertSceneAnalysis>): Promise<SceneAnalysis | undefined>;

  getProductionNotes(sceneId: string): Promise<ProductionNotes[]>;
  getProductionNote(id: string): Promise<ProductionNotes | undefined>;
  createProductionNotes(notes: InsertProductionNotes): Promise<ProductionNotes>;
  updateProductionNotes(id: string, notes: Partial<InsertProductionNotes>): Promise<ProductionNotes | undefined>;

  getCallSheets(projectId: string): Promise<CallSheet[]>;
  createCallSheet(callSheet: InsertCallSheet): Promise<CallSheet>;

  getScriptVersions(scriptId: string): Promise<ScriptVersion[]>;
  createScriptVersion(version: InsertScriptVersion): Promise<ScriptVersion>;
  restoreScriptVersion(scriptId: string, versionId: string): Promise<Script | undefined>;

  getShotVersions(shotId: string): Promise<ShotVersion[]>;
  createShotVersion(version: InsertShotVersion): Promise<ShotVersion>;
  restoreShotVersion(shotId: string, versionId: string): Promise<Shot | undefined>;

  getScriptAnalysisGlobal(projectId: string): Promise<ScriptAnalysisGlobal | undefined>;
  createScriptAnalysisGlobal(analysis: InsertScriptAnalysisGlobal): Promise<ScriptAnalysisGlobal>;
  updateScriptAnalysisGlobal(id: string, analysis: Partial<InsertScriptAnalysisGlobal>): Promise<ScriptAnalysisGlobal | undefined>;

  getPerformanceGuideV2(sceneId: string): Promise<PerformanceGuideV2 | undefined>;
  getPerformanceGuidesV2ByProject(projectId: string): Promise<PerformanceGuideV2[]>;
  createPerformanceGuideV2(guide: InsertPerformanceGuideV2): Promise<PerformanceGuideV2>;
  updatePerformanceGuideV2(id: string, guide: Partial<InsertPerformanceGuideV2>): Promise<PerformanceGuideV2 | undefined>;

  getCharacterAssetReferences(characterId: string, assetType?: CharacterAssetType): Promise<CharacterAssetReference[]>;
  createCharacterAssetReference(asset: InsertCharacterAssetReference): Promise<CharacterAssetReference>;
  deleteCharacterAssetReference(id: string): Promise<void>;

  // Character image variants
  getCharacterImageVariants(characterId: string): Promise<CharacterImageVariant[]>;
  getCharacterImageVariantsByBatch(batchId: string): Promise<CharacterImageVariant[]>;
  getCharacterImageVariantsByVersion(characterId: string, version: number): Promise<CharacterImageVariant[]>;
  getLatestVersionNumber(characterId: string): Promise<number>;
  getVersionNumbers(characterId: string): Promise<number[]>;
  createCharacterImageVariant(variant: InsertCharacterImageVariant): Promise<CharacterImageVariant>;
  updateCharacterImageVariant(id: string, updates: Partial<InsertCharacterImageVariant>): Promise<CharacterImageVariant | undefined>;
  deleteCharacterImageVariantsByCharacter(characterId: string): Promise<void>;
  deleteCharacterImageVariantsByVersion(characterId: string, version: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getScripts(projectId: string): Promise<Script[]> {
    return db
      .select()
      .from(scripts)
      .where(eq(scripts.projectId, projectId))
      .orderBy(desc(scripts.version));
  }

  async getScript(id: string): Promise<Script | undefined> {
    const result = await db.select().from(scripts).where(eq(scripts.id, id));
    return result[0];
  }

  async createScript(insertScript: InsertScript): Promise<Script> {
    const existingScripts = await this.getScripts(insertScript.projectId);
    const version = existingScripts.length > 0 ? Math.max(...existingScripts.map((s) => s.version)) + 1 : 1;

    for (const script of existingScripts) {
      if (script.isActive) {
        await db.update(scripts).set({ isActive: false }).where(eq(scripts.id, script.id));
      }
    }

    const result = await db
      .insert(scripts)
      .values({
        ...insertScript,
        version,
        isActive: insertScript.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updateScript(id: string, updates: Partial<InsertScript>): Promise<Script | undefined> {
    const result = await db.update(scripts).set(updates).where(eq(scripts.id, id)).returning();
    return result[0];
  }

  async getScenes(projectId: string): Promise<Scene[]> {
    return db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(asc(scenes.sceneNumber));
  }

  async getScene(id: string): Promise<Scene | undefined> {
    const result = await db.select().from(scenes).where(eq(scenes.id, id));
    return result[0];
  }

  async createScene(insertScene: InsertScene): Promise<Scene> {
    const result = await db.insert(scenes).values(insertScene).returning();
    return result[0];
  }

  async updateScene(id: string, updates: Partial<InsertScene>): Promise<Scene | undefined> {
    const result = await db.update(scenes).set(updates).where(eq(scenes.id, id)).returning();
    return result[0];
  }

  async deleteScene(id: string): Promise<void> {
    await db.delete(scenes).where(eq(scenes.id, id));
  }

  async getShots(sceneId: string, directorStyle?: string): Promise<Shot[]> {
    const conditions = [eq(shots.sceneId, sceneId), eq(shots.isActive, true)];
    if (directorStyle) {
      conditions.push(eq(shots.directorStyle, directorStyle));
    }
    return db
      .select()
      .from(shots)
      .where(and(...conditions))
      .orderBy(asc(shots.shotNumber));
  }

  async getShot(id: string): Promise<Shot | undefined> {
    const result = await db.select().from(shots).where(eq(shots.id, id));
    return result[0];
  }

  async createShot(insertShot: InsertShot): Promise<Shot> {
    const result = await db
      .insert(shots)
      .values({
        ...insertShot,
        version: insertShot.version ?? 1,
        isActive: insertShot.isActive ?? true,
        aspectRatio: insertShot.aspectRatio || "16:9",
      })
      .returning();
    return result[0];
  }

  async updateShot(id: string, updates: Partial<InsertShot>): Promise<Shot | undefined> {
    const result = await db.update(shots).set(updates).where(eq(shots.id, id)).returning();
    return result[0];
  }

  async deleteShot(id: string): Promise<void> {
    await db.delete(shots).where(eq(shots.id, id));
  }

  async getCharacters(projectId: string): Promise<Character[]> {
    return db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId))
      .orderBy(asc(characters.name));
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    const result = await db.select().from(characters).where(eq(characters.id, id));
    return result[0];
  }

  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const result = await db.insert(characters).values(insertCharacter).returning();
    return result[0];
  }

  async updateCharacter(id: string, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    const result = await db.update(characters).set(updates).where(eq(characters.id, id)).returning();
    return result[0];
  }

  async deleteCharacter(id: string): Promise<void> {
    await db.delete(characters).where(eq(characters.id, id));
  }

  async getPerformanceGuides(sceneId: string, characterId?: string): Promise<PerformanceGuide[]> {
    if (characterId) {
      return db
        .select()
        .from(performanceGuides)
        .where(
          and(
            eq(performanceGuides.sceneId, sceneId),
            eq(performanceGuides.isActive, true),
            eq(performanceGuides.characterId, characterId)
          )
        )
        .orderBy(desc(performanceGuides.version));
    }
    return db
      .select()
      .from(performanceGuides)
      .where(and(eq(performanceGuides.sceneId, sceneId), eq(performanceGuides.isActive, true)))
      .orderBy(desc(performanceGuides.version));
  }

  async getPerformanceGuide(id: string): Promise<PerformanceGuide | undefined> {
    const result = await db.select().from(performanceGuides).where(eq(performanceGuides.id, id));
    return result[0];
  }

  async createPerformanceGuide(insertGuide: InsertPerformanceGuide): Promise<PerformanceGuide> {
    const existingGuides = await this.getPerformanceGuides(insertGuide.sceneId, insertGuide.characterId);
    const version = existingGuides.length > 0 ? Math.max(...existingGuides.map((g) => g.version)) + 1 : 1;

    for (const guide of existingGuides) {
      if (guide.isActive) {
        await db.update(performanceGuides).set({ isActive: false }).where(eq(performanceGuides.id, guide.id));
      }
    }

    const result = await db
      .insert(performanceGuides)
      .values({
        ...insertGuide,
        version,
        isActive: insertGuide.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updatePerformanceGuide(id: string, updates: Partial<InsertPerformanceGuide>): Promise<PerformanceGuide | undefined> {
    const result = await db.update(performanceGuides).set(updates).where(eq(performanceGuides.id, id)).returning();
    return result[0];
  }

  async getSceneAnalysis(sceneId: string): Promise<SceneAnalysis | undefined> {
    const result = await db
      .select()
      .from(sceneAnalysis)
      .where(and(eq(sceneAnalysis.sceneId, sceneId), eq(sceneAnalysis.isActive, true)));
    return result[0];
  }

  async createSceneAnalysis(insertAnalysis: InsertSceneAnalysis): Promise<SceneAnalysis> {
    const existing = await this.getSceneAnalysis(insertAnalysis.sceneId);
    if (existing) {
      await db.update(sceneAnalysis).set({ isActive: false }).where(eq(sceneAnalysis.id, existing.id));
    }

    const result = await db
      .insert(sceneAnalysis)
      .values({
        ...insertAnalysis,
        version: existing ? existing.version + 1 : 1,
        isActive: insertAnalysis.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updateSceneAnalysis(id: string, updates: Partial<InsertSceneAnalysis>): Promise<SceneAnalysis | undefined> {
    const result = await db.update(sceneAnalysis).set(updates).where(eq(sceneAnalysis.id, id)).returning();
    return result[0];
  }

  async getProductionNotes(sceneId: string): Promise<ProductionNotes[]> {
    return db
      .select()
      .from(productionNotes)
      .where(and(eq(productionNotes.sceneId, sceneId), eq(productionNotes.isActive, true)));
  }

  async getProductionNote(id: string): Promise<ProductionNotes | undefined> {
    const result = await db.select().from(productionNotes).where(eq(productionNotes.id, id));
    return result[0];
  }

  async createProductionNotes(insertNotes: InsertProductionNotes): Promise<ProductionNotes> {
    const result = await db
      .insert(productionNotes)
      .values({
        ...insertNotes,
        version: insertNotes.version ?? 1,
        isActive: insertNotes.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updateProductionNotes(id: string, updates: Partial<InsertProductionNotes>): Promise<ProductionNotes | undefined> {
    const result = await db.update(productionNotes).set(updates).where(eq(productionNotes.id, id)).returning();
    return result[0];
  }

  async getCallSheets(projectId: string): Promise<CallSheet[]> {
    return db
      .select()
      .from(callSheets)
      .where(eq(callSheets.projectId, projectId))
      .orderBy(desc(callSheets.createdAt));
  }

  async createCallSheet(insertCallSheet: InsertCallSheet): Promise<CallSheet> {
    const result = await db.insert(callSheets).values(insertCallSheet).returning();
    return result[0];
  }

  async getScriptVersions(scriptId: string): Promise<ScriptVersion[]> {
    return db
      .select()
      .from(scriptVersions)
      .where(eq(scriptVersions.scriptId, scriptId))
      .orderBy(desc(scriptVersions.version));
  }

  async createScriptVersion(insertVersion: InsertScriptVersion): Promise<ScriptVersion> {
    const result = await db.insert(scriptVersions).values(insertVersion).returning();
    return result[0];
  }

  async restoreScriptVersion(scriptId: string, versionId: string): Promise<Script | undefined> {
    const versionResult = await db.select().from(scriptVersions).where(eq(scriptVersions.id, versionId));
    const version = versionResult[0];
    if (!version || version.scriptId !== scriptId) return undefined;

    const script = await this.getScript(scriptId);
    if (!script) return undefined;

    const currentVersion = script.version;
    await this.createScriptVersion({
      scriptId,
      projectId: script.projectId,
      content: script.content,
      version: currentVersion,
      changeDescription: `恢复前自动保存 v${currentVersion}`,
    });

    const result = await db
      .update(scripts)
      .set({
        content: version.content,
        version: currentVersion + 1,
      })
      .where(eq(scripts.id, scriptId))
      .returning();
    return result[0];
  }

  async getShotVersions(shotId: string): Promise<ShotVersion[]> {
    return db
      .select()
      .from(shotVersions)
      .where(eq(shotVersions.shotId, shotId))
      .orderBy(desc(shotVersions.version));
  }

  async createShotVersion(insertVersion: InsertShotVersion): Promise<ShotVersion> {
    const result = await db.insert(shotVersions).values(insertVersion).returning();
    return result[0];
  }

  async restoreShotVersion(shotId: string, versionId: string): Promise<Shot | undefined> {
    const versionResult = await db.select().from(shotVersions).where(eq(shotVersions.id, versionId));
    const version = versionResult[0];
    if (!version || version.shotId !== shotId) return undefined;

    const shot = await this.getShot(shotId);
    if (!shot) return undefined;

    const currentVersion = shot.version;
    await this.createShotVersion({
      shotId,
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
      version: currentVersion,
      changeDescription: `恢复前自动保存 v${currentVersion}`,
    });

    const result = await db
      .update(shots)
      .set({
        description: version.description,
        shotType: version.shotType,
        cameraAngle: version.cameraAngle,
        cameraMovement: version.cameraMovement,
        duration: version.duration,
        atmosphere: version.atmosphere,
        notes: version.notes,
        imageUrl: version.imageUrl,
        imageBase64: version.imageBase64,
        version: currentVersion + 1,
      })
      .where(eq(shots.id, shotId))
      .returning();
    return result[0];
  }

  async getScriptAnalysisGlobal(projectId: string): Promise<ScriptAnalysisGlobal | undefined> {
    const result = await db.select().from(scriptAnalysisGlobal)
      .where(eq(scriptAnalysisGlobal.projectId, projectId))
      .orderBy(desc(scriptAnalysisGlobal.version));
    return result[0];
  }

  async createScriptAnalysisGlobal(insertAnalysis: InsertScriptAnalysisGlobal): Promise<ScriptAnalysisGlobal> {
    const result = await db.insert(scriptAnalysisGlobal).values(insertAnalysis).returning();
    return result[0];
  }

  async updateScriptAnalysisGlobal(id: string, updates: Partial<InsertScriptAnalysisGlobal>): Promise<ScriptAnalysisGlobal | undefined> {
    const result = await db.update(scriptAnalysisGlobal)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scriptAnalysisGlobal.id, id))
      .returning();
    return result[0];
  }

  async getPerformanceGuideV2(sceneId: string): Promise<PerformanceGuideV2 | undefined> {
    const result = await db.select().from(performanceGuidesV2)
      .where(eq(performanceGuidesV2.sceneId, sceneId))
      .orderBy(desc(performanceGuidesV2.version));
    return result[0];
  }

  async getPerformanceGuidesV2ByProject(projectId: string): Promise<PerformanceGuideV2[]> {
    return db.select().from(performanceGuidesV2)
      .where(eq(performanceGuidesV2.projectId, projectId))
      .orderBy(desc(performanceGuidesV2.createdAt));
  }

  async createPerformanceGuideV2(insertGuide: InsertPerformanceGuideV2): Promise<PerformanceGuideV2> {
    const result = await db.insert(performanceGuidesV2).values(insertGuide).returning();
    return result[0];
  }

  async updatePerformanceGuideV2(id: string, updates: Partial<InsertPerformanceGuideV2>): Promise<PerformanceGuideV2 | undefined> {
    const result = await db.update(performanceGuidesV2)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(performanceGuidesV2.id, id))
      .returning();
    return result[0];
  }

  async getCharacterAssetReferences(characterId: string, assetType?: CharacterAssetType): Promise<CharacterAssetReference[]> {
    if (assetType) {
      return db.select().from(characterAssetReferences)
        .where(and(
          eq(characterAssetReferences.characterId, characterId),
          eq(characterAssetReferences.assetType, assetType)
        ))
        .orderBy(asc(characterAssetReferences.sortOrder));
    }
    return db.select().from(characterAssetReferences)
      .where(eq(characterAssetReferences.characterId, characterId))
      .orderBy(asc(characterAssetReferences.sortOrder));
  }

  async createCharacterAssetReference(insertAsset: InsertCharacterAssetReference): Promise<CharacterAssetReference> {
    const result = await db.insert(characterAssetReferences).values(insertAsset).returning();
    return result[0];
  }

  async deleteCharacterAssetReference(id: string): Promise<void> {
    await db.delete(characterAssetReferences).where(eq(characterAssetReferences.id, id));
  }

  async getCharacterImageVariants(characterId: string): Promise<CharacterImageVariant[]> {
    return db.select().from(characterImageVariants)
      .where(eq(characterImageVariants.characterId, characterId))
      .orderBy(asc(characterImageVariants.createdAt));
  }

  async getCharacterImageVariantsByBatch(batchId: string): Promise<CharacterImageVariant[]> {
    return db.select().from(characterImageVariants)
      .where(eq(characterImageVariants.generationBatchId, batchId))
      .orderBy(asc(characterImageVariants.createdAt));
  }

  async getCharacterImageVariantsByVersion(characterId: string, version: number): Promise<CharacterImageVariant[]> {
    return db.select().from(characterImageVariants)
      .where(and(
        eq(characterImageVariants.characterId, characterId),
        eq(characterImageVariants.version, version)
      ))
      .orderBy(asc(characterImageVariants.createdAt));
  }

  async getLatestVersionNumber(characterId: string): Promise<number> {
    const result = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${characterImageVariants.version}), 0)` })
      .from(characterImageVariants)
      .where(eq(characterImageVariants.characterId, characterId));
    return result[0]?.maxVersion ?? 0;
  }

  async getVersionNumbers(characterId: string): Promise<number[]> {
    const result = await db.selectDistinct({ version: characterImageVariants.version })
      .from(characterImageVariants)
      .where(eq(characterImageVariants.characterId, characterId))
      .orderBy(desc(characterImageVariants.version));
    return result.map(r => r.version);
  }

  async createCharacterImageVariant(insertVariant: InsertCharacterImageVariant): Promise<CharacterImageVariant> {
    const result = await db.insert(characterImageVariants).values(insertVariant).returning();
    return result[0];
  }

  async updateCharacterImageVariant(id: string, updates: Partial<InsertCharacterImageVariant>): Promise<CharacterImageVariant | undefined> {
    const result = await db.update(characterImageVariants)
      .set(updates)
      .where(eq(characterImageVariants.id, id))
      .returning();
    return result[0];
  }

  async deleteCharacterImageVariantsByCharacter(characterId: string): Promise<void> {
    await db.delete(characterImageVariants).where(eq(characterImageVariants.characterId, characterId));
  }

  async deleteCharacterImageVariantsByVersion(characterId: string, version: number): Promise<void> {
    await db.delete(characterImageVariants).where(
      and(
        eq(characterImageVariants.characterId, characterId),
        eq(characterImageVariants.version, version)
      )
    );
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private scripts: Map<string, Script>;
  private scenes: Map<string, Scene>;
  private shots: Map<string, Shot>;
  private characters: Map<string, Character>;
  private performanceGuides: Map<string, PerformanceGuide>;
  private sceneAnalyses: Map<string, SceneAnalysis>;
  private productionNotes: Map<string, ProductionNotes>;
  private callSheets: Map<string, CallSheet>;
  private scriptVersions: Map<string, ScriptVersion>;
  private shotVersions: Map<string, ShotVersion>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.scripts = new Map();
    this.scenes = new Map();
    this.shots = new Map();
    this.characters = new Map();
    this.performanceGuides = new Map();
    this.sceneAnalyses = new Map();
    this.productionNotes = new Map();
    this.callSheets = new Map();
    this.scriptVersions = new Map();
    this.shotVersions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project: Project = {
      ...insertProject,
      id,
      description: insertProject.description || null,
      targetDuration: insertProject.targetDuration || null,
      targetWordCount: insertProject.targetWordCount || null,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated: Project = { ...project, ...updates, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
    for (const [scriptId, script] of this.scripts) {
      if (script.projectId === id) this.scripts.delete(scriptId);
    }
    for (const [sceneId, scene] of this.scenes) {
      if (scene.projectId === id) {
        this.scenes.delete(sceneId);
        for (const [shotId, shot] of this.shots) {
          if (shot.sceneId === sceneId) this.shots.delete(shotId);
        }
      }
    }
    for (const [charId, char] of this.characters) {
      if (char.projectId === id) this.characters.delete(charId);
    }
  }

  async getScripts(projectId: string): Promise<Script[]> {
    return Array.from(this.scripts.values())
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => b.version - a.version);
  }

  async getScript(id: string): Promise<Script | undefined> {
    return this.scripts.get(id);
  }

  async createScript(insertScript: InsertScript): Promise<Script> {
    const id = randomUUID();
    const existingScripts = await this.getScripts(insertScript.projectId);
    const version = existingScripts.length > 0 ? Math.max(...existingScripts.map((s) => s.version)) + 1 : 1;
    
    for (const script of existingScripts) {
      if (script.isActive) {
        this.scripts.set(script.id, { ...script, isActive: false });
      }
    }

    const script: Script = {
      ...insertScript,
      id,
      version,
      isActive: insertScript.isActive ?? true,
      suggestions: insertScript.suggestions || null,
      createdAt: new Date(),
    };
    this.scripts.set(id, script);
    return script;
  }

  async updateScript(id: string, updates: Partial<InsertScript>): Promise<Script | undefined> {
    const script = this.scripts.get(id);
    if (!script) return undefined;
    const updated: Script = { ...script, ...updates };
    this.scripts.set(id, updated);
    return updated;
  }

  async getScenes(projectId: string): Promise<Scene[]> {
    return Array.from(this.scenes.values())
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
  }

  async getScene(id: string): Promise<Scene | undefined> {
    return this.scenes.get(id);
  }

  async createScene(insertScene: InsertScene): Promise<Scene> {
    const id = randomUUID();
    const scene: Scene = {
      ...insertScene,
      id,
      scriptId: insertScene.scriptId || null,
      location: insertScene.location || null,
      timeOfDay: insertScene.timeOfDay || null,
      description: insertScene.description || null,
      dialogue: insertScene.dialogue || null,
      action: insertScene.action || null,
      duration: insertScene.duration || null,
      isInCallSheet: insertScene.isInCallSheet ?? false,
      createdAt: new Date(),
    };
    this.scenes.set(id, scene);
    return scene;
  }

  async updateScene(id: string, updates: Partial<InsertScene>): Promise<Scene | undefined> {
    const scene = this.scenes.get(id);
    if (!scene) return undefined;
    const updated: Scene = { ...scene, ...updates };
    this.scenes.set(id, updated);
    return updated;
  }

  async deleteScene(id: string): Promise<void> {
    this.scenes.delete(id);
    for (const [shotId, shot] of this.shots) {
      if (shot.sceneId === id) this.shots.delete(shotId);
    }
  }

  async getShots(sceneId: string, directorStyle?: string): Promise<Shot[]> {
    return Array.from(this.shots.values())
      .filter((s) => s.sceneId === sceneId && s.isActive && (!directorStyle || s.directorStyle === directorStyle))
      .sort((a, b) => a.shotNumber - b.shotNumber);
  }

  async getShot(id: string): Promise<Shot | undefined> {
    return this.shots.get(id);
  }

  async createShot(insertShot: InsertShot): Promise<Shot> {
    const id = randomUUID();
    const shot: Shot = {
      ...insertShot,
      id,
      shotType: insertShot.shotType || null,
      cameraAngle: insertShot.cameraAngle || null,
      cameraMovement: insertShot.cameraMovement || null,
      duration: insertShot.duration || null,
      directorStyle: insertShot.directorStyle || null,
      customDirectorStyle: insertShot.customDirectorStyle || null,
      visualStyle: insertShot.visualStyle || null,
      customVisualStyle: insertShot.customVisualStyle || null,
      aspectRatio: insertShot.aspectRatio || "16:9",
      customAspectRatio: insertShot.customAspectRatio || null,
      imageUrl: insertShot.imageUrl || null,
      imageBase64: insertShot.imageBase64 || null,
      atmosphere: insertShot.atmosphere || null,
      notes: insertShot.notes || null,
      version: insertShot.version ?? 1,
      isActive: insertShot.isActive ?? true,
      createdAt: new Date(),
    };
    this.shots.set(id, shot);
    return shot;
  }

  async updateShot(id: string, updates: Partial<InsertShot>): Promise<Shot | undefined> {
    const shot = this.shots.get(id);
    if (!shot) return undefined;
    const updated: Shot = { ...shot, ...updates };
    this.shots.set(id, updated);
    return updated;
  }

  async deleteShot(id: string): Promise<void> {
    this.shots.delete(id);
  }

  async getCharacters(projectId: string): Promise<Character[]> {
    return Array.from(this.characters.values())
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    return this.characters.get(id);
  }

  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const id = randomUUID();
    const character: Character = {
      ...insertCharacter,
      id,
      description: insertCharacter.description || null,
      emotionArc: insertCharacter.emotionArc || null,
      createdAt: new Date(),
    };
    this.characters.set(id, character);
    return character;
  }

  async updateCharacter(id: string, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    const character = this.characters.get(id);
    if (!character) return undefined;
    const updated: Character = { ...character, ...updates };
    this.characters.set(id, updated);
    return updated;
  }

  async deleteCharacter(id: string): Promise<void> {
    this.characters.delete(id);
  }

  async getPerformanceGuides(sceneId: string, characterId?: string): Promise<PerformanceGuide[]> {
    return Array.from(this.performanceGuides.values())
      .filter((g) => g.sceneId === sceneId && g.isActive && (!characterId || g.characterId === characterId))
      .sort((a, b) => b.version - a.version);
  }

  async getPerformanceGuide(id: string): Promise<PerformanceGuide | undefined> {
    return this.performanceGuides.get(id);
  }

  async createPerformanceGuide(insertGuide: InsertPerformanceGuide): Promise<PerformanceGuide> {
    const id = randomUUID();
    const existingGuides = await this.getPerformanceGuides(insertGuide.sceneId, insertGuide.characterId);
    const version = existingGuides.length > 0 ? Math.max(...existingGuides.map((g) => g.version)) + 1 : 1;
    
    for (const guide of existingGuides) {
      if (guide.isActive) {
        this.performanceGuides.set(guide.id, { ...guide, isActive: false });
      }
    }

    const guide: PerformanceGuide = {
      ...insertGuide,
      id,
      version,
      emotionBefore: insertGuide.emotionBefore || null,
      emotionDuring: insertGuide.emotionDuring || null,
      emotionAfter: insertGuide.emotionAfter || null,
      performanceOptions: insertGuide.performanceOptions || null,
      dialogueSuggestions: insertGuide.dialogueSuggestions || null,
      actionSuggestions: insertGuide.actionSuggestions || null,
      directorNotes: insertGuide.directorNotes || null,
      isActive: insertGuide.isActive ?? true,
      createdAt: new Date(),
    };
    this.performanceGuides.set(id, guide);
    return guide;
  }

  async updatePerformanceGuide(id: string, updates: Partial<InsertPerformanceGuide>): Promise<PerformanceGuide | undefined> {
    const guide = this.performanceGuides.get(id);
    if (!guide) return undefined;
    const updated: PerformanceGuide = { ...guide, ...updates };
    this.performanceGuides.set(id, updated);
    return updated;
  }

  async getSceneAnalysis(sceneId: string): Promise<SceneAnalysis | undefined> {
    return Array.from(this.sceneAnalyses.values()).find((a) => a.sceneId === sceneId && a.isActive);
  }

  async createSceneAnalysis(insertAnalysis: InsertSceneAnalysis): Promise<SceneAnalysis> {
    const id = randomUUID();
    const existing = await this.getSceneAnalysis(insertAnalysis.sceneId);
    if (existing) {
      this.sceneAnalyses.set(existing.id, { ...existing, isActive: false });
    }

    const analysis: SceneAnalysis = {
      ...insertAnalysis,
      id,
      version: existing ? existing.version + 1 : 1,
      dramaticPoint: insertAnalysis.dramaticPoint || null,
      openingDesign: insertAnalysis.openingDesign || null,
      climaxPoint: insertAnalysis.climaxPoint || null,
      rhythmNotes: insertAnalysis.rhythmNotes || null,
      transitionIn: insertAnalysis.transitionIn || null,
      transitionOut: insertAnalysis.transitionOut || null,
      isActive: insertAnalysis.isActive ?? true,
      createdAt: new Date(),
    };
    this.sceneAnalyses.set(id, analysis);
    return analysis;
  }

  async updateSceneAnalysis(id: string, updates: Partial<InsertSceneAnalysis>): Promise<SceneAnalysis | undefined> {
    const analysis = this.sceneAnalyses.get(id);
    if (!analysis) return undefined;
    const updated: SceneAnalysis = { ...analysis, ...updates };
    this.sceneAnalyses.set(id, updated);
    return updated;
  }

  async getProductionNotes(sceneId: string): Promise<ProductionNotes[]> {
    return Array.from(this.productionNotes.values())
      .filter((n) => n.sceneId === sceneId && n.isActive);
  }

  async getProductionNote(id: string): Promise<ProductionNotes | undefined> {
    return this.productionNotes.get(id);
  }

  async createProductionNotes(insertNotes: InsertProductionNotes): Promise<ProductionNotes> {
    const id = randomUUID();
    const notes: ProductionNotes = {
      ...insertNotes,
      id,
      version: insertNotes.version ?? 1,
      characterId: insertNotes.characterId || null,
      costumeNotes: insertNotes.costumeNotes || null,
      makeupNotes: insertNotes.makeupNotes || null,
      propsRequired: insertNotes.propsRequired || null,
      continuityNotes: insertNotes.continuityNotes || null,
      isActive: insertNotes.isActive ?? true,
      createdAt: new Date(),
    };
    this.productionNotes.set(id, notes);
    return notes;
  }

  async updateProductionNotes(id: string, updates: Partial<InsertProductionNotes>): Promise<ProductionNotes | undefined> {
    const notes = this.productionNotes.get(id);
    if (!notes) return undefined;
    const updated: ProductionNotes = { ...notes, ...updates };
    this.productionNotes.set(id, updated);
    return updated;
  }

  async getCallSheets(projectId: string): Promise<CallSheet[]> {
    return Array.from(this.callSheets.values())
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createCallSheet(insertCallSheet: InsertCallSheet): Promise<CallSheet> {
    const id = randomUUID();
    const callSheet: CallSheet = {
      ...insertCallSheet,
      id,
      rawText: insertCallSheet.rawText || null,
      sceneNumbers: insertCallSheet.sceneNumbers || null,
      fileMetadata: insertCallSheet.fileMetadata || null,
      createdAt: new Date(),
    };
    this.callSheets.set(id, callSheet);
    return callSheet;
  }

  async getScriptVersions(scriptId: string): Promise<ScriptVersion[]> {
    return Array.from(this.scriptVersions.values())
      .filter((v) => v.scriptId === scriptId)
      .sort((a, b) => b.version - a.version);
  }

  async createScriptVersion(insertVersion: InsertScriptVersion): Promise<ScriptVersion> {
    const id = randomUUID();
    const version: ScriptVersion = {
      ...insertVersion,
      id,
      changeDescription: insertVersion.changeDescription || null,
      changedBy: insertVersion.changedBy || null,
      createdAt: new Date(),
    };
    this.scriptVersions.set(id, version);
    return version;
  }

  async restoreScriptVersion(scriptId: string, versionId: string): Promise<Script | undefined> {
    const version = this.scriptVersions.get(versionId);
    if (!version || version.scriptId !== scriptId) return undefined;
    
    const script = this.scripts.get(scriptId);
    if (!script) return undefined;

    const currentVersion = script.version;
    await this.createScriptVersion({
      scriptId,
      projectId: script.projectId,
      content: script.content,
      version: currentVersion,
      changeDescription: `恢复前自动保存 v${currentVersion}`,
    });

    const updated: Script = {
      ...script,
      content: version.content,
      version: currentVersion + 1,
    };
    this.scripts.set(scriptId, updated);
    return updated;
  }

  async getShotVersions(shotId: string): Promise<ShotVersion[]> {
    return Array.from(this.shotVersions.values())
      .filter((v) => v.shotId === shotId)
      .sort((a, b) => b.version - a.version);
  }

  async createShotVersion(insertVersion: InsertShotVersion): Promise<ShotVersion> {
    const id = randomUUID();
    const version: ShotVersion = {
      ...insertVersion,
      id,
      shotType: insertVersion.shotType || null,
      cameraAngle: insertVersion.cameraAngle || null,
      cameraMovement: insertVersion.cameraMovement || null,
      duration: insertVersion.duration || null,
      atmosphere: insertVersion.atmosphere || null,
      notes: insertVersion.notes || null,
      imageUrl: insertVersion.imageUrl || null,
      imageBase64: insertVersion.imageBase64 || null,
      changeDescription: insertVersion.changeDescription || null,
      changedBy: insertVersion.changedBy || null,
      createdAt: new Date(),
    };
    this.shotVersions.set(id, version);
    return version;
  }

  async restoreShotVersion(shotId: string, versionId: string): Promise<Shot | undefined> {
    const version = this.shotVersions.get(versionId);
    if (!version || version.shotId !== shotId) return undefined;
    
    const shot = this.shots.get(shotId);
    if (!shot) return undefined;

    const currentVersion = shot.version;
    await this.createShotVersion({
      shotId,
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
      version: currentVersion,
      changeDescription: `恢复前自动保存 v${currentVersion}`,
    });

    const updated: Shot = {
      ...shot,
      description: version.description,
      shotType: version.shotType,
      cameraAngle: version.cameraAngle,
      cameraMovement: version.cameraMovement,
      duration: version.duration,
      atmosphere: version.atmosphere,
      notes: version.notes,
      imageUrl: version.imageUrl,
      imageBase64: version.imageBase64,
      version: currentVersion + 1,
    };
    this.shots.set(shotId, updated);
    return updated;
  }

  async getScriptAnalysisGlobal(_projectId: string): Promise<ScriptAnalysisGlobal | undefined> {
    return undefined;
  }

  async createScriptAnalysisGlobal(_analysis: InsertScriptAnalysisGlobal): Promise<ScriptAnalysisGlobal> {
    throw new Error("MemStorage does not support scriptAnalysisGlobal");
  }

  async updateScriptAnalysisGlobal(_id: string, _analysis: Partial<InsertScriptAnalysisGlobal>): Promise<ScriptAnalysisGlobal | undefined> {
    return undefined;
  }

  async getPerformanceGuideV2(_sceneId: string): Promise<PerformanceGuideV2 | undefined> {
    return undefined;
  }

  async getPerformanceGuidesV2ByProject(_projectId: string): Promise<PerformanceGuideV2[]> {
    return [];
  }

  async createPerformanceGuideV2(_guide: InsertPerformanceGuideV2): Promise<PerformanceGuideV2> {
    throw new Error("MemStorage does not support performanceGuidesV2");
  }

  async updatePerformanceGuideV2(_id: string, _guide: Partial<InsertPerformanceGuideV2>): Promise<PerformanceGuideV2 | undefined> {
    return undefined;
  }

  async getCharacterAssetReferences(_characterId: string, _assetType?: CharacterAssetType): Promise<CharacterAssetReference[]> {
    return [];
  }

  async createCharacterAssetReference(_asset: InsertCharacterAssetReference): Promise<CharacterAssetReference> {
    throw new Error("MemStorage does not support characterAssetReferences");
  }

  async deleteCharacterAssetReference(_id: string): Promise<void> {
    // No-op for MemStorage
  }

  async getCharacterImageVariants(_characterId: string): Promise<CharacterImageVariant[]> {
    return [];
  }

  async getCharacterImageVariantsByBatch(_batchId: string): Promise<CharacterImageVariant[]> {
    return [];
  }

  async getCharacterImageVariantsByVersion(_characterId: string, _version: number): Promise<CharacterImageVariant[]> {
    return [];
  }

  async getLatestVersionNumber(_characterId: string): Promise<number> {
    return 0;
  }

  async getVersionNumbers(_characterId: string): Promise<number[]> {
    return [];
  }

  async createCharacterImageVariant(_variant: InsertCharacterImageVariant): Promise<CharacterImageVariant> {
    throw new Error("MemStorage does not support characterImageVariants");
  }

  async updateCharacterImageVariant(_id: string, _updates: Partial<InsertCharacterImageVariant>): Promise<CharacterImageVariant | undefined> {
    return undefined;
  }

  async deleteCharacterImageVariantsByCharacter(_characterId: string): Promise<void> {
    // No-op for MemStorage
  }

  async deleteCharacterImageVariantsByVersion(_characterId: string, _version: number): Promise<void> {
    // No-op for MemStorage
  }
}

export const storage = new DatabaseStorage();
