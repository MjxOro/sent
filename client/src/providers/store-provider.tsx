// src/providers/counter-store-provider.tsx
"use client";

import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

import { type ExitStore, createExitStore } from "@/stores/store";

export type ExitStoreApi = ReturnType<typeof createExitStore>;

export const ExitStoreContext = createContext<ExitStoreApi | undefined>(
  undefined,
);

export interface ExitStoreProviderProps {
  children: ReactNode;
}

export const ExitStoreProvider = ({ children }: ExitStoreProviderProps) => {
  const storeRef = useRef<ExitStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createExitStore();
  }

  return (
    <ExitStoreContext.Provider value={storeRef.current}>
      {children}
    </ExitStoreContext.Provider>
  );
};

export const useExitStore = <T,>(selector: (store: ExitStore) => T): T => {
  const exitStoreContext = useContext(ExitStoreContext);

  if (!exitStoreContext) {
    throw new Error(`useCounterStore must be used within ExitStoreProvider`);
  }

  return useStore(exitStoreContext, selector);
};
