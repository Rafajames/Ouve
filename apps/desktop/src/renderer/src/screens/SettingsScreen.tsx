import { useEffect, useState } from "react";
import { capabilitiesFor, detectPlatform, type CaptureFeature } from "@ouve/capture";
import type { AppSettings } from "../../../shared/ipc";
import { bridge } from "../bridge";
import { Page } from "../components";
import { errorMessage, useApp, type AppData } from "../hooks";

const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "en-US", label: "Inglês" },
  { value: "es-ES", label: "Espanhol" },
  { value: "fr-FR", label: "Francês" },
  { value: "de-DE", label: "Alemão" },
  { value: "it-IT", label: "Italiano" }
];

const FEATURES: Record<CaptureFeature, string> = {
  "screen-selection": "Seleção de tela",
  "window-selection": "Seleção de janela",
  "tab-selection": "Seleção de aba",
  "source-audio": "Áudio da fonte",
  "system-audio": "Áudio do sistema",
  microphone: "Microfone",
  mix: "Fonte + microfone"
};

export function SettingsScreen({ data }: { data: AppData }) {
  const { notify } = useApp();
  const [draft, setDraft] = useState<AppSettings | undefined>(data.settings);
  useEffect(() => setDraft(data.settings), [data.settings]);
  const caps = capabilitiesFor(detectPlatform({ isElectron: true, os: bridge().platform }));

  if (!draft) return <Page title="Configurações">Carregando…</Page>;
  const update = (patch: Partial<AppSettings>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    try {
      await data.saveSettings(draft);
      notify("Configurações salvas.");
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  return (
    <Page
      title="Configurações"
      actions={
        <button className="primary" onClick={() => void save()}>
          Salvar
        </button>
      }
    >
      <div className="panel">
        <h2>Aparência</h2>
        <label className="field">
          <span>Tema</span>
          <select aria-label="Tema" value={draft.theme} onChange={(e) => update({ theme: e.target.value as AppSettings["theme"] })}>
            <option value="system">Seguir o sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </label>
      </div>
      <div className="panel">
        <h2>Transcrição</h2>
        <div className="grid-2">
          <label className="field">
            <span>Idioma principal</span>
            <select aria-label="Idioma principal" value={draft.language} onChange={(e) => update({ language: e.target.value })}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Duração dos blocos ao vivo (segundos)</span>
            <input
              type="number"
              min={5}
              max={120}
              value={draft.liveChunkSeconds}
              onChange={(e) => update({ liveChunkSeconds: Number(e.target.value) })}
            />
          </label>
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
        </div>
        <p className="muted">Blocos menores reduzem a latência da transcrição ao vivo, mas aumentam o número de requisições ao provedor.</p>
      </div>
      <div className="panel">
        <h2>Limites de importação</h2>
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
        <p className="muted">
          Valores de referência (2 GB / 4 h) ainda não validados com arquivos reais; custos e limites dos provedores também se aplicam.
        </p>
      </div>
      <div className="panel">
        <h2>Exportação</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.includeTranscriptInExport}
            onChange={(e) => update({ includeTranscriptInExport: e.target.checked })}
          />{" "}
          Incluir a transcrição completa no PDF/DOCX
        </label>
      </div>
      <div className="panel">
        <h2>Capacidades de captura nesta plataforma</h2>
        <p className="muted">Declaradas pela documentação das APIs; ainda não validadas em hardware real.</p>
        <table className="caps">
          <tbody>
            {(Object.keys(FEATURES) as CaptureFeature[]).map((f) => (
              <tr key={f}>
                <th>{FEATURES[f]}</th>
                <td>{caps[f].supported ? "Sim" : "Não"}</td>
                <td className="muted">{caps[f].note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Privacidade e dados</h2>
        <ul className="plain">
          <li>Sem conta, sem telemetria e sem servidor próprio.</li>
          <li>
            Preferências e configurações de provedores ficam neste computador; chaves são cifradas pelo sistema operacional quando
            disponível.
          </li>
          <li>Áudio, transcrição e relatórios não são salvos automaticamente; somente exportações feitas por você.</li>
          <li>Os provedores de IA podem reter dados conforme seus próprios termos. Revise-os antes de enviar conteúdo sigiloso.</li>
          <li>Este aplicativo não substitui avaliação jurídica sobre gravação, consentimento e LGPD.</li>
        </ul>
      </div>
    </Page>
  );
}
