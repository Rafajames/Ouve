import { useState } from "react";
import type { AiTask, ConnectionTestResult, ProviderConfig, ProviderProtocol } from "@ouve/core";
import { PROVIDER_PRESETS, validateProviderConfig } from "@ouve/providers";
import { createId } from "@ouve/shared";
import { LocalAiPanel } from "../LocalAiPanel";
import { Icon } from "@ouve/ui";
import type { ProviderSummary } from "../../../shared/ipc";
import { bridge, unwrap } from "../bridge";
import { Page } from "../components";
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
  const preset = PROVIDER_PRESETS[config.protocol];
  const errors = validateProviderConfig(config);
  const update = (patch: Partial<ProviderConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
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
      notify("Provedor salvo.");
      onDone(true);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel form">
      <h2>{isNew ? "Novo provedor" : `Configurar ${initial.displayName}`}</h2>
      <div className="grid-2">
        <label className="field">
          <span>Tipo</span>
          <select
            aria-label="Tipo"
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
        <label className="field">
          <span>Endpoint (URL base){preset.requiresBaseUrl ? " *" : ""}</span>
          <input
            value={config.baseUrl ?? ""}
            placeholder={preset.defaultBaseUrl || "https://…/v1"}
            onChange={(e) => update({ baseUrl: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Chave de API {hasKey && <em>(já configurada — deixe em branco para manter)</em>}</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? "••••••••" : "Cole sua chave"}
          />
        </label>
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
      </div>
      <fieldset className="tasks">
        <legend>Serviços habilitados</legend>
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
      <ul className="notes">
        {[...(preset.transcription?.notes ?? []), ...(preset.completion.notes ?? [])].map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>{preset.dataPolicyNote}</li>
      </ul>
      {errors.length > 0 && <p className="warn-text">{errors.join(" ")}</p>}
      <div className="row">
        <button className="primary" disabled={errors.length > 0 || saving} onClick={() => void save()}>
          Salvar
        </button>
        <button onClick={() => onDone(false)}>Cancelar</button>
      </div>
    </div>
  );
}

export function ProvidersScreen({ data }: { data: AppData }) {
  const { notify } = useApp();
  const [editing, setEditing] = useState<{ config: ProviderConfig; hasKey: boolean; isNew: boolean } | null>(null);
  const [tests, setTests] = useState<Record<string, ConnectionTestResult | "running">>({});
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
      subtitle="Cole a sua chave na configuração rápida e pronto. A configuração avançada é opcional, para escolher modelos ou usar servidores próprios."
      actions={
        !editing && (
          <button className="primary" onClick={() => setEditing({ config: emptyConfig("openai"), hasKey: false, isNew: true })}>
            <Icon name="plus" /> Adicionar provedor
          </button>
        )
      }
    >
      {data.protection === "memory-only" && (
        <div className="callout warn">
          A criptografia do sistema operacional não está disponível: as chaves ficarão apenas na memória e precisarão ser informadas
          novamente ao reabrir o app.
        </div>
      )}
      {window.ouve?.providers.setKeyPersistence && (data.protection === "session-only" || data.protection === "browser-profile") && (
        <div className={data.protection === "browser-profile" ? "callout warn" : "callout"}>
          <Icon name={data.protection === "browser-profile" ? "alert" : "lock"} size={16} />
          <span>
            {data.protection === "browser-profile"
              ? "As chaves estão guardadas neste navegador, sem criptografia do sistema operacional. Quem usar este computador e navegador pode lê-las."
              : "Por segurança, as chaves ficam só nesta aba e são apagadas ao fechá-la. Você precisará colá-las de novo na próxima vez."}{" "}
            <label className="check inline">
              <input
                type="checkbox"
                checked={data.protection === "browser-profile"}
                onChange={(e) => void window.ouve?.providers.setKeyPersistence?.(e.target.checked).then(() => data.reload())}
              />
              Lembrar neste navegador
            </label>
          </span>
        </div>
      )}
      {!editing && <QuickSetup compact onDone={data.reload} />}
      {!editing && <LocalAiPanel data={data} />}
      <h2 className="section-title">Configuração avançada</h2>
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

      <div className="panel">
        <h2>Uso por serviço</h2>
        <div className="grid-2">
          <label className="field">
            <span>Transcrição</span>
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
      </div>

      {data.providers.length === 0 && !editing && <p className="empty">Nenhum provedor configurado.</p>}
      <div className="provider-list">
        {data.providers.map((p) => {
          const t = tests[p.config.id];
          return (
            <div className="panel provider" key={p.config.id}>
              <div className="row between">
                <div>
                  <strong>{p.config.displayName}</strong>
                  <span className="muted">
                    {" "}
                    · {PROVIDER_PRESETS[p.config.protocol].displayName} · {p.config.model || "sem modelo"}
                  </span>
                </div>
                <div className="row">
                  <button className="small" onClick={() => void test(p)} disabled={t === "running"}>
                    {t === "running" ? "Testando…" : "Testar conexão"}
                  </button>
                  <button className="small" onClick={() => setEditing({ config: p.config, hasKey: p.hasKey, isNew: false })}>
                    Editar
                  </button>
                  <button className="small danger" onClick={() => void remove(p)}>
                    Remover
                  </button>
                </div>
              </div>
              <div className="row tags">
                {p.config.enabledTasks.map((task) => (
                  <span key={task} className="badge">
                    {TASK_LABEL[task]}
                  </span>
                ))}
                <span className={p.hasKey ? "badge ok" : "badge warn"}>{p.hasKey ? "chave salva" : "sem chave"}</span>
              </div>
              {t && t !== "running" && (
                <p className={t.ok ? "ok-text" : "warn-text"} role="status">
                  {t.message} {t.ok ? `(${t.latencyMs} ms${t.models?.length ? `, ${t.models.length} modelos disponíveis` : ""})` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
