import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { useAsync } from "./useAsync";
import { settingsService } from "../services/settings";
import type { AppSettings, SettingsPatch } from "../types/api";

interface SettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  update: (patch: SettingsPatch) => Promise<AppSettings>;
  setLocal: (settings: AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload, setData } = useAsync<AppSettings>(
    (signal) => settingsService.get(signal),
    [],
  );

  useEffect(() => {
    const root = document.documentElement;
    if (!data) return;
    root.style.setProperty("--text-scale", String(data.text_scale));
    root.classList.toggle("reduce-motion", data.reduce_motion);
  }, [data]);

  const update = useCallback(
    async (patch: SettingsPatch) => {
      const next = await settingsService.update(patch);
      setData(next);
      return next;
    },
    [setData],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: data,
      loading,
      error: error ? (error as Error).message : null,
      reload,
      update,
      setLocal: setData,
    }),
    [data, error, loading, reload, update, setData],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
