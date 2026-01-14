import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiScaleState {
  scale: number;
  setScale: (scale: number) => void;
  resetScale: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;
const DEFAULT_SCALE = 1;

export const useUiScaleStore = create<UiScaleState>()(
  persist(
    (set) => ({
      scale: DEFAULT_SCALE,
      setScale: (scale: number) => {
        const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        set({ scale: clampedScale });
        document.documentElement.style.setProperty("--ui-scale", String(clampedScale));
      },
      resetScale: () => {
        set({ scale: DEFAULT_SCALE });
        document.documentElement.style.setProperty("--ui-scale", String(DEFAULT_SCALE));
      },
    }),
    {
      name: "ui-scale-storage",
      onRehydrateStorage: () => (state) => {
        if (state?.scale) {
          document.documentElement.style.setProperty("--ui-scale", String(state.scale));
        }
      },
    }
  )
);

export { MIN_SCALE, MAX_SCALE, DEFAULT_SCALE };
