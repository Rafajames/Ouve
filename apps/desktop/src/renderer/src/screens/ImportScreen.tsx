import { useState } from "react";
import { GEMINI_FREE_TIER_NOTE } from "@ouve/providers";
import { Icon } from "@ouve/ui";
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from "@ouve/core";
import { Page, Panel, StatusBadge } from "../components";
import { REPORT_CONTEXTS, type ReportContext } from "@ouve/core";
import { formatTimestamp } from "@ouve/shared";
import { isWeb } from "../bridge";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";

export function ImportScreen({ data }: { data: AppData }) {
  const { controller, navigate, notify } = useApp();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState<ReportContext>(data.settings?.defaultContext ?? "general");
  const transcriber = data.providers.find((p) => p.config.id === data.settings?.transcriptionProviderId)?.config;
  const providerName = transcriber?.displayName;
  const capturing = session.mode === "live" && (session.status === "capturing" || session.status === "paused");

  const choose = async () => {
    if (
      controller.hasContent &&
      !window.confirm("Importar um arquivo descarta a sessão atual (transcrição e relatório não exportados). Continuar?")
    )
      return;
    setBusy(true);
    try {
      await controller.discard();
      const promise = controller.startImport(context);
      // Navega assim que o arquivo for aceito; o processamento segue em segundo plano.
      const unsubscribe = controller.subscribe(() => {
        if (controller.getSnapshot().mode === "import") {
          unsubscribe();
          navigate("session");
        }
      });
      const opened = await promise;
      unsubscribe();
      if (!opened) setBusy(false);
    } catch (error) {
      notify(errorMessage(error), "error");
      setBusy(false);
    }
  };

  const info = session.mode === "import" ? session.importInfo : undefined;
  const processing = session.mode === "import" && session.status === "processing";
  const done = session.mode === "import" && session.status === "completed";
  const extractDone = !!info && info.phase !== "extracting";
  const transcribed = session.stats.done + session.stats.failed;
  const limits = isWeb()
    ? "Até 300 MB e 2 h no navegador. Para gravações maiores, use o aplicativo desktop."
    : `Até ${data.settings?.maxFileGb ?? 2} GB e ${data.settings?.maxHours ?? 4} h (ajustável em Configurações).`;

  return (
    <Page title="Importar arquivo" subtitle="Transcreva uma gravação já existente. Em vídeos, só a faixa de áudio é usada.">
      <div className="split">
        <Panel className="import-panel">
          <button className="dropzone" disabled={!providerName || busy || capturing} onClick={() => void choose()}>
            <span className="dropzone-icon">
              <Icon name="upload" size={22} />
            </span>
            <strong>{busy ? "Abrindo…" : "Escolher arquivo"}</strong>
            <span className="muted">Clique para procurar a gravação no {isWeb() ? "computador" : "seu computador"}</span>
          </button>
          {!providerName && (
            <div className="callout warn">
              <Icon name="alert" size={15} />
              <span>Configure uma IA de transcrição antes de importar.</span>
              <button className="small" onClick={() => navigate("providers")}>
                Configurar
              </button>
            </div>
          )}
          {capturing && <p className="warn-text small-text">Encerre a gravação ao vivo antes de importar.</p>}
          <dl className="kv formats">
            <dt>Áudio</dt>
            <dd>
              {AUDIO_EXTENSIONS.map((e) => (
                <span key={e} className="chip static">
                  {e.toUpperCase()}
                </span>
              ))}
            </dd>
            <dt>Vídeo</dt>
            <dd>
              {VIDEO_EXTENSIONS.map((e) => (
                <span key={e} className="chip static">
                  {e.toUpperCase()}
                </span>
              ))}
            </dd>
            <dt>Limite</dt>
            <dd>{limits}</dd>
          </dl>
          <p className="footnote">
            <Icon name="shield" size={13} /> O arquivo não é reproduzido nem enviado inteiro: o áudio é extraído no seu computador e enviado
            em pedaços só para a IA configurada. Uma gravação de 1 hora costuma ficar pronta em poucos minutos.
          </p>
        </Panel>

        <Panel title={info ? info.name : "Resumo"} icon={info ? "transcript" : "check"} className="start-panel">
          {!info && (
            <label className="field">
              <span>Tipo de reunião</span>
              <select value={context} onChange={(e) => setContext(e.target.value as ReportContext)} aria-label="Tipo de reunião">
                {REPORT_CONTEXTS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} — {c.hint}
                  </option>
                ))}
              </select>
            </label>
          )}
          <dl className="kv">
            <dt>IA de transcrição</dt>
            <dd>
              {providerName ? (
                <StatusBadge tone="ok" icon="check">
                  {providerName}
                </StatusBadge>
              ) : (
                <StatusBadge tone="warn" icon="alert">
                  Não configurada
                </StatusBadge>
              )}
            </dd>
            {info?.durationMs ? (
              <>
                <dt>Duração</dt>
                <dd>{formatTimestamp(info.durationMs)}</dd>
              </>
            ) : null}
          </dl>
          <ol className="progress-steps" aria-label="Etapas do processamento">
            <li className={extractDone ? "done" : info ? "running" : ""}>
              <span className="step-dot">{extractDone ? <Icon name="check" size={12} /> : info ? <span className="spinner" /> : 1}</span>
              <span>
                Extrair o áudio
                {info?.phase === "extracting" && (
                  <small>
                    {formatTimestamp(info.processedMs)}
                    {info.durationMs ? ` de ${formatTimestamp(info.durationMs)}` : ""}
                  </small>
                )}
              </span>
            </li>
            <li className={done ? "done" : info?.phase === "transcribing" ? "running" : ""}>
              <span className="step-dot">
                {done ? <Icon name="check" size={12} /> : info?.phase === "transcribing" ? <span className="spinner" /> : 2}
              </span>
              <span>
                Transcrever
                {info?.phase === "transcribing" && info.segments > 0 && (
                  <small>
                    {transcribed} de {info.segments} pedaços
                  </small>
                )}
              </span>
            </li>
            <li className={session.report ? "done" : ""}>
              <span className="step-dot">{session.report ? <Icon name="check" size={12} /> : 3}</span>
              <span>
                Gerar o relatório <small>opcional, quando você quiser</small>
              </span>
            </li>
          </ol>
          {transcriber?.protocol === "gemini" && !info && <p className="muted small-text">{GEMINI_FREE_TIER_NOTE}</p>}
          <div className="start-foot">
            {(processing || done) && (
              <button className={done ? "primary" : ""} onClick={() => navigate("session")}>
                {done ? "Ver transcrição" : "Acompanhar"} <Icon name="arrowRight" size={14} />
              </button>
            )}
            {processing && (
              <button className="ghost" onClick={() => controller.cancelImport()}>
                Cancelar
              </button>
            )}
          </div>
        </Panel>
      </div>
    </Page>
  );
}
