import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { capabilitiesFor, detectPlatform } from "@ouve/capture";
import type { AiTask, ProviderConfig, ProviderProtocol } from "@ouve/core";
import {
  PROVIDER_PRESETS,
  credentialRefFor,
  detectProtocolFromKey,
  runQuickSetup,
  validateProviderConfig,
  type QuickSetupResult
} from "@ouve/providers";
import { REPORT_SECTIONS } from "@ouve/reports";
import { OUVE_CREDIT, createId, formatTimestamp } from "@ouve/shared";
import { BrandMark, Icon, TERMS_VERSION, TermsGate } from "@ouve/ui";
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

  const [quickKey, setQuickKey] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quick, setQuick] = useState<QuickSetupResult | { ok: false; message: string; notes: string[] } | null>(null);

  /** Configuração rápida (D-065): reconhece a IA pela chave e configura tudo. */
  const quickSetup = async () => {
    const key = quickKey.trim();
    const protocol = detectProtocolFromKey(key);
    if (!protocol) {
      setQuick({
        ok: false,
        message: "Não reconheci essa chave. Use uma chave da OpenAI, Google Gemini, Claude ou Grok, ou a configuração avançada.",
        notes: []
      });
      return;
    }
    // Pede permissão só para o endereço daquela IA, no próprio clique.
    const origin = originPatternFor({ id: "x", displayName: "x", model: "x", protocol, enabledTasks: [] });
    if (origin && chrome.permissions?.request) {
      const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
      if (!granted) return setQuick({ ok: false, message: "Permissão de acesso ao endereço da IA negada.", notes: [] });
    }
    setQuickBusy(true);
    try {
      const id = `rapido-${Date.now().toString(36)}`;
      const result = await runQuickSetup(key, (input, init) => fetch(input, init), id);
      if (result.ok && result.config) {
        for (const old of await storage.providers())
          if (old.protocol === protocol && old.id.startsWith("rapido-")) await storage.removeProvider(old.id);
        await storage.saveProvider(result.config);
        await storage.secrets().set(credentialRefFor(id), key);
        onSettings({
          ...settings,
          ...(result.canTranscribe ? { transcriptionProviderId: id } : {}),
          ...(result.canAnalyze ? { analysisProviderId: id } : {})
        });
        setQuickKey("");
        await reload();
      }
      setQuick(result);
    } catch (e) {
      setQuick({ ok: false, message: err(e), notes: [] });
    } finally {
      setQuickBusy(false);
    }
  };

  const errors = form ? validateProviderConfig(form) : [];
  const transcribers = list.filter((p) => p.enabledTasks.includes("transcription"));
  const analyzers = list.filter((p) => p.enabledTasks.includes("analysis"));

  return (
    <section className="panel">
      <h2>
        <Icon name="providers" /> Provedores de IA (BYOK)
      </h2>
      <p className="callout warn">
        <Icon name="alert" size={16} /> As chaves ficam no armazenamento local do navegador, sem criptografia do sistema operacional. Para
        maior proteção, use o aplicativo desktop.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (quickKey.trim() && !quickBusy) void quickSetup();
        }}
      >
        <input
          type="password"
          autoComplete="off"
          aria-label="Chave de API"
          placeholder="Cole sua chave de IA (ex.: AQ.… do Gemini, que tem plano gratuito)"
          value={quickKey}
          onChange={(e) => setQuickKey(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="primary" type="submit" disabled={!quickKey.trim() || quickBusy}>
          <Icon name="sparkles" /> {quickBusy ? "Conectando…" : "Conectar"}
        </button>
      </form>
      {quick && (
        <div className={quick.ok ? "callout" : "callout warn"} role="status">
          <Icon name={quick.ok ? "check" : "alert"} size={16} />
          <div>
            <strong>{quick.message}</strong>
            {quick.notes.map((n) => (
              <p key={n} className="muted">
                {n}
              </p>
            ))}
          </div>
        </div>
      )}
      <h3>Configuração avançada</h3>
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
      {!form && (
        <button onClick={() => setForm(fresh("openai"))}>
          <Icon name="plus" /> Adicionar provedor
        </button>
      )}
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

const STATUS: Record<string, string> = {
  idle: "Aguardando",
  preparing: "Preparando",
  capturing: "Capturando",
  paused: "Pausado",
  processing: "Processando",
  completed: "Concluído",
  failed: "Erro",
  cancelled: "Cancelado"
};

export function App({ pending }: { pending?: PendingTab }) {
  const controller = useMemo(() => new ExtensionController(storage), []);
  const s = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [settings, setSettings] = useState<ExtSettings | null>(null);
  const [mic, setMic] = useState(false);
  const platform = detectPlatform({ isElectron: false, userAgent: navigator.userAgent });
  const caps = capabilitiesFor(platform);

  useEffect(() => void storage.settings().then(setSettings), []);
  useEffect(() => {
    // A captura da aba foi iniciada pelo usuário no popup; o id expira em segundos.
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
  const blocked = active;
  const start = (run: () => Promise<void>) => void run().catch((e) => controller.message("error", err(e)));

  if (settings && (settings.termsAcceptedVersion ?? 0) < TERMS_VERSION) {
    return <TermsGate onAccept={() => void saveSettings({ ...settings, termsAcceptedVersion: TERMS_VERSION })} />;
  }

  return (
    <main className="app">
      {active && (
        <div className={`banner ${s.status}`} role="status">
          {s.status === "capturing" && <span className="rec-dot" aria-hidden />}
          {s.status === "capturing" ? "Capturando áudio" : "Captura pausada"} · {formatTimestamp(s.capturedMs)} · {s.sourceLabel}
        </div>
      )}
      <header className="app-head">
        <BrandMark size={40} />
        <div>
          <h1>Ouve</h1>
          <p className="muted">Somente áudio. Nenhuma imagem é capturada. Sem conta, sem servidor do Ouve, sem histórico.</p>
          <p className="muted credit">{OUVE_CREDIT}</p>
        </div>
      </header>

      {settings && !settings.transcriptionProviderId && <ProvidersPanel settings={settings} onSettings={(n) => void saveSettings(n)} />}

      <section className="panel">
        <h2>
          <Icon name="record" /> Iniciar
        </h2>
        {platform === "firefox-extension" ? (
          <p className="callout">
            <Icon name="info" size={16} /> No Firefox não há API para capturar o áudio de abas ou telas; use o microfone ou importe um
            arquivo. Para áudio de abas, use o Chrome.
          </p>
        ) : (
          <p className="callout">
            <Icon name="info" size={16} /> Para capturar uma aba, abra-a e clique no ícone do Ouve na barra do navegador.{" "}
            {caps["source-audio"].note}
          </p>
        )}
        <label className="check">
          <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> Incluir meu microfone na captura
        </label>
        <div className="sources">
          {caps["screen-selection"].supported && caps["source-audio"].supported && (
            <button className="source-card" disabled={blocked} onClick={() => start(() => controller.startLive({ kind: "display" }, mic))}>
              <Icon name="monitor" size={20} />
              <strong>Escolher aba, janela ou tela</strong>
              <small>Seletor do navegador</small>
            </button>
          )}
          <button
            className="source-card"
            disabled={blocked}
            onClick={() => start(() => controller.startLive({ kind: "microphone" }, true))}
          >
            <Icon name="mic" size={20} />
            <strong>Somente microfone</strong>
            <small>Sem fonte compartilhada</small>
          </button>
          <label className={`button source-card ${blocked ? "disabled" : ""}`}>
            <Icon name="upload" size={20} />
            <strong>Importar arquivo</strong>
            <small>Até 300 MB / 2 h</small>
            <input
              type="file"
              hidden
              disabled={blocked}
              accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.mkv,.webm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) start(() => controller.importFile(file));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      {s.mode !== "none" && (
        <section className="panel">
          <div className="row">
            <span className={`pill ${s.status}`}>
              {s.status === "capturing" && <span className="rec-dot" aria-hidden />}
              {s.status === "completed" && <Icon name="check" size={14} />}
              {STATUS[s.status]}
            </span>
            <strong>{s.sourceLabel}</strong>
            <span className="muted">
              {s.stats.done} transcritos · {s.stats.queued + s.stats.running} na fila
              {s.stats.failed ? ` · ${s.stats.failed} com falha` : ""}
            </span>
            <span className="spacer" />
            {s.status === "capturing" && (
              <button onClick={() => controller.pause()}>
                <Icon name="pause" /> Pausar
              </button>
            )}
            {s.status === "paused" && (
              <button onClick={() => controller.resume()}>
                <Icon name="play" /> Retomar
              </button>
            )}
            {active && (
              <button className="danger" onClick={() => void controller.stop()}>
                <Icon name="stop" /> Encerrar
              </button>
            )}
            {s.stats.failed > 0 && !active && (
              <button onClick={() => controller.retryFailed()}>
                <Icon name="refresh" /> Tentar novamente
              </button>
            )}
            <button className="danger" onClick={() => void controller.discard()}>
              <Icon name="trash" /> Descartar
            </button>
          </div>
          {s.activity === "no-audio" && active && (
            <p className="warn">
              <Icon name="alert" size={14} /> Sem áudio detectado.
            </p>
          )}
          {s.messages.map((m) => (
            <p key={m.id} className={m.kind === "info" ? "muted" : "warn"}>
              <Icon name="alert" size={14} /> {m.text}{" "}
              <button className="small" aria-label="Dispensar" onClick={() => controller.dismiss(m.id)}>
                <Icon name="x" size={12} />
              </button>
            </p>
          ))}
          <h3>
            <Icon name="users" size={14} /> Participantes
          </h3>
          {controller.store.speakerList().length === 0 && <p className="muted">O provedor não informou falantes (sem diarização).</p>}
          {controller.store.speakerList().map((sp) => (
            <form
              key={sp.id}
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                controller.store.renameSpeaker(sp.id, String(new FormData(e.currentTarget).get("n") ?? ""));
              }}
            >
              <input name="n" defaultValue={sp.label} aria-label={`Nome de ${sp.label}`} style={{ flex: 1 }} />
              <button type="submit" className="small">
                Renomear
              </button>
            </form>
          ))}
          <h3>
            <Icon name="transcript" size={14} /> Transcrição
          </h3>
          {segments.length === 0 ? (
            <div className="empty-state">
              <Icon name="wave" size={28} />
              Os trechos aparecem aqui conforme o áudio é processado.
            </div>
          ) : (
            <ol className="transcript">
              {segments.map((seg) => (
                <li key={seg.id}>
                  <span className="meta">
                    {formatTimestamp(seg.startMs)} · {controller.store.speakerLabel(seg.speakerId)}
                  </span>
                  {seg.text}
                </li>
              ))}
            </ol>
          )}
          <div className="row">
            <button
              className="primary"
              disabled={segments.length === 0 || s.analysisStatus === "running"}
              onClick={() => start(() => controller.analyze())}
            >
              <Icon name="sparkles" /> {s.analysisStatus === "running" ? "Analisando…" : "Analisar e gerar relatório"}
            </button>
          </div>
        </section>
      )}

      {s.report && (
        <section className="panel">
          <div className="row">
            <h2>
              <Icon name="report" /> Relatório
            </h2>
            <span className="spacer" />
            <button onClick={() => void controller.export("pdf")}>
              <Icon name="download" /> PDF
            </button>
            <button onClick={() => void controller.export("docx")}>
              <Icon name="download" /> DOCX
            </button>
            <button onClick={() => void controller.export("md")}>
              <Icon name="download" /> Markdown
            </button>
          </div>
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
                <h3>
                  {sec.title} <span className="badge">{items.length}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="muted">Nenhum item identificado.</p>
                ) : (
                  <ul className="items">
                    {items.map((it) => (
                      <li key={it.id} className={it.basis}>
                        <div>
                          <strong>{it.title}</strong> {it.basis === "inferred" && <span className="badge warn">inferência da IA</span>}
                          {it.description && <p className="muted">{it.description}</p>}
                        </div>
                        <button
                          className="small danger"
                          aria-label="Remover item"
                          onClick={() =>
                            controller.updateReport((r) => ({
                              ...r,
                              analysis: { ...r.analysis, [sec.key]: items.filter((x) => x.id !== it.id) }
                            }))
                          }
                        >
                          <Icon name="trash" size={14} />
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
        </section>
      )}

      {settings && settings.transcriptionProviderId && <ProvidersPanel settings={settings} onSettings={(n) => void saveSettings(n)} />}

      {settings && (
        <section className="panel">
          <h2>
            <Icon name="settings" /> Configurações
          </h2>
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
