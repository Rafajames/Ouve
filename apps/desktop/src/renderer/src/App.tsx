import { useCallback, useEffect, useMemo, useState } from "react";
import { OUVE_CREDIT } from "@ouve/shared";
import { BrandMark, Icon, TERMS_VERSION, TermsGate, applyTheme, type IconName, type ThemePreference } from "@ouve/ui";
import { hasBridge, isWeb } from "./bridge";
import { AppContext, useAppData, useSession, type Screen } from "./hooks";
import { SessionController } from "./session-controller";
import { HomeScreen } from "./screens/HomeScreen";
import { NewSessionScreen } from "./screens/NewSessionScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { ProvidersScreen } from "./screens/ProvidersScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { HelpScreen } from "./HelpScreen";
import { Onboarding } from "./Onboarding";

interface NavItem {
  screen: Screen;
  label: string;
  icon: IconName;
  /** Telas que também acendem este item. */
  also?: Screen[];
}

const NAV_MAIN: NavItem[] = [
  { screen: "home", label: "Início", icon: "home" },
  { screen: "new", label: "Nova reunião", icon: "record" },
  { screen: "import", label: "Importar arquivo", icon: "upload" },
  { screen: "reports", label: "Relatórios", icon: "library", also: ["report"] }
];
const NAV_SYSTEM: NavItem[] = [
  { screen: "providers", label: "Provedores de IA", icon: "providers" },
  { screen: "settings", label: "Configurações", icon: "settings" },
  { screen: "help", label: "Ajuda", icon: "help" }
];

const THEMES: Array<{ value: ThemePreference; icon: IconName; label: string }> = [
  { value: "light", icon: "sun", label: "Tema claro" },
  { value: "dark", icon: "moon", label: "Tema escuro" },
  { value: "system", icon: "monitor", label: "Seguir o sistema" }
];

function NavButton({ item, screen, onGo, extra }: { item: NavItem; screen: Screen; onGo: (s: Screen) => void; extra?: React.ReactNode }) {
  const active = screen === item.screen || !!item.also?.includes(screen);
  return (
    <button
      className={active ? "nav active" : "nav"}
      onClick={() => onGo(item.screen)}
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      <Icon name={item.icon} size={17} />
      <span className="nav-label">{item.label}</span>
      {extra}
    </button>
  );
}

/** Item “Sessão atual”: só aparece quando há sessão, com indicador de gravação. */
function SessionNav({ screen, onGo }: { screen: Screen; onGo: (s: Screen) => void }) {
  const s = useSession();
  if (s.mode === "none") return null;
  const live = s.mode === "live" && (s.status === "capturing" || s.status === "paused");
  return (
    <NavButton
      item={{ screen: "session", label: "Sessão atual", icon: "transcript" }}
      screen={screen}
      onGo={onGo}
      extra={
        live ? (
          <span className={`nav-badge ${s.status}`} title={s.status === "capturing" ? "Gravando" : "Pausado"} />
        ) : s.status === "processing" ? (
          <span className="spinner nav-spinner" aria-hidden />
        ) : null
      }
    />
  );
}

export default function App() {
  const controller = useMemo(() => new SessionController(), []);
  const data = useAppData();
  const [screen, setScreen] = useState<Screen>("home");
  const [reportId, setReportId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "info" | "error" } | null>(null);

  const notify = useCallback((text: string, kind: "info" | "error" = "info") => setToast({ text, kind }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const openReport = useCallback((id: string | null) => {
    setReportId(id);
    setScreen("report");
  }, []);
  const navigate = useCallback((next: Screen) => {
    if (next === "report") setReportId(null);
    setScreen(next);
  }, []);
  const context = useMemo(
    () => ({ controller, navigate, notify, reportId, openReport }),
    [controller, navigate, notify, reportId, openReport]
  );
  const theme = data.settings?.theme ?? "system";
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    if (data.settings) controller.syncSettings(data.settings);
  }, [controller, data.settings]);

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

  const collapsed = !!data.settings?.sidebarCollapsed;
  const save = (patch: Partial<NonNullable<typeof data.settings>>) =>
    data.settings && void data.saveSettings({ ...data.settings, ...patch });

  return (
    <AppContext.Provider value={context}>
      <div className={collapsed ? "layout collapsed" : "layout"}>
        <aside className="sidebar">
          <div className="brand">
            <BrandMark size={26} />
            <div className="brand-text">
              <strong>Ouve</strong>
              <span>{isWeb() ? "Versão web" : "Reuniões e audiências"}</span>
            </div>
          </div>
          <nav aria-label="Navegação principal">
            <div className="nav-group">
              {NAV_MAIN.slice(0, 3).map((item) => (
                <NavButton key={item.screen} item={item} screen={screen} onGo={navigate} />
              ))}
              <SessionNav screen={screen} onGo={navigate} />
              <NavButton item={NAV_MAIN[3]!} screen={screen} onGo={navigate} />
            </div>
            <div className="nav-group">
              <span className="nav-heading">Sistema</span>
              {NAV_SYSTEM.map((item) => (
                <NavButton key={item.screen} item={item} screen={screen} onGo={navigate} />
              ))}
            </div>
          </nav>
          <div className="sidebar-foot">
            <div className="theme-switch" role="group" aria-label="Tema">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  aria-pressed={theme === t.value}
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => save({ theme: t.value })}
                >
                  <Icon name={t.icon} size={15} />
                </button>
              ))}
            </div>
            <button
              className="nav collapse-toggle"
              onClick={() => save({ sidebarCollapsed: !collapsed })}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <Icon name={collapsed ? "chevron" : "chevronLeft"} size={16} />
              <span className="nav-label">Recolher menu</span>
            </button>
            <span className="credit">{OUVE_CREDIT}</span>
          </div>
        </aside>
        <main className="content">
          {screen === "home" && <HomeScreen data={data} />}
          {screen === "new" && <NewSessionScreen data={data} />}
          {screen === "session" && <SessionScreen />}
          {screen === "reports" && <ReportsScreen />}
          {screen === "report" && <ReportScreen data={data} />}
          {screen === "import" && <ImportScreen data={data} />}
          {screen === "providers" && <ProvidersScreen data={data} />}
          {screen === "settings" && <SettingsScreen data={data} />}
          {screen === "help" && <HelpScreen />}
        </main>
      </div>
      {data.settings && !data.settings.onboardingDone && !window.ouve?.e2e && (
        <Onboarding onNavigate={navigate} onClose={() => save({ onboardingDone: true })} />
      )}
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
          <Icon name={toast.kind === "error" ? "alert" : "check"} size={16} />
          <span>{toast.text}</span>
          <button className="icon-only ghost" aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
