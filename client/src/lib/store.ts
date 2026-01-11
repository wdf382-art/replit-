import { create } from 'zustand';
import type { Project, Scene, Shot, Character } from '@shared/schema';

interface AppState {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  currentScene: Scene | null;
  setCurrentScene: (scene: Scene | null) => void;
  selectedShots: string[];
  setSelectedShots: (shots: string[]) => void;
  toggleShotSelection: (shotId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  currentScene: null,
  setCurrentScene: (scene) => set({ currentScene: scene }),
  selectedShots: [],
  setSelectedShots: (shots) => set({ selectedShots: shots }),
  toggleShotSelection: (shotId) =>
    set((state) => ({
      selectedShots: state.selectedShots.includes(shotId)
        ? state.selectedShots.filter((id) => id !== shotId)
        : [...state.selectedShots, shotId],
    })),
}));
