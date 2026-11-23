import { Icon } from "@ouve/ui";
import { EmptyState, Page, Panel, StatusBadge } from "../components";
import { QuickSetup } from "../QuickSetup";
import { isWeb } from "../bridge";
import { useApp, useSession, type AppData } from "../hooks";
import { contextLabel, formatLength, formatWhen, reportRows } from "../report-rows";

function greeting(hour = new Date().getHours()): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const PROTECTION: Record<string, string> = {
  "os-encrypted": "Cifradas pelo sistema operacional",
  "memory-only": "Só na memória (sem criptografia do sistema)",
  "session-only": "Só nesta aba (apagadas ao fechar)",
  "browser-profile": "Lembradas neste navegador (sem criptografia do sistema)"
};

export function HomeScreen({ data }: { data: AppData }) {
  const { navigate, controller, openReport } = useApp();
  const session = useSession();
  const provider = (id?: string) => data.providers.find((p) => p.config.id === id)?.config;
  const transcription = provider(data.settings?.transcriptionProviderId);
  const analysis = provider(data.settings?.analysisProviderId);
  const ready = !!transcription;
  const recent = reportRows(controller, session).slice(0, 6);
  const live = session.mode === "live" && (session.status === "capturing" || session.status === "paused");

  return (
    <Page title={`${greeting()}!`} subtitle="O Ouve transcreve e organiza conversas usando somente o áudio — nunca grava a tela.">
      <div className="home">
        <div className="home-actions">
          <button className="action-tile primary-tile" onClick={() => navigate("new")}>
            <span className="tile-icon">
              <Icon name="record" size={20} />
            </span>
            <span className="tile-text">
              <strong>Nova reunião</strong>
              <span>Grave e transcreva ao vivo: microfone, tela, janela ou aba.</span>
            </span>
            <Icon name="arrowRight" size={16} className="tile-arrow" />
          </button>
          <button className="action-tile" onClick={() => navigate("import")}>
            <span className="tile-icon">
              <Icon name="upload" size={20} />
            </span>
            <span className="tile-text">
              <strong>Importar arquivo</strong>
              <span>Transcreva uma gravação de áudio ou vídeo já existente.</span>
            </span>
            <Icon name="arrowRight" size={16} className="tile-arrow" />
          </button>
        </div>

        <div className="home-grid">
          <Panel
            title="Relatórios recentes"
            icon="library"
            className="recent-panel"
            actions={
              recent.length > 0 && (
                <button className="small ghost" onClick={() => navigate("reports")}>
                  Ver todos <Icon name="arrowRight" size={13} />
                </button>
              )
            }
            flush
          >
            {recent.length === 0 ? (
              <EmptyState
                icon="report"
                title="Nenhum relatório ainda"
                text="Faça uma reunião ou importe um arquivo. Depois da transcrição, clique em “Analisar e gerar relatório”."
              />
            ) : (
              <ul className="recent-list">
                {recent.map((r) => (
                  <li key={r.id ?? "atual"}>
                    <button className="recent-row" onClick={() => openReport(r.id)}>
                      <Icon name={r.origin === "live" ? "record" : "upload"} size={15} className="muted-icon" />
                      <span className="recent-title">{r.title}</span>
                      <span className="recent-meta">
                        {contextLabel(r.context)} · {formatLength(r.durationMs)} · {formatWhen(r.createdAt)}
                      </span>
                      {r.id === null ? (
                        <StatusBadge tone="accent">Sessão atual</StatusBadge>
                      ) : r.exported.length ? (
                        <StatusBadge tone="ok" icon="check">
                          Exportado
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Não exportado</StatusBadge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="home-side">
            {session.mode !== "none" && (
              <Panel title="Sessão atual" icon="transcript">
                <p className="ellipsis">
                  <strong>{session.title || "Sessão"}</strong>
                </p>
                <p className="muted small-text">
                  {live
                    ? session.status === "capturing"
                      ? "Gravando agora"
                      : "Gravação pausada"
                    : session.status === "processing"
                      ? "Processando o arquivo"
                      : `${session.stats.done} blocos transcritos`}
                  {session.report ? " · relatório gerado" : ""}
                </p>
                <button className="small" onClick={() => navigate("session")}>
                  Abrir sessão <Icon name="arrowRight" size={13} />
                </button>
              </Panel>
            )}
            {ready ? (
              <Panel
                title="Inteligência artificial"
                icon="providers"
                actions={
                  <button className="small ghost" onClick={() => navigate("providers")}>
                    Alterar
                  </button>
                }
              >
                <dl className="kv">
                  <dt>Transcrição</dt>
                  <dd>
                    <StatusBadge tone="ok" icon="check">
                      {transcription.displayName}
                    </StatusBadge>
                  </dd>
                  <dt>Relatório</dt>
                  <dd>
                    {analysis ? (
                      <StatusBadge tone="ok" icon="check">
                        {analysis.displayName}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="warn" icon="alert">
                        Não configurado
                      </StatusBadge>
                    )}
                  </dd>
                  <dt>Chaves</dt>
                  <dd className="small-text">{PROTECTION[data.protection ?? ""] ?? "—"}</dd>
                </dl>
              </Panel>
            ) : (
              <QuickSetup onDone={data.reload} compact />
            )}
            <div className="privacy-note">
              <Icon name="shield" size={15} />
              <span>
                Sem conta e sem servidor do Ouve. O áudio vai só para a IA que você escolheu e nunca é guardado.{" "}
                {isWeb() ? "Na versão web, a captura usa o seletor do navegador." : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
