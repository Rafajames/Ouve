import { useState } from "react";
import { formatTimestamp } from "@ouve/shared";
import { LevelMeter, Messages, Page, SpeakersPanel, TranscriptView } from "../components";
import { errorMessage, useApp, useSession } from "../hooks";

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

export function SessionScreen() {
  const { controller, navigate, notify } = useApp();
  const s = useSession();
  const [tab, setTab] = useState<"transcript" | "speakers">("transcript");

  if (s.mode === "none") {
    return (
      <Page title="Sessão atual" subtitle="Nenhuma sessão em andamento.">
        <div className="row">
          <button className="primary" onClick={() => navigate("new")}>
            Nova sessão ao vivo
          </button>
          <button onClick={() => navigate("import")}>Importar arquivo</button>
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
      title={s.title || "Sessão"}
      subtitle={`${live ? "Ao vivo" : "Arquivo importado"} · ${s.sourceLabel}`}
      actions={
        <>
          <button onClick={() => navigator.clipboard.writeText(controller.transcriptText()).then(() => notify("Transcrição copiada."))}>
            Copiar transcrição
          </button>
          <button className="danger" onClick={() => void discard()}>
            Descartar sessão
          </button>
        </>
      }
    >
      <div className={`status-bar ${s.status}`}>
        <span className={`status-pill ${s.status}`}>
          {s.status === "capturing" && <span className="rec-dot" aria-hidden />}
          {STATUS_LABEL[s.status]}
        </span>
        {live && <span className="mono">{formatTimestamp(s.capturedMs)}</span>}
        {live && active && <LevelMeter level={s.status === "capturing" ? s.level : 0} />}
        {live && s.activity === "no-audio" && s.status === "capturing" && <span className="badge warn">sem áudio</span>}
        <span className="muted">
          {s.stats.done} transcritos · {s.stats.skipped} em silêncio · {pending} na fila
          {s.stats.failed > 0 ? ` · ${s.stats.failed} com falha` : ""}
        </span>
        <span className="spacer" />
        {live && s.status === "capturing" && <button onClick={() => controller.pause()}>Pausar</button>}
        {live && s.status === "paused" && <button onClick={() => controller.resume()}>Retomar</button>}
        {live && active && s.microphone && (
          <button onClick={() => controller.setMicrophoneMuted(!s.microphoneMuted)}>
            {s.microphoneMuted ? "Ativar microfone" : "Silenciar microfone"}
          </button>
        )}
        {live && active && (
          <button className="danger" onClick={() => void controller.stopLive()}>
            Encerrar captura
          </button>
        )}
        {!live && s.status === "processing" && (
          <button className="danger" onClick={() => controller.cancelImport()}>
            Cancelar
          </button>
        )}
        {s.stats.failed > 0 && !active && (
          <button onClick={() => notify(`${controller.retryFailed()} trecho(s) reenviado(s).`)}>Tentar novamente</button>
        )}
      </div>

      {s.importInfo && s.status === "processing" && (
        <div className="panel">
          <p>
            {s.importInfo.phase === "extracting"
              ? `Extraindo o áudio… ${formatTimestamp(s.importInfo.processedMs)}${s.importInfo.durationMs ? ` de ${formatTimestamp(s.importInfo.durationMs)}` : ""}`
              : `Transcrevendo ${s.importInfo.segments} segmentos…`}
          </p>
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

      <Messages />

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "transcript"}
          className={tab === "transcript" ? "tab active" : "tab"}
          onClick={() => setTab("transcript")}
        >
          Transcrição
        </button>
        <button
          role="tab"
          aria-selected={tab === "speakers"}
          className={tab === "speakers" ? "tab active" : "tab"}
          onClick={() => setTab("speakers")}
        >
          Participantes ({controller.store.speakerList().length})
        </button>
        <span className="spacer" />
        <button
          className="primary"
          disabled={controller.store.segments().length === 0}
          onClick={() => {
            navigate("report");
            if (s.analysisStatus !== "running" && !s.report)
              void controller.analyze().catch((e: unknown) => notify(errorMessage(e), "error"));
          }}
        >
          {s.report ? "Abrir relatório" : "Analisar e gerar relatório"}
        </button>
      </div>
      <div className="panel scroll">{tab === "transcript" ? <TranscriptView /> : <SpeakersPanel />}</div>
    </Page>
  );
}
