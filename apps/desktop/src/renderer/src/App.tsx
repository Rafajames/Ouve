import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTimestamp } from "@ouve/shared";
import { hasBridge } from "./bridge";
import { AppContext, useAppData, useSession, type Screen } from "./hooks";
import { SessionController } from "./session-controller";
import { HomeScreen } from "./screens/HomeScreen";
import { NewSessionScreen } from "./screens/NewSessionScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { ProvidersScreen } from "./screens/ProvidersScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const NAV: Array<{ screen: Screen; label: string; icon: string }> = [
  { screen: "home", label: "Início", icon: "⌂" },
  { screen: "new", label: "Nova sessão", icon: "●" },
  { screen: "import", label: "Importar arquivo", icon: "⇪" },
  { screen: "session", label: "Sessão atual", icon: "≡" },
  { screen: "report", label: "Análise e relatório", icon: "▤" },
  { screen: "providers", label: "Provedores de IA", icon: "◇" },
  { screen: "settings", label: "Configurações", icon: "⚙" }
];

function CaptureBanner({ onOpen }: { onOpen: () => void }) {
  const s = useSession();
  if (s.mode !== "live" || (s.status !== "capturing" && s.status !== "paused")) return null;
  return (
    <button className={`capture-banner ${s.status}`} onClick={onOpen} aria-live="polite">
      <span className="rec-dot" aria-hidden />
      {s.status === "capturing" ? "Capturando áudio" : "Captura pausada"} · {formatTimestamp(s.capturedMs)} · {s.sourceLabel}
      <span className="banner-link">Abrir sessão</span>
    </button>
  );
}

export default function App() {
  const controller = useMemo(() => new SessionController(), []);
  const data = useAppData();
  const [screen, setScreen] = useState<Screen>("home");
  const [toast, setToast] = useState<{ text: string; kind: "info" | "error" } | null>(null);

  const notify = useCallback((text: string, kind: "info" | "error" = "info") => setToast({ text, kind }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const context = useMemo(() => ({ controller, navigate: setScreen, notify }), [controller, notify]);

  if (!hasBridge()) {
    return (
      <main className="fatal">
        <h1>Ouve</h1>
        <p>Esta interface precisa ser aberta pelo aplicativo desktop do Ouve.</p>
      </main>
    );
  }

  return (
    <AppContext.Provider value={context}>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark" aria-hidden>
              O
            </div>
            <div>
              <strong>Ouve</strong>
              <span>Reuniões e audiências</span>
            </div>
          </div>
          <nav aria-label="Navegação principal">
            {NAV.map((item) => (
              <button
                key={item.screen}
                className={screen === item.screen ? "nav active" : "nav"}
                onClick={() => setScreen(item.screen)}
                aria-current={screen === item.screen ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
          <p className="sidebar-foot">Somente áudio · sem conta · sem histórico</p>
        </aside>
        <div className="content">
          <CaptureBanner onOpen={() => setScreen("session")} />
          {screen === "home" && <HomeScreen data={data} />}
          {screen === "new" && <NewSessionScreen data={data} />}
          {screen === "session" && <SessionScreen />}
          {screen === "report" && <ReportScreen data={data} />}
          {screen === "import" && <ImportScreen data={data} />}
          {screen === "providers" && <ProvidersScreen data={data} />}
          {screen === "settings" && <SettingsScreen data={data} />}
        </div>
      </div>
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
          {toast.text}
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
