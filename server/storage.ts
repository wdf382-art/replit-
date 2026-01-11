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
  PerformanceGuide,
  InsertPerformanceGuide,
  SceneAnalysis,
  InsertSceneAnalysis,
  ProductionNotes,
  InsertProductionNotes,
  CallSheet,
  InsertCallSheet,
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

  getShots(sceneId: string): Promise<Shot[]>;
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

  async getShots(sceneId: string): Promise<Shot[]> {
    return Array.from(this.shots.values())
      .filter((s) => s.sceneId === sceneId && s.isActive)
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
      visualStyle: insertShot.visualStyle || null,
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
}

export const storage = new MemStorage();
