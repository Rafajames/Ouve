import { useCallback, useEffect, useMemo, useState } from "react";
import { OUVE_CREDIT, formatTimestamp } from "@ouve/shared";
import { BrandMark, Icon, TERMS_VERSION, TermsGate, applyTheme, type IconName, type ThemePreference } from "@ouve/ui";
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
import { HelpScreen } from "./HelpScreen";
import { Onboarding } from "./Onboarding";

const NAV: Array<{ screen: Screen; label: string; icon: IconName }> = [
  { screen: "home", label: "Início", icon: "home" },
  { screen: "new", label: "Nova sessão", icon: "record" },
  { screen: "import", label: "Importar arquivo", icon: "upload" },
  { screen: "session", label: "Sessão atual", icon: "transcript" },
  { screen: "report", label: "Análise e relatório", icon: "report" },
  { screen: "providers", label: "Provedores de IA", icon: "providers" },
  { screen: "settings", label: "Configurações", icon: "settings" },
  { screen: "help", label: "Ajuda", icon: "help" }
];

const THEMES: Array<{ value: ThemePreference; icon: IconName; label: string }> = [
  { value: "light", icon: "sun", label: "Tema claro" },
  { value: "dark", icon: "moon", label: "Tema escuro" },
  { value: "system", icon: "monitor", label: "Seguir o sistema" }
];

function NavCaptureDot() {
  const s = useSession();
  return s.mode === "live" && (s.status === "capturing" || s.status === "paused") ? (
    <span className="nav-badge" title="Captura em andamento" />
  ) : null;
}

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
  const theme = data.settings?.theme ?? "system";
  useEffect(() => applyTheme(theme), [theme]);

  const [accepting, setAccepting] = useState(false);
  if (hasBridge() && data.settings && (data.settings.termsAcceptedVersion ?? 0) < TERMS_VERSION) {
    const settings = data.settings;
    return (
      <TermsGate
        busy={accepting}
        onAccept={() => {
          setAccepting(true);
          void data.saveSettings({ ...settings, termsAcceptedVersion: TERMS_VERSION }).finally(() => setAccepting(false));
        }}
      />
    );
  }

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
            <BrandMark />
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
                <Icon name={item.icon} />
                {item.label}
                {item.screen === "session" && <NavCaptureDot />}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="theme-switch" role="group" aria-label="Tema">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  aria-pressed={theme === t.value}
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => data.settings && void data.saveSettings({ ...data.settings, theme: t.value })}
                >
                  <Icon name={t.icon} size={16} />
                </button>
              ))}
            </div>
            {window.ouve?.updates && (
              <button className="nav small-link" onClick={() => setScreen("settings")}>
                <Icon name="refresh" size={15} /> Verificar atualizações
              </button>
            )}
            <span>Somente áudio · sem conta · sem histórico</span>
            <span className="credit">{OUVE_CREDIT}</span>
          </div>
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
          {screen === "help" && <HelpScreen />}
        </div>
      </div>
      {data.settings && !data.settings.onboardingDone && !window.ouve?.e2e && (
        <Onboarding
          onNavigate={setScreen}
          onClose={() => data.settings && void data.saveSettings({ ...data.settings, onboardingDone: true })}
        />
      )}
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
          <Icon name={toast.kind === "error" ? "alert" : "check"} />
          {toast.text}
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
