import { useEffect, useState } from "react";
import { capabilitiesFor, detectPlatform, type CaptureFeature } from "@ouve/capture";
import type { AppSettings } from "../../../shared/ipc";
import { bridge, capturePlatformEnv, unwrap } from "../bridge";
import { BrandMark, Icon } from "@ouve/ui";
import { REPORT_CONTEXTS } from "@ouve/core";
import { OUVE_COPYRIGHT, OUVE_CREDIT, OUVE_REPOSITORY } from "@ouve/shared";
import type { UpdateInfo } from "../../../shared/ipc";
import { Page, Tabs } from "../components";
import { LANGUAGES } from "../languages";
import { errorMessage, useApp, type AppData } from "../hooks";

const FEATURES: Record<CaptureFeature, string> = {
  "screen-selection": "Seleção de tela",
  "window-selection": "Seleção de janela",
  "tab-selection": "Seleção de aba",
  "source-audio": "Áudio da fonte",
  "system-audio": "Áudio do sistema",
  microphone: "Microfone",
  mix: "Fonte + microfone"
};

/** Atualização manual: só verifica e instala quando o usuário clica (D-070). */
function UpdatesPanel() {
  const updates = bridge().updates;
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState<"check" | "install" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => updates?.onProgress((p) => setProgress(p)), [updates]);
  if (!updates) return null;

  const check = async () => {
    setBusy("check");
    setError(null);
    try {
      setInfo(await unwrap(updates.check()));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const install = async () => {
    if (!window.confirm("O Ouve vai baixar a nova versão, fechar e abrir o instalador. A sessão atual será descartada. Continuar?")) return;
    setBusy("install");
    setError(null);
    try {
      await unwrap(updates.install());
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <div className="settings-group">
      <p className="muted">
        Versão {bridge().version}
        {info ? ` · compilação ${info.currentBuild}` : ""}. O Ouve não se atualiza sozinho: verifique e instale quando quiser.
      </p>
      <div className="row">
        <button onClick={() => void check()} disabled={busy !== null}>
          <Icon name="refresh" /> {busy === "check" ? "Verificando…" : "Verificar atualizações"}
        </button>
        {info?.available && (
          <button className="primary" onClick={() => void install()} disabled={busy !== null}>
            <Icon name="download" /> {busy === "install" ? `Baixando… ${progress ?? 0}%` : "Baixar e instalar"}
          </button>
        )}
      </div>
      {info && (
        <p className={info.available ? "ok-text" : "muted"} role="status">
          {info.message}
          {info.available && info.publishedAt ? ` Publicada em ${new Date(info.publishedAt).toLocaleString("pt-BR")}.` : ""}
        </p>
      )}
      {error && (
        <p className="warn-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Category = "general" | "appearance" | "audio" | "import" | "export" | "privacy" | "updates" | "about";

export function SettingsScreen({ data }: { data: AppData }) {
  const { notify } = useApp();
  const [draft, setDraft] = useState<AppSettings | undefined>(data.settings);
  const [cat, setCat] = useState<Category>("general");
  useEffect(() => setDraft(data.settings), [data.settings]);
  const caps = capabilitiesFor(detectPlatform(capturePlatformEnv()));

  if (!draft) return <Page title="Configurações">Carregando…</Page>;
  const update = (patch: Partial<AppSettings>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  const save = async () => {
    try {
      await data.saveSettings(draft);
      notify("Configurações salvas.");
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  const items = [
    { id: "general" as Category, label: "Geral", icon: "settings" as const },
    { id: "appearance" as Category, label: "Aparência", icon: "palette" as const },
    { id: "audio" as Category, label: "Áudio", icon: "volume" as const },
    { id: "import" as Category, label: "Importação", icon: "upload" as const },
    { id: "export" as Category, label: "Exportação", icon: "download" as const },
    { id: "privacy" as Category, label: "Privacidade", icon: "shield" as const },
    ...(bridge().updates ? [{ id: "updates" as Category, label: "Atualizações", icon: "refresh" as const }] : []),
    { id: "about" as Category, label: "Sobre o Ouve", icon: "info" as const }
  ];

  return (
    <Page
      title="Configurações"
      actions={
        <>
          {dirty && <span className="muted small-text">Alterações não salvas</span>}
          {dirty && (
            <button className="small ghost" onClick={() => setDraft(data.settings)}>
              Desfazer
            </button>
          )}
          <button className="primary small" disabled={!dirty} onClick={() => void save()}>
            Salvar
          </button>
        </>
      }
    >
      <div className="reader">
        <aside className="reader-nav">
          <Tabs items={items} value={cat} onChange={setCat} label="Categorias" vertical idPrefix="cfg" />
        </aside>
        <div className="reader-body settings-body" role="tabpanel" aria-labelledby={`cfg-${cat}`}>
          {cat === "general" && (
            <div className="settings-group">
              <label className="field">
                <span>Idioma falado nas reuniões</span>
                <select aria-label="Idioma principal" value={draft.language} onChange={(e) => update({ language: e.target.value })}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tipo de reunião padrão</span>
                <select
                  value={draft.defaultContext}
                  onChange={(e) => update({ defaultContext: e.target.value as AppSettings["defaultContext"] })}
                >
                  {REPORT_CONTEXTS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label} — {c.hint}
                    </option>
                  ))}
                </select>
                <small className="muted">Muda a organização do relatório. Dá para trocar em cada reunião.</small>
              </label>
              <label className="check">
                <input type="checkbox" checked={draft.liveHints} onChange={(e) => update({ liveHints: e.target.checked })} />
                <span>
                  Mostrar avisos discretos durante a reunião
                  <small className="muted block">
                    Pergunta sem resposta, fala muito longa, possível decisão ou prazo. Calculados no seu computador, no máximo um a cada 90
                    s.
                  </small>
                </span>
              </label>
              <div>
                <button className="small" onClick={() => void data.saveSettings({ ...draft, onboardingDone: false })}>
                  Mostrar a apresentação inicial de novo
                </button>
              </div>
            </div>
          )}

          {cat === "appearance" && (
            <div className="settings-group">
              <fieldset className="theme-cards">
                <legend>Tema</legend>
                {(
                  [
                    ["system", "Seguir o sistema", "monitor"],
                    ["light", "Claro", "sun"],
                    ["dark", "Escuro", "moon"]
                  ] as const
                ).map(([value, label, icon]) => (
                  <label key={value} className={draft.theme === value ? "theme-card selected" : "theme-card"}>
                    <input
                      type="radio"
                      name="theme"
                      value={value}
                      checked={draft.theme === value}
                      onChange={() => update({ theme: value })}
                    />
                    <Icon name={icon} size={18} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label className="check">
                <input type="checkbox" checked={draft.sidebarCollapsed} onChange={(e) => update({ sidebarCollapsed: e.target.checked })} />
                Menu lateral recolhido (só ícones)
              </label>
            </div>
          )}

          {cat === "audio" && (
            <div className="settings-group">
              <label className="field">
                <span>Tamanho dos blocos ao vivo (segundos)</span>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={draft.liveChunkSeconds}
                  onChange={(e) => update({ liveChunkSeconds: Number(e.target.value) })}
                />
                <small className="muted">Blocos menores mostram o texto mais rápido, mas fazem mais pedidos à IA.</small>
              </label>
              <h3 className="group-title">Capacidades de captura nesta plataforma</h3>
              <table className="caps">
                <tbody>
                  {(Object.keys(FEATURES) as CaptureFeature[]).map((f) => (
                    <tr key={f}>
                      <th>{FEATURES[f]}</th>
                      <td>
                        {caps[f].supported ? (
                          <span className="ok-text">
                            <Icon name="check" size={13} /> Sim
                          </span>
                        ) : (
                          <span className="muted">
                            <Icon name="x" size={13} /> Não
                          </span>
                        )}
                      </td>
                      <td className="muted small-text">{caps[f].note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small-text">Declaradas pela documentação das APIs; ainda não validadas em hardware real.</p>
            </div>
          )}

          {cat === "import" && (
            <div className="settings-group">
              <label className="check">
                <input type="checkbox" checked={draft.importAuto} onChange={(e) => update({ importAuto: e.target.checked })} /> Importação
                rápida automática (recomendado)
              </label>
              <label className="field">
                <span>Segmentos de arquivos importados (segundos){draft.importAuto ? " — usado só sem o modo automático" : ""}</span>
                <input
                  type="number"
                  min={30}
                  max={600}
                  disabled={draft.importAuto}
                  value={draft.importSegmentSeconds}
                  onChange={(e) => update({ importSegmentSeconds: Number(e.target.value) })}
                />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span>Tamanho máximo (GB)</span>
                  <input
                    type="number"
                    min={0.1}
                    max={8}
                    step={0.1}
                    value={draft.maxFileGb}
                    onChange={(e) => update({ maxFileGb: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Duração máxima (horas)</span>
                  <input
                    type="number"
                    min={0.25}
                    max={12}
                    step={0.25}
                    value={draft.maxHours}
                    onChange={(e) => update({ maxHours: Number(e.target.value) })}
                  />
                </label>
              </div>
              <p className="muted small-text">
                Valores de referência (2 GB / 4 h) ainda não validados com arquivos reais; custos e limites dos provedores também se
                aplicam.
              </p>
            </div>
          )}

          {cat === "export" && (
            <div className="settings-group">
              <p className="muted">
                O que entra por padrão nos documentos exportados. Dá para ajustar em cada relatório, na aba “Exportar”.
              </p>
              {(
                [
                  ["includeTranscriptInExport", "Transcrição completa"],
                  ["exportTimestamps", "Horários (tempo decorrido)"],
                  ["exportMetrics", "Participação e linha do tempo das falas"],
                  ["exportMarkers", "Marcadores"],
                  ["exportEvidence", "Trechos de evidência"],
                  ["exportNotes", "Observações"]
                ] as Array<[keyof AppSettings, string]>
              ).map(([key, label]) => (
                <label key={key} className="check">
                  <input type="checkbox" checked={Boolean(draft[key])} onChange={(e) => update({ [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          )}

          {cat === "privacy" && (
            <div className="settings-group">
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.keepReportsInSession}
                  onChange={(e) => update({ keepReportsInSession: e.target.checked })}
                />
                <span>
                  Manter os relatórios em “Relatórios” até fechar o Ouve
                  <small className="muted block">
                    Ficam só na memória, nunca em disco. Desligado, o relatório é apagado junto com a sessão — exporte antes de começar
                    outra.
                  </small>
                </span>
              </label>
              <ul className="plain-list">
                <li>Sem conta, sem telemetria e sem servidor próprio.</li>
                <li>Preferências e provedores ficam neste computador; chaves são cifradas pelo sistema operacional quando disponível.</li>
                <li>O áudio nunca é guardado. Transcrições e relatórios só são salvos em arquivo quando você exporta.</li>
                <li>Os provedores de IA podem reter dados conforme os próprios termos. Revise-os antes de enviar conteúdo sigiloso.</li>
                <li>Este aplicativo não substitui avaliação jurídica sobre gravação, consentimento e LGPD.</li>
              </ul>
            </div>
          )}

          {cat === "updates" && <UpdatesPanel />}

          {cat === "about" && (
            <div className="settings-group">
              <div className="about">
                <BrandMark size={40} />
                <div>
                  <strong>Ouve</strong>
                  <p className="muted small-text">Versão {bridge().version}</p>
                </div>
              </div>
              <p>
                <strong>{OUVE_CREDIT}</strong>
              </p>
              <p className="muted">
                {OUVE_COPYRIGHT} Código e histórico de desenvolvimento em{" "}
                <a href={OUVE_REPOSITORY} target="_blank" rel="noreferrer">
                  github.com/Rafajames/Ouve <Icon name="external" size={11} />
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
