// src/stores/counter-store.ts
import { createStore } from "zustand/vanilla";

export type ExitState = {
  exitThree: boolean;
};

export type ExitActions = {
  exit: () => void;
  enter: () => void;
};

export type ExitStore = ExitState & ExitActions;

export const initExitState = (): ExitState => {
  return { exitThree: false };
};

export const defaultInitState: ExitState = {
  exitThree: false,
};

export const createExitStore = (initState: ExitState = defaultInitState) => {
  return createStore<ExitStore>()((set) => ({
    ...initState,
    exit: () => set(() => ({ exitThree: true })),
    enter: () => set(() => ({ exitThree: false })),
  }));
};
