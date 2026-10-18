import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { systemService } from "../services/system";

const STORAGE_KEY = "facerecall:demo-mode";

interface DemoModeValue {
  enabled: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => void;
  clearDemoData: () => Promise<void>;
}

const DemoModeContext = createContext<DemoModeValue | null>(null);

function readStored(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => readStored());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // sessionStorage can be unavailable in private modes; the session still works.
    }
  }, [enabled]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await systemService.seedDemo();
      setEnabled(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(() => setEnabled(false), []);

  const clearDemoData = useCallback(async () => {
    setBusy(true);
    try {
      await systemService.clearDemo();
      setEnabled(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<DemoModeValue>(
    () => ({ enabled, busy, error, enable, disable, clearDemoData }),
    [enabled, busy, error, enable, disable, clearDemoData],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeValue {
  const context = useContext(DemoModeContext);
  if (!context) throw new Error("useDemoMode must be used inside DemoModeProvider");
  return context;
}
