import { useEffect, useState } from "react";
import { PROFILE_SPECS, SPEAKER_MODELS, WHISPER_MODELS, type ProfileChoice } from "@ouve/providers";
import { Icon } from "@ouve/ui";
import type { LocalAiState, MachineReport } from "../../shared/ipc";
import { unwrap } from "./bridge";
import { errorMessage, useApp, type AppData } from "./hooks";

/**
 * Perfil de desempenho (D-088) e separação de vozes local (D-087): o Ouve mede o
 * computador, recomenda um perfil e prepara os modelos com um clique.
 */
export function PerformanceCard(props: {
  data: AppData;
  mstate: LocalAiState | null;
  progress: Record<string, number>;
  busy: string | null;
  act: (task: string, run: () => Promise<void>, done?: string) => Promise<void>;
  useWhisper: (name: (typeof WHISPER_MODELS)[number]["name"]) => Promise<void>;
}) {
  const { data, mstate, progress, busy, act } = props;
  const { notify } = useApp();
  const managed = window.ouve?.local?.managed;
  const [report, setReport] = useState<MachineReport | null>(null);
  const settings = data.settings;

  const measure = async (rerun = false) => {
    if (!managed) return;
    try {
      setReport(await unwrap(managed.machine(rerun)));
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };
  useEffect(() => void measure(), [settings?.performanceProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!managed || !settings) return null;

  const spec = report ? PROFILE_SPECS[report.active] : undefined;
  const hasWhisper = !!spec && !!mstate?.installedModels.some((m) => m.name === spec.whisperModel);
  const hasSpeaker = !!spec && !!mstate?.installedSpeakerModels.includes(spec.speakerModel);
  const speakerInfo = SPEAKER_MODELS.find((m) => m.id === spec?.speakerModel);
  const whisperInfo = WHISPER_MODELS.find((m) => m.name === spec?.whisperModel);
  const m = report?.machine;

  const save = (patch: Partial<typeof settings>) => void data.saveSettings({ ...settings, ...patch });

  const prepare = () =>
    spec &&
    act(
      "perfil",
      async () => {
        if (mstate?.diarizationBundled && !hasSpeaker) await unwrap(managed.downloadSpeakerModel(spec.speakerModel));
        if (mstate?.whisperBundled) await props.useWhisper(spec.whisperModel);
      },
      `Perfil ${spec.label} pronto: transcrição e separação de vozes no seu computador.`
    );

  const pct = (task: string) => {
    const v = progress[task];
    return v !== undefined && v < 100 ? ` ${v}%` : "";
  };

  return (
    <div className="local-card perf-card">
      <div className="row between">
        <strong>
          <Icon name="cpu" size={15} /> Desempenho deste computador
        </strong>
        <button className="small link" onClick={() => void measure(true)}>
          medir de novo
        </button>
      </div>
      {m && (
        <p className="small-text muted">
          {Math.round(m.ramGb)} GB de memória · {m.cores} núcleos · teste do processador {m.cpuScore?.toLocaleString("pt-BR")}
          {m.dedicatedGpu ? " · placa de vídeo dedicada (ainda não usada pelo Ouve)" : ""}
        </p>
      )}
      <div className="row wrap">
        <label className="small-text">
          Perfil{" "}
          <select
            value={settings.performanceProfile}
            onChange={(e) => save({ performanceProfile: e.target.value as ProfileChoice })}
            aria-label="Perfil de desempenho"
          >
            <option value="auto">Automático{report ? ` (${PROFILE_SPECS[report.recommended].label})` : ""}</option>
            <option value="leve">Leve</option>
            <option value="equilibrado">Equilibrado</option>
            <option value="maximo">Máximo</option>
          </select>
        </label>
        {spec && (
          <button className="small primary" disabled={busy !== null} onClick={() => void prepare()}>
            <Icon name="download" size={14} />{" "}
            {busy === "perfil"
              ? `Preparando…${pct(`falantes:${spec.speakerModel}`) || pct(`modelo:${spec.whisperModel}`)}`
              : hasWhisper && hasSpeaker
                ? "Usar este perfil"
                : "Preparar este perfil"}
          </button>
        )}
      </div>
      {report && spec && (
        <p className="small-text">
          {spec.description}
          {settings.performanceProfile === "auto" ? ` Escolhido por: ${report.reason}.` : ""} Usa {report.threads} de {m?.cores} núcleos.
          <br />
          Transcrição: modelo <b>{spec.whisperModel}</b> ({whisperInfo?.sizeMb} MB) {hasWhisper ? "✓ baixado" : "· falta baixar"} ·
          Separação de vozes: <b>{speakerInfo?.id}</b> ({speakerInfo?.sizeMb} MB){" "}
          {!mstate?.diarizationBundled ? "· não incluída nesta instalação" : hasSpeaker ? "✓ baixado" : "· falta baixar"}
        </p>
      )}
      <div className="row wrap">
        <label className="small-text">
          <input type="checkbox" checked={settings.autoDiarization} onChange={(e) => save({ autoDiarization: e.target.checked })} /> Separar
          as vozes automaticamente
        </label>
        <label className="small-text">
          Pessoas na sessão{" "}
          <input
            type="number"
            min={0}
            max={20}
            value={settings.speakerCount}
            onChange={(e) => save({ speakerCount: Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))) })}
            aria-label="Número de pessoas (0 = descobrir sozinho)"
            style={{ width: "4em" }}
          />{" "}
          <span className="muted">(0 = descobrir sozinho; informar melhora o resultado)</span>
        </label>
      </div>
      <p className="small-text muted">
        A separação de vozes (sherpa-onnx) roda no seu computador ao terminar a transcrição. Erra mais quando duas pessoas falam juntas;
        corrija em Participantes ou use as teclas 1–9 durante a captura.
      </p>
    </div>
  );
}
