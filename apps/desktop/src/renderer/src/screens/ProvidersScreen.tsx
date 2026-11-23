import { useState } from "react";
import type { AiTask, ConnectionTestResult, ProviderConfig, ProviderProtocol } from "@ouve/core";
import { PROVIDER_PRESETS, validateProviderConfig } from "@ouve/providers";
import { createId } from "@ouve/shared";
import { LocalAiPanel } from "../LocalAiPanel";
import { Icon } from "@ouve/ui";
import type { ProviderSummary } from "../../../shared/ipc";
import { bridge, unwrap } from "../bridge";
import { Drawer, EmptyState, Page, Panel, StatusBadge, Tabs } from "../components";
import { KEY_PAGES } from "../HelpScreen";
import { QuickSetup } from "../QuickSetup";
import { errorMessage, useApp, type AppData } from "../hooks";

const TASK_LABEL: Record<AiTask, string> = {
  transcription: "Transcrição",
  diarization: "Falantes",
  analysis: "Análise",
  report: "Relatório"
};

function emptyConfig(protocol: ProviderProtocol): ProviderConfig {
  const preset = PROVIDER_PRESETS[protocol];
  return {
    id: createId("prov").replace(/[^A-Za-z0-9_-]/g, ""),
    displayName: preset.displayName,
    protocol,
    model: preset.suggestedModel,
    ...(preset.suggestedTranscriptionModel ? { transcriptionModel: preset.suggestedTranscriptionModel } : {}),
    enabledTasks: preset.tasks.filter((t) => t !== "diarization")
  };
}

/** Externo (nuvem) ou no próprio computador. */
function isLocal(config: ProviderConfig): boolean {
  return config.id.startsWith("local-") || /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/i.test(config.baseUrl ?? "");
}

function ProviderForm({
  initial,
  hasKey,
  isNew,
  onDone
}: {
  initial: ProviderConfig;
  hasKey: boolean;
  isNew: boolean;
  onDone: (saved: boolean) => void;
}) {
  const { notify } = useApp();
  const [config, setConfig] = useState<ProviderConfig>(initial);
  const [apiKey, setApiKey] = useState("");
  const [headers, setHeaders] = useState(
    Object.entries(initial.extraHeaders ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const preset = PROVIDER_PRESETS[config.protocol];
  const errors = validateProviderConfig(config);
  const update = (patch: Partial<ProviderConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const keyPage = KEY_PAGES.find((k) => k.protocol === config.protocol);

  const persist = async () => {
    const extraHeaders = Object.fromEntries(
      headers
        .split("\n")
        .map((l) => l.split(":"))
        .filter((p) => p.length >= 2 && p[0]?.trim())
        .map(([k, ...v]) => [k!.trim(), v.join(":").trim()])
    );
    const next: ProviderConfig = { ...config };
    if (Object.keys(extraHeaders).length) next.extraHeaders = extraHeaders;
    else delete next.extraHeaders;
    if (!next.baseUrl?.trim()) delete next.baseUrl;
    if (!next.transcriptionModel?.trim()) delete next.transcriptionModel;
    await unwrap(bridge().providers.save({ config: next, ...(apiKey ? { apiKey } : {}) }));
    setApiKey("");
  };

  const save = async (andTest: boolean) => {
    setSaving(true);
    setResult(null);
    try {
      await persist();
      if (!andTest) {
        notify("Provedor salvo.");
        onDone(true);
        return;
      }
      try {
        setResult(await unwrap(bridge().providers.test(config.id)));
      } catch (error) {
        setResult({ ok: false, latencyMs: 0, message: errorMessage(error) });
      }
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={isNew ? "Adicionar provedor" : `Configurar ${initial.displayName}`}
      onClose={() => onDone(result !== null)}
      footer={
        <>
          {errors.length > 0 && <p className="warn-text small-text grow">{errors.join(" ")}</p>}
          <span className="spacer" />
          <button onClick={() => onDone(result !== null)}>Cancelar</button>
          <button disabled={errors.length > 0 || saving} onClick={() => void save(true)}>
            {saving ? "Aguarde…" : "Salvar e testar"}
          </button>
          <button className="primary" disabled={errors.length > 0 || saving} onClick={() => void save(false)}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-stack">
        <div className="grid-2">
          <label className="field">
            <span>Provedor</span>
            <select
              aria-label="Provedor"
              value={config.protocol}
              onChange={(e) => {
                const fresh = emptyConfig(e.target.value as ProviderProtocol);
                setConfig({ ...fresh, id: config.id });
              }}
            >
              {Object.values(PROVIDER_PRESETS).map((p) => (
                <option key={p.protocol} value={p.protocol}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nome</span>
            <input value={config.displayName} onChange={(e) => update({ displayName: e.target.value })} maxLength={80} />
          </label>
        </div>

        {keyPage && (
          <div className="callout">
            <Icon name="key" size={15} />
            <div>
              <strong>Como conseguir a chave</strong>
              <p className="small-text">{keyPage.steps}</p>
              <p className="small-text muted">{keyPage.free}</p>
              <a href={keyPage.url} target="_blank" rel="noreferrer" className="small-text">
                Abrir a página oficial <Icon name="external" size={11} />
              </a>
            </div>
          </div>
        )}

        <label className="field">
          <span>Chave de API {hasKey && <em className="muted">(já salva — deixe em branco para manter)</em>}</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? "•••••••• (protegida)" : preset.requiresBaseUrl ? "Opcional para servidores locais" : "Cole sua chave"}
          />
          <small className="muted">A chave nunca é mostrada de novo depois de salva e só é enviada ao próprio provedor.</small>
        </label>

        {preset.requiresBaseUrl && (
          <label className="field">
            <span>Endpoint (URL base) *</span>
            <input
              value={config.baseUrl ?? ""}
              placeholder={preset.defaultBaseUrl || "https://…/v1"}
              onChange={(e) => update({ baseUrl: e.target.value })}
            />
          </label>
        )}

        <details className="advanced" open={preset.requiresBaseUrl || undefined}>
          <summary>Configuração avançada</summary>
          <div className="grid-2">
            <label className="field">
              <span>Modelo para análise/relatório</span>
              <input value={config.model} onChange={(e) => update({ model: e.target.value })} placeholder="ex.: nome-do-modelo" />
            </label>
            {preset.transcription && (
              <label className="field">
                <span>Modelo para transcrição</span>
                <input
                  value={config.transcriptionModel ?? ""}
                  onChange={(e) => update({ transcriptionModel: e.target.value })}
                  placeholder="usa o modelo acima se vazio"
                />
              </label>
            )}
            {!preset.requiresBaseUrl && (
              <label className="field">
                <span>Endpoint (URL base)</span>
                <input
                  value={config.baseUrl ?? ""}
                  placeholder={preset.defaultBaseUrl || "https://…/v1"}
                  onChange={(e) => update({ baseUrl: e.target.value })}
                />
              </label>
            )}
          </div>
          <fieldset className="tasks">
            <legend>Usar este provedor para</legend>
            {preset.tasks
              .filter((t) => t !== "diarization")
              .map((task) => (
                <label key={task} className="check">
                  <input
                    type="checkbox"
                    checked={config.enabledTasks.includes(task)}
                    onChange={(e) =>
                      update({
                        enabledTasks: e.target.checked ? [...config.enabledTasks, task] : config.enabledTasks.filter((t) => t !== task)
                      })
                    }
                  />
                  {TASK_LABEL[task]}
                </label>
              ))}
          </fieldset>
          {(config.protocol === "custom" || config.protocol === "openai-compatible") && (
            <label className="field">
              <span>Cabeçalhos extras (não secretos), um por linha: Nome: valor</span>
              <textarea rows={2} value={headers} onChange={(e) => setHeaders(e.target.value)} />
            </label>
          )}
        </details>

        <ul className="notes">
          {[...(preset.transcription?.notes ?? []), ...(preset.completion.notes ?? [])].map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>{preset.dataPolicyNote}</li>
        </ul>
        {result && (
          <div className={result.ok ? "callout ok" : "callout warn"} role="status">
            <Icon name={result.ok ? "check" : "alert"} size={15} />
            <span>
              {result.message} {result.ok ? `(${result.latencyMs} ms)` : ""}
            </span>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export function ProvidersScreen({ data }: { data: AppData }) {
  const { notify } = useApp();
  const [editing, setEditing] = useState<{ config: ProviderConfig; hasKey: boolean; isNew: boolean } | null>(null);
  const [tests, setTests] = useState<Record<string, ConnectionTestResult | "running">>({});
  const local = !!window.ouve?.local;
  const [tab, setTab] = useState<"configured" | "local">("configured");
  const settings = data.settings;

  const test = async (p: ProviderSummary) => {
    setTests((t) => ({ ...t, [p.config.id]: "running" }));
    try {
      const result = await unwrap(bridge().providers.test(p.config.id));
      setTests((t) => ({ ...t, [p.config.id]: result }));
    } catch (error) {
      setTests((t) => ({ ...t, [p.config.id]: { ok: false, latencyMs: 0, message: errorMessage(error) } }));
    }
  };

  const remove = async (p: ProviderSummary) => {
    if (!window.confirm(`Remover ${p.config.displayName} e apagar a chave salva?`)) return;
    await unwrap(bridge().providers.remove(p.config.id));
    if (settings) {
      const next = { ...settings };
      if (next.transcriptionProviderId === p.config.id) delete next.transcriptionProviderId;
      if (next.analysisProviderId === p.config.id) delete next.analysisProviderId;
      await data.saveSettings(next);
    }
    await data.reload();
  };

  const choose = async (field: "transcriptionProviderId" | "analysisProviderId", id: string) => {
    if (!settings) return;
    const next = { ...settings };
    if (id) next[field] = id;
    else delete next[field];
    await data.saveSettings(next);
    notify("Seleção salva.");
  };

  const transcribers = data.providers.filter((p) => p.config.enabledTasks.includes("transcription"));
  const analyzers = data.providers.filter((p) => p.config.enabledTasks.includes("analysis"));

  return (
    <Page
      title="Provedores de IA"
      subtitle="A IA que transcreve e organiza suas reuniões. Use uma chave de um serviço na nuvem ou uma IA no seu computador."
      actions={
        <button className="primary small" onClick={() => setEditing({ config: emptyConfig("gemini"), hasKey: false, isNew: true })}>
          <Icon name="plus" size={14} /> Adicionar provedor
        </button>
      }
    >
      <div className="providers">
        {data.protection === "memory-only" && (
          <div className="callout warn">
            <Icon name="alert" size={15} />
            <span>
              A criptografia do sistema não está disponível: as chaves ficam só na memória e precisam ser coladas de novo ao reabrir o app.
            </span>
          </div>
        )}
        {window.ouve?.providers.setKeyPersistence && (data.protection === "session-only" || data.protection === "browser-profile") && (
          <div className={data.protection === "browser-profile" ? "callout warn" : "callout"}>
            <Icon name={data.protection === "browser-profile" ? "alert" : "lock"} size={15} />
            <span>
              {data.protection === "browser-profile"
                ? "As chaves estão guardadas neste navegador, sem criptografia do sistema. Quem usar este computador e navegador pode lê-las."
                : "Por segurança, as chaves ficam só nesta aba e são apagadas ao fechá-la."}
            </span>
            <label className="check inline">
              <input
                type="checkbox"
                checked={data.protection === "browser-profile"}
                onChange={(e) => void window.ouve?.providers.setKeyPersistence?.(e.target.checked).then(() => data.reload())}
              />
              Lembrar neste navegador
            </label>
          </div>
        )}

        <div className="providers-top">
          <Panel title="Qual IA usar" icon="sparkles">
            <div className="grid-2">
              <label className="field">
                <span>Transcrição (áudio → texto)</span>
                <select
                  aria-label="Provedor de transcrição"
                  value={settings?.transcriptionProviderId ?? ""}
                  onChange={(e) => void choose("transcriptionProviderId", e.target.value)}
                >
                  <option value="">— escolha —</option>
                  {transcribers.map((p) => (
                    <option key={p.config.id} value={p.config.id}>
                      {p.config.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Análise e relatório</span>
                <select
                  aria-label="Provedor de análise"
                  value={settings?.analysisProviderId ?? ""}
                  onChange={(e) => void choose("analysisProviderId", e.target.value)}
                >
                  <option value="">— escolha —</option>
                  {analyzers.map((p) => (
                    <option key={p.config.id} value={p.config.id}>
                      {p.config.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>
          <QuickSetup compact onDone={data.reload} />
        </div>

        {local && (
          <Tabs
            label="Tipo de provedor"
            idPrefix="prov"
            value={tab}
            onChange={setTab}
            items={[
              { id: "configured", label: "Provedores configurados", icon: "providers", count: data.providers.length },
              { id: "local", label: "IA no seu computador", icon: "cpu" }
            ]}
          />
        )}

        {tab === "local" && local ? (
          <div className="panel-scroll">
            <LocalAiPanel data={data} />
          </div>
        ) : (
          <div className="table-wrap panel flush">
            {data.providers.length === 0 ? (
              <EmptyState
                icon="providers"
                title="Nenhum provedor configurado"
                text="Cole uma chave acima ou adicione um provedor com configuração completa."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Provedor</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th className="col-model">Modelo</th>
                    <th>Usado para</th>
                    <th className="col-actions">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map((p) => {
                    const t = tests[p.config.id];
                    const isLoc = isLocal(p.config);
                    const needsKey = !isLoc && !PROVIDER_PRESETS[p.config.protocol].requiresBaseUrl;
                    return (
                      <tr key={p.config.id} className="provider">
                        <td>
                          <strong className="provider-name">{p.config.displayName}</strong>
                          <div className="muted small-text">{PROVIDER_PRESETS[p.config.protocol].displayName}</div>
                        </td>
                        <td>
                          <span className="type-label">
                            <Icon name={isLoc ? "cpu" : "globe"} size={13} /> {isLoc ? "No computador" : "Na nuvem"}
                          </span>
                        </td>
                        <td role="status">
                          {t === "running" ? (
                            <StatusBadge tone="neutral">Testando…</StatusBadge>
                          ) : t ? (
                            <span title={t.message}>
                              <StatusBadge tone={t.ok ? "ok" : "danger"} icon={t.ok ? "check" : "alert"}>
                                {t.ok ? `Conectado · ${t.latencyMs} ms` : "Erro"}
                              </StatusBadge>
                              <span className={t.ok ? "test-msg ok-text" : "test-msg warn-text"}>{t.message}</span>
                            </span>
                          ) : needsKey && !p.hasKey ? (
                            <StatusBadge tone="warn" icon="alert">
                              Sem chave
                            </StatusBadge>
                          ) : (
                            <StatusBadge tone="ok" icon="check">
                              Configurado
                            </StatusBadge>
                          )}
                        </td>
                        <td className="col-model">
                          <span className="ellipsis mono-small">
                            {p.config.transcriptionModel && p.config.transcriptionModel !== p.config.model
                              ? `${p.config.model} · ${p.config.transcriptionModel}`
                              : p.config.model || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="tags">
                            {p.config.enabledTasks.map((task) => (
                              <span key={task} className="badge neutral">
                                {TASK_LABEL[task]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="col-actions">
                          <div className="row-actions">
                            <button className="small" onClick={() => void test(p)} disabled={t === "running"}>
                              Testar conexão
                            </button>
                            <button
                              className="small icon-only ghost"
                              aria-label={`Configurar ${p.config.displayName}`}
                              title="Configurar"
                              onClick={() => setEditing({ config: p.config, hasKey: p.hasKey, isNew: false })}
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              className="small icon-only ghost danger"
                              aria-label={`Remover ${p.config.displayName}`}
                              title="Remover"
                              onClick={() => void remove(p)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {editing && (
        <ProviderForm
          initial={editing.config}
          hasKey={editing.hasKey}
          isNew={editing.isNew}
          onDone={(saved) => {
            setEditing(null);
            if (saved) void data.reload();
          }}
        />
      )}
    </Page>
  );
}
