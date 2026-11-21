import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { capabilitiesFor, detectPlatform } from "@ouve/capture";
import type { AiTask, ProviderConfig, ProviderProtocol } from "@ouve/core";
import { PROVIDER_PRESETS, credentialRefFor, validateProviderConfig } from "@ouve/providers";
import { REPORT_SECTIONS } from "@ouve/reports";
import { createId, formatTimestamp } from "@ouve/shared";
import { ExtensionController } from "./controller";
import { ExtensionStorage, originPatternFor, type ExtSettings } from "./storage";

const storage = new ExtensionStorage();
const err = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

export interface PendingTab {
  streamId: string;
  label: string;
  includeMic: boolean;
  at: number;
}

function ProvidersPanel({ settings, onSettings }: { settings: ExtSettings; onSettings: (s: ExtSettings) => void }) {
  const [list, setList] = useState<Array<ProviderConfig & { hasKey: boolean }>>([]);
  const [form, setForm] = useState<ProviderConfig | null>(null);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");

  const reload = useCallback(async () => {
    const providers = await storage.providers();
    setList(await Promise.all(providers.map(async (p) => ({ ...p, hasKey: !!(await storage.secrets().get(credentialRefFor(p.id))) }))));
  }, []);
  useEffect(() => void reload(), [reload]);

  const fresh = (protocol: ProviderProtocol): ProviderConfig => {
    const preset = PROVIDER_PRESETS[protocol];
    return {
      id: createId("prov").replace(/[^A-Za-z0-9_-]/g, ""),
      displayName: preset.displayName,
      protocol,
      model: preset.suggestedModel,
      ...(preset.suggestedTranscriptionModel ? { transcriptionModel: preset.suggestedTranscriptionModel } : {}),
      enabledTasks: preset.tasks.filter((t) => t !== "diarization")
    };
  };

  const save = async () => {
    if (!form) return;
    // Permissão de host é pedida no clique (gesto do usuário) e só para a origem do provedor.
    const origin = originPatternFor(form);
    if (origin && chrome.permissions?.request) {
      const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
      if (!granted) return setStatus("Permissão de acesso ao endereço do provedor negada.");
    }
    await storage.saveProvider(form);
    if (key.trim()) await storage.secrets().set(credentialRefFor(form.id), key.trim());
    setKey("");
    setForm(null);
    setStatus("Provedor salvo.");
    await reload();
  };

  const errors = form ? validateProviderConfig(form) : [];
  const transcribers = list.filter((p) => p.enabledTasks.includes("transcription"));
  const analyzers = list.filter((p) => p.enabledTasks.includes("analysis"));

  return (
    <section className="panel">
      <h2>Provedores de IA (BYOK)</h2>
      <p className="muted">
        As chaves ficam no armazenamento local do navegador, sem criptografia do sistema operacional. Para maior proteção, use o aplicativo
        desktop.
      </p>
      <div className="grid">
        <label>
          Transcrição
          <select
            aria-label="Provedor de transcrição"
            value={settings.transcriptionProviderId ?? ""}
            onChange={(e) => onSettings({ ...settings, transcriptionProviderId: e.target.value || undefined } as ExtSettings)}
          >
            <option value="">— escolha —</option>
            {transcribers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Análise
          <select
            aria-label="Provedor de análise"
            value={settings.analysisProviderId ?? ""}
            onChange={(e) => onSettings({ ...settings, analysisProviderId: e.target.value || undefined } as ExtSettings)}
          >
            <option value="">— escolha —</option>
            {analyzers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="list">
        {list.map((p) => (
          <li key={p.id}>
            <strong>{p.displayName}</strong> · {p.model} · {p.hasKey ? "chave salva" : "sem chave"}{" "}
            <button onClick={() => setForm(p)}>Editar</button>{" "}
            <button
              onClick={async () => {
                await storage.removeProvider(p.id);
                await reload();
              }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      {!form && <button onClick={() => setForm(fresh("openai"))}>Adicionar provedor</button>}
      {form && (
        <div className="form">
          <div className="grid">
            <label>
              Tipo
              <select
                aria-label="Tipo"
                value={form.protocol}
                onChange={(e) => setForm({ ...fresh(e.target.value as ProviderProtocol), id: form.id })}
              >
                {Object.values(PROVIDER_PRESETS).map((p) => (
                  <option key={p.protocol} value={p.protocol}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </label>
            <label>
              Endpoint
              <input
                value={form.baseUrl ?? ""}
                placeholder={PROVIDER_PRESETS[form.protocol].defaultBaseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </label>
            <label>
              Chave de API
              <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
            <label>
              Modelo (análise)
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </label>
            {PROVIDER_PRESETS[form.protocol].transcription && (
              <label>
                Modelo (transcrição)
                <input value={form.transcriptionModel ?? ""} onChange={(e) => setForm({ ...form, transcriptionModel: e.target.value })} />
              </label>
            )}
          </div>
          <div className="row">
            {PROVIDER_PRESETS[form.protocol].tasks
              .filter((t): t is AiTask => t !== "diarization")
              .map((t) => (
                <label key={t} className="check">
                  <input
                    type="checkbox"
                    checked={form.enabledTasks.includes(t)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        enabledTasks: e.target.checked ? [...form.enabledTasks, t] : form.enabledTasks.filter((x) => x !== t)
                      })
                    }
                  />
                  {t === "transcription" ? "Transcrição" : t === "analysis" ? "Análise" : "Relatório"}
                </label>
              ))}
          </div>
          {errors.length > 0 && <p className="warn">{errors.join(" ")}</p>}
          <div className="row">
            <button className="primary" disabled={errors.length > 0} onClick={() => void save()}>
              Salvar
            </button>
            <button onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {status && <p className="muted">{status}</p>}
    </section>
  );
}

export function App({ pending }: { pending?: PendingTab }) {
  const controller = useMemo(() => new ExtensionController(storage), []);
  const s = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [settings, setSettings] = useState<ExtSettings | null>(null);
  const [consent, setConsent] = useState(false);
  const [mic, setMic] = useState(false);
  const platform = detectPlatform({ isElectron: false, userAgent: navigator.userAgent });
  const caps = capabilitiesFor(platform);

  useEffect(() => void storage.settings().then(setSettings), []);
  useEffect(() => {
    // A captura da aba foi autorizada no popup (com consentimento); o id expira em segundos.
    if (pending)
      void controller
        .startLive({ kind: "tab", streamId: pending.streamId, label: pending.label }, pending.includeMic)
        .catch((e) => controller.message("error", err(e)));
  }, [pending, controller]);
  useEffect(() => {
    const active = s.status === "capturing" || s.status === "paused";
    document.title = active ? "● Capturando áudio — Ouve" : "Ouve";
  }, [s.status]);

  const saveSettings = async (next: ExtSettings) => {
    setSettings(next);
    await storage.saveSettings(next);
  };

  const active = s.status === "capturing" || s.status === "paused";
  const segments = controller.store.segments();

  return (
    <main className="app">
      {active && (
        <div className={`banner ${s.status}`} role="status">
          ● {s.status === "capturing" ? "Capturando áudio" : "Captura pausada"} · {formatTimestamp(s.capturedMs)} · {s.sourceLabel}
        </div>
      )}
      <header>
        <h1>Ouve</h1>
        <p className="muted">Somente áudio. Nenhuma imagem é capturada. Sem conta, sem servidor do Ouve, sem histórico.</p>
      </header>

      {settings && <ProvidersPanel settings={settings} onSettings={(n) => void saveSettings(n)} />}

      <section className="panel">
        <h2>Iniciar</h2>
        {platform === "firefox-extension" ? (
          <p className="muted">
            No Firefox não há API para capturar o áudio de abas ou telas; use o microfone ou importe um arquivo. Para áudio de abas, use o
            Chrome.
          </p>
        ) : (
          <p className="muted">
            Para capturar uma aba, abra a aba desejada e use o botão do Ouve na barra do navegador. {caps["source-audio"].note}
          </p>
        )}
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Confirmo que tenho autorização para captar e transcrever este áudio e que ele será enviado ao provedor de IA configurado.
        </label>
        <label className="check">
          <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> Incluir microfone
        </label>
        <div className="row">
          {caps["screen-selection"].supported && caps["source-audio"].supported && (
            <button
              disabled={!consent || active}
              onClick={() => void controller.startLive({ kind: "display" }, mic).catch((e) => controller.message("error", err(e)))}
            >
              Escolher aba, janela ou tela
            </button>
          )}
          <button
            disabled={!consent || active}
            onClick={() => void controller.startLive({ kind: "microphone" }, true).catch((e) => controller.message("error", err(e)))}
          >
            Somente microfone
          </button>
          <label className={`button ${!consent || active ? "disabled" : ""}`}>
            Importar arquivo
            <input
              type="file"
              hidden
              disabled={!consent || active}
              accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.mkv,.webm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void controller.importFile(file).catch((x) => controller.message("error", err(x)));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      {s.mode !== "none" && (
        <section className="panel">
          <div className="row">
            <strong>{s.sourceLabel}</strong>
            <span className="muted">
              {s.status} · {s.stats.done} transcritos · {s.stats.queued + s.stats.running} na fila
              {s.stats.failed ? ` · ${s.stats.failed} com falha` : ""}
            </span>
            {s.status === "capturing" && <button onClick={() => controller.pause()}>Pausar</button>}
            {s.status === "paused" && <button onClick={() => controller.resume()}>Retomar</button>}
            {active && (
              <button className="danger" onClick={() => void controller.stop()}>
                Encerrar
              </button>
            )}
            {s.stats.failed > 0 && !active && <button onClick={() => controller.retryFailed()}>Tentar novamente</button>}
            <button className="danger" onClick={() => void controller.discard()}>
              Descartar
            </button>
          </div>
          {s.activity === "no-audio" && active && <p className="warn">Sem áudio detectado.</p>}
          {s.messages.map((m) => (
            <p key={m.id} className={m.kind === "info" ? "muted" : "warn"}>
              {m.text} <button onClick={() => controller.dismiss(m.id)}>×</button>
            </p>
          ))}
          <h3>Participantes</h3>
          {controller.store.speakerList().length === 0 && <p className="muted">Sem diarização disponível.</p>}
          {controller.store.speakerList().map((sp) => (
            <form
              key={sp.id}
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                controller.store.renameSpeaker(sp.id, String(new FormData(e.currentTarget).get("n") ?? ""));
              }}
            >
              <input name="n" defaultValue={sp.label} aria-label={`Nome de ${sp.label}`} />
              <button type="submit">Renomear</button>
            </form>
          ))}
          <h3>Transcrição</h3>
          <ol className="transcript">
            {segments.map((seg) => (
              <li key={seg.id}>
                <span className="muted">
                  {formatTimestamp(seg.startMs)} {controller.store.speakerLabel(seg.speakerId)}
                </span>{" "}
                {seg.text}
              </li>
            ))}
          </ol>
          <div className="row">
            <button
              className="primary"
              disabled={segments.length === 0 || s.analysisStatus === "running"}
              onClick={() => void controller.analyze().catch((e) => controller.message("error", err(e)))}
            >
              {s.analysisStatus === "running" ? "Analisando…" : "Analisar e gerar relatório"}
            </button>
          </div>
        </section>
      )}

      {s.report && (
        <section className="panel">
          <h2>Relatório</h2>
          <input
            value={s.report.title}
            aria-label="Título"
            onChange={(e) => controller.updateReport((r) => ({ ...r, title: e.target.value }))}
          />
          <textarea
            rows={5}
            aria-label="Resumo"
            value={s.report.analysis.summary}
            onChange={(e) => controller.updateReport((r) => ({ ...r, analysis: { ...r.analysis, summary: e.target.value } }))}
          />
          {REPORT_SECTIONS.map((sec) => {
            const items = s.report!.analysis[sec.key];
            return (
              <div key={sec.key}>
                <h3>{sec.title}</h3>
                {items.length === 0 ? (
                  <p className="muted">Nenhum item identificado.</p>
                ) : (
                  <ul>
                    {items.map((it) => (
                      <li key={it.id}>
                        <strong>{it.title}</strong>
                        {it.basis === "inferred" && <em> (inferência da IA)</em>} {it.description}{" "}
                        <button
                          onClick={() =>
                            controller.updateReport((r) => ({
                              ...r,
                              analysis: { ...r.analysis, [sec.key]: items.filter((x) => x.id !== it.id) }
                            }))
                          }
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <textarea
            rows={3}
            aria-label="Observações"
            placeholder="Observações"
            value={s.report.notes ?? ""}
            onChange={(e) => controller.updateReport((r) => ({ ...r, notes: e.target.value }))}
          />
          <div className="row">
            <button onClick={() => void controller.export("pdf")}>Baixar PDF</button>
            <button onClick={() => void controller.export("docx")}>Baixar DOCX</button>
            <button onClick={() => void controller.export("md")}>Baixar Markdown</button>
          </div>
        </section>
      )}

      {settings && (
        <section className="panel">
          <h2>Configurações</h2>
          <div className="grid">
            <label>
              Idioma
              <select
                aria-label="Idioma"
                value={settings.language}
                onChange={(e) => void saveSettings({ ...settings, language: e.target.value })}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">Inglês</option>
                <option value="es-ES">Espanhol</option>
              </select>
            </label>
            <label>
              Blocos ao vivo (s)
              <input
                type="number"
                min={5}
                max={120}
                value={settings.liveChunkSeconds}
                onChange={(e) => void saveSettings({ ...settings, liveChunkSeconds: Number(e.target.value) })}
              />
            </label>
          </div>
        </section>
      )}
    </main>
  );
}
