import { useCallback, useEffect, useState } from "react";
import { LOCAL_SERVERS, adviseHardware, localProviderConfig, type LocalServerId } from "@ouve/providers";
import { Icon } from "@ouve/ui";
import type { LocalStatus } from "../../shared/ipc";
import { bridge, unwrap } from "./bridge";
import { errorMessage, useApp, type AppData } from "./hooks";

/**
 * IA no próprio computador: detecta Ollama e servidores Whisper, recomenda
 * modelos pelo hardware e configura com um clique. Nada sai do computador.
 */
export function LocalAiPanel({ data }: { data: AppData }) {
  const { notify } = useApp();
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const local = window.ouve?.local;

  const check = useCallback(async () => {
    if (!local) return;
    setChecking(true);
    try {
      setStatus(await unwrap(local.probe()));
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setChecking(false);
    }
  }, [local, notify]);

  useEffect(() => void check(), [check]);
  if (!local) return null;

  const advice = adviseHardware(status?.hardware ?? {});

  const use = async (serverId: LocalServerId, model: string) => {
    const server = LOCAL_SERVERS.find((s) => s.id === serverId)!;
    try {
      const config = localProviderConfig(serverId, model);
      await unwrap(bridge().providers.save({ config }));
      if (data.settings) {
        const patch = server.task === "analysis" ? { analysisProviderId: config.id } : { transcriptionProviderId: config.id };
        await data.saveSettings({ ...data.settings, ...patch });
      }
      await data.reload();
      notify(
        `${server.name} configurado para ${server.task === "analysis" ? "análise e relatório" : "transcrição"} com ${model || "o modelo carregado"}.`
      );
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const pull = async (model: string) => {
    if (!local.pullModel) return;
    if (!window.confirm(`Baixar o modelo ${model} pelo Ollama? O download pode levar vários minutos e ocupar alguns GB.`)) return;
    setPulling(model);
    try {
      await unwrap(local.pullModel(model));
      notify(`Modelo ${model} baixado.`);
      await check();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setPulling(null);
    }
  };

  return (
    <section className="panel local-ai">
      <div className="row between">
        <h2>
          <Icon name="cpu" /> IA no seu computador (gratuita e privada)
        </h2>
        <button className="small" disabled={checking} onClick={() => void check()}>
          <Icon name="refresh" size={14} /> {checking ? "Verificando…" : "Verificar de novo"}
        </button>
      </div>
      <p className="muted">
        Programas gratuitos que rodam no próprio computador: o áudio e o texto não saem da máquina. A qualidade e a velocidade dependem do
        seu computador.
      </p>
      {status && (
        <p className={advice.level === "modest" ? "callout warn" : "callout"}>
          <Icon name="info" size={15} /> {advice.message}
          {status.hardware.cores ? ` (${status.hardware.cores} núcleos)` : ""}
        </p>
      )}
      <div className="local-grid">
        {LOCAL_SERVERS.map((server) => {
          const st = status?.results.find((r) => r.id === server.id);
          const installed = st?.installedModels ?? [];
          const recommended = server.task === "analysis" ? advice.analysisModel : advice.transcriptionModel;
          const configuredId = server.task === "analysis" ? data.settings?.analysisProviderId : data.settings?.transcriptionProviderId;
          const inUse = configuredId === `local-${server.id}`;
          return (
            <div key={server.id} className="local-card">
              <div className="row between">
                <strong>{server.name}</strong>
                <span className={`badge ${st?.running ? "ok" : ""}`}>{st ? (st.running ? "aberto" : "não encontrado") : "…"}</span>
              </div>
              <p className="small-text muted">
                {server.task === "analysis" ? "Análise e relatório" : "Transcrição"} · licença {server.license}
                {inUse && " · em uso"}
              </p>
              {st?.running ? (
                <>
                  {server.id === "ollama" && installed.length === 0 && <p className="small-text">Nenhum modelo instalado ainda.</p>}
                  {installed.length > 0 && (
                    <ul className="plain-list small-text">
                      {installed.map((m) => (
                        <li key={m.name}>
                          {m.name}
                          {m.sizeGb ? ` · ${m.sizeGb} GB` : ""}{" "}
                          <button className="small link" onClick={() => void use(server.id, m.name)}>
                            Usar este
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {server.id !== "ollama" && installed.length === 0 && (
                    <button className="small primary" onClick={() => void use(server.id, "")}>
                      Usar para transcrição
                    </button>
                  )}
                  {server.id === "ollama" && (
                    <details>
                      <summary className="small-text">Baixar um modelo</summary>
                      <ul className="plain-list small-text">
                        {server.models.map((m) => (
                          <li key={m.name}>
                            <b>{m.name}</b> · ~{m.sizeGb} GB · {m.minRamGb}+ GB de memória{m.name === recommended ? " · recomendado" : ""} —{" "}
                            {m.note}{" "}
                            {local.pullModel ? (
                              <button className="small link" disabled={pulling !== null} onClick={() => void pull(m.name)}>
                                {pulling === m.name ? "baixando…" : "baixar"}
                              </button>
                            ) : (
                              <code>ollama pull {m.name}</code>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <details>
                  <summary className="small-text">Como instalar</summary>
                  <ol className="small-text">
                    {server.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {server.models.length > 0 && (
                    <p className="small-text">
                      Modelos sugeridos:{" "}
                      {server.models.map((m) => `${m.name} (~${m.sizeGb} GB${m.name === recommended ? ", recomendado" : ""})`).join(", ")}.
                    </p>
                  )}
                  <a href={server.installUrl} target="_blank" rel="noreferrer" className="small-text">
                    Página oficial de download
                  </a>
                </details>
              )}
              <ul className="plain-list small-text muted">
                {server.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
