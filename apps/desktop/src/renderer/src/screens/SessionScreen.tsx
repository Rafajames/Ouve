import { useState } from "react";
import { formatTimestamp } from "@ouve/shared";
import { Icon } from "@ouve/ui";
import { LevelMeter, Messages, Page, SpeakersPanel, TranscriptView } from "../components";
import { errorMessage, useApp, useSession } from "../hooks";
import { ContextSelect, HintBanner, MarkerBar, MarkerList, MetricsPanel, StagesPanel } from "../insights";

function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m} min ${sec} s` : `${sec} s`;
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Aguardando",
  preparing: "Preparando",
  capturing: "Capturando",
  paused: "Pausado",
  processing: "Processando",
  completed: "Concluído",
  failed: "Erro",
  cancelled: "Cancelado"
};

function SidePanel() {
  const { controller, navigate, notify } = useApp();
  const s = useSession();
  const segments = controller.store.segments();
  const speakers = controller.store.speakerList();
  const words = segments.reduce((n, seg) => n + seg.text.split(/\s+/).filter(Boolean).length, 0);
  const lastMs = segments.length ? (segments[segments.length - 1]?.endMs ?? 0) : 0;
  const durationMs = s.mode === "live" ? s.capturedMs : (s.importInfo?.durationMs ?? lastMs);
  const transcribed = segments.length > 0;
  const finished = s.status === "completed";

  const analyze = () => {
    navigate("report");
    if (s.analysisStatus !== "running" && !s.report) void controller.analyze().catch((e: unknown) => notify(errorMessage(e), "error"));
  };

  return (
    <aside className="session-side" aria-label="Resumo da sessão">
      <div className="panel">
        <h3 className="side-title">Sessão</h3>
        <div className="stats">
          <div className="stat">
            <b>{formatTimestamp(durationMs)}</b>
            <span>{s.mode === "live" ? "capturado" : "duração"}</span>
          </div>
          <div className="stat">
            <b>{segments.length}</b>
            <span>trechos</span>
          </div>
          <div className="stat">
            <b>{words.toLocaleString("pt-BR")}</b>
            <span>palavras</span>
          </div>
          <div className="stat">
            <b>{speakers.length}</b>
            <span>falantes</span>
          </div>
        </div>
        {s.stats.failed > 0 && (
          <p className="warn-text">
            <Icon name="alert" size={14} /> {s.stats.failed} bloco(s) com falha
          </p>
        )}
      </div>

      {speakers.length > 0 && (
        <div className="panel">
          <h3 className="side-title">Participantes</h3>
          <ul className="mini-speakers">
            {speakers.map((sp) => (
              <li key={sp.id}>
                <span className={`dot tone-${sp.colorToken ?? "cinza"}`} aria-hidden />
                {sp.label}
                <span className="count">{segments.filter((x) => x.speakerId === sp.id).length}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StagesPanel />

      <div className="panel">
        <h3 className="side-title">Próximos passos</h3>
        <ContextSelect id="ctx-session" />
        <ol className="steps">
          <li className={transcribed ? "done" : ""}>
            <span className="step-dot">{transcribed ? <Icon name="check" size={12} /> : 1}</span>
            {s.mode === "live" ? "Capturar e transcrever o áudio" : "Transcrever o arquivo"}
          </li>
          <li className={finished ? "done" : ""}>
            <span className="step-dot">{finished ? <Icon name="check" size={12} /> : 2}</span>
            Revisar trechos e nomes dos falantes
          </li>
          <li className={s.report ? "done" : ""}>
            <span className="step-dot">{s.report ? <Icon name="check" size={12} /> : 3}</span>
            Gerar a análise e o relatório
          </li>
          <li>
            <span className="step-dot">4</span>
            Exportar em PDF ou DOCX
          </li>
        </ol>
        <div className="side-actions">
          <button className="primary" disabled={!transcribed} onClick={analyze}>
            <Icon name="sparkles" /> {s.report ? "Abrir relatório" : "Analisar e gerar relatório"}
          </button>
          <button
            disabled={!transcribed}
            onClick={() => navigator.clipboard.writeText(controller.transcriptText()).then(() => notify("Transcrição copiada."))}
          >
            <Icon name="copy" /> Copiar transcrição
          </button>
        </div>
      </div>

      <p className="muted small-text">
        <Icon name="shield" size={13} /> Áudio e transcrição ficam só na memória e são apagados ao descartar a sessão ou fechar o app.
      </p>
    </aside>
  );
}

export function SessionScreen() {
  const { controller, navigate, notify } = useApp();
  const s = useSession();
  const [tab, setTab] = useState<"transcript" | "speakers" | "markers" | "metrics">("transcript");

  if (s.mode === "none") {
    return (
      <Page title="Sessão atual">
        <div className="panel">
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="wave" size={28} />
            </span>
            <strong>Nenhuma sessão em andamento</strong>
            <span>Inicie uma captura ao vivo ou importe uma gravação para ver a transcrição aqui.</span>
            <div className="row">
              <button className="primary" onClick={() => navigate("new")}>
                <Icon name="record" /> Nova sessão ao vivo
              </button>
              <button onClick={() => navigate("import")}>
                <Icon name="upload" /> Importar arquivo
              </button>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  const live = s.mode === "live";
  const active = s.status === "capturing" || s.status === "paused";
  const pending = s.stats.queued + s.stats.running;

  const discard = async () => {
    if (!window.confirm("Descartar a sessão apaga áudio, transcrição e relatório não exportados. Continuar?")) return;
    await controller.discard();
    navigate("home");
  };

  return (
    <Page
      fit
      title={s.title || "Sessão"}
      subtitle={`${live ? "Ao vivo" : "Arquivo importado"} · ${s.sourceLabel}`}
      actions={
        <button className="danger" onClick={() => void discard()}>
          <Icon name="trash" /> Descartar sessão
        </button>
      }
    >
      <div className="session-grid">
        <div className="session-main">
          <div className={`status-bar ${s.status}`}>
            <span className={`status-pill ${s.status}`}>
              {s.status === "capturing" && <span className="rec-dot" aria-hidden />}
              {s.status === "completed" && <Icon name="check" size={14} />}
              {s.status === "failed" && <Icon name="alert" size={14} />}
              {STATUS_LABEL[s.status]}
            </span>
            {live && (
              <span className="mono">
                <Icon name="clock" size={14} /> {formatTimestamp(s.capturedMs)}
              </span>
            )}
            {live && active && <LevelMeter level={s.status === "capturing" ? s.level : 0} />}
            {live && s.activity === "no-audio" && s.status === "capturing" && <span className="badge warn">sem áudio</span>}
            <span className="muted">
              {s.stats.done} transcritos · {s.stats.skipped} em silêncio · {pending} na fila
            </span>
            <span className="spacer" />
            {live && s.status === "capturing" && (
              <button onClick={() => controller.pause()}>
                <Icon name="pause" /> Pausar
              </button>
            )}
            {live && s.status === "paused" && (
              <button onClick={() => controller.resume()}>
                <Icon name="play" /> Retomar
              </button>
            )}
            {live && active && s.microphone && (
              <button onClick={() => controller.setMicrophoneMuted(!s.microphoneMuted)}>
                <Icon name={s.microphoneMuted ? "mic" : "micOff"} /> {s.microphoneMuted ? "Ativar microfone" : "Silenciar microfone"}
              </button>
            )}
            {live && active && (
              <button className="danger" onClick={() => void controller.stopLive()}>
                <Icon name="stop" /> Encerrar captura
              </button>
            )}
            {!live && s.status === "processing" && (
              <button className="danger" onClick={() => controller.cancelImport()}>
                <Icon name="x" /> Cancelar
              </button>
            )}
            {s.stats.failed > 0 && !active && (
              <button onClick={() => notify(`${controller.retryFailed()} trecho(s) reenviado(s).`)}>
                <Icon name="refresh" /> Tentar novamente
              </button>
            )}
          </div>

          {s.importInfo && s.status === "processing" && (
            <div className="panel">
              <p>
                {s.importInfo.phase === "extracting"
                  ? `Extraindo o áudio… ${formatTimestamp(s.importInfo.processedMs)}${s.importInfo.durationMs ? ` de ${formatTimestamp(s.importInfo.durationMs)}` : ""}`
                  : `Transcrevendo ${s.importInfo.segments} pedaços… (${s.stats.done + s.stats.failed} de ${s.importInfo.segments})`}
              </p>
              {s.importPlanLabel && (
                <p className="muted small-text">
                  <Icon name="sparkles" size={13} /> Modo rápido: {s.importPlanLabel}.
                </p>
              )}
              <progress
                max={1}
                value={
                  s.importInfo.phase === "extracting"
                    ? s.importInfo.durationMs
                      ? s.importInfo.processedMs / s.importInfo.durationMs
                      : undefined
                    : s.importInfo.segments
                      ? (s.stats.done + s.stats.failed) / s.importInfo.segments
                      : undefined
                }
              />
            </div>
          )}

          {!live && s.status === "completed" && s.processingMs !== undefined && (
            <div className="callout">
              <Icon name="check" size={16} />
              <span>
                Transcrição pronta em <strong>{formatDuration(s.processingMs)}</strong>. A análise é opcional: use “Analisar e gerar
                relatório” quando quiser.
              </span>
            </div>
          )}

          <Messages />
          <HintBanner />
          <MarkerBar compact />

          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "transcript"}
              className={tab === "transcript" ? "tab active" : "tab"}
              onClick={() => setTab("transcript")}
            >
              <Icon name="transcript" /> Transcrição
            </button>
            <button
              role="tab"
              aria-selected={tab === "speakers"}
              className={tab === "speakers" ? "tab active" : "tab"}
              onClick={() => setTab("speakers")}
            >
              <Icon name="users" /> Participantes ({controller.store.speakerList().length})
            </button>
            <button
              role="tab"
              aria-selected={tab === "markers"}
              className={tab === "markers" ? "tab active" : "tab"}
              onClick={() => setTab("markers")}
            >
              <Icon name="flag" /> Marcadores ({controller.markers.list().length})
            </button>
            <button
              role="tab"
              aria-selected={tab === "metrics"}
              className={tab === "metrics" ? "tab active" : "tab"}
              onClick={() => setTab("metrics")}
            >
              <Icon name="chart" /> Métricas
            </button>
            {tab === "transcript" && controller.store.segments().length > 0 && (
              <span className="muted small-text">Clique duas vezes em um trecho para corrigir.</span>
            )}
          </div>
          <div className="panel transcript-panel">
            {tab === "transcript" && <TranscriptView />}
            {tab === "speakers" && <SpeakersPanel />}
            {tab === "markers" && <MarkerList onJump={() => setTab("transcript")} />}
            {tab === "metrics" && <MetricsPanel />}
          </div>
        </div>
        <SidePanel />
      </div>
    </Page>
  );
}
