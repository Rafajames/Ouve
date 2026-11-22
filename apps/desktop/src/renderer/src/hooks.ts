import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { AppSettings, ProviderSummary, SecretProtection } from "../../shared/ipc";
import { bridge, hasBridge, unwrap } from "./bridge";
import type { SessionController, SessionSnapshot } from "./session-controller";

export type Screen = "home" | "new" | "session" | "report" | "import" | "providers" | "settings" | "help";

export interface AppContextValue {
  controller: SessionController;
  navigate: (screen: Screen) => void;
  notify: (text: string, kind?: "info" | "error") => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext ausente");
  return value;
}

export function useSession(): SessionSnapshot {
  const { controller } = useApp();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}

export interface AppData {
  settings?: AppSettings;
  providers: ProviderSummary[];
  protection?: SecretProtection["protection"];
  reload: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
}

/** Configurações e provedores carregados do processo principal. */
export function useAppData(): AppData {
  const [settings, setSettings] = useState<AppSettings>();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [protection, setProtection] = useState<SecretProtection["protection"]>();

  const reload = useCallback(async () => {
    if (!hasBridge()) return;
    const [s, p, prot] = await Promise.all([
      unwrap(bridge().settings.get()),
      unwrap(bridge().providers.list()),
      unwrap(bridge().providers.protection())
    ]);
    setSettings(s);
    setProviders(p);
    setProtection(prot.protection);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveSettings = useCallback(async (next: AppSettings) => {
    setSettings(await unwrap(bridge().settings.save(next)));
  }, []);

  return { ...(settings ? { settings } : {}), providers, ...(protection ? { protection } : {}), reload, saveSettings };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado.";
}
