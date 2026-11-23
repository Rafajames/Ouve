import { useCallback, useEffect, useRef, useState } from "react";
import { GEMINI_FREE_TIER_NOTE } from "@ouve/providers";
import { Icon, type IconName } from "@ouve/ui";
import {
  acquireDisplayAudio,
  acquireMicrophone,
  capabilitiesFor,
  detectPlatform,
  listMicrophones,
  rms,
  type MediaDevicesLike,
  type MediaStreamLike,
  type MediaStreamTrackLike
} from "@ouve/capture";
import type { DesktopSource } from "../../../shared/ipc";
import { bridge, capturePlatformEnv, isWeb, unwrap } from "../bridge";
import { LevelMeter, Page, Panel, StatusBadge } from "../components";
import { LANGUAGES } from "../languages";
import { REPORT_CONTEXTS, type ReportContext } from "@ouve/core";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";

type SourceKind = "screen" | "window" | "microphone" | "browser";

interface KindDef {
  kind: SourceKind;
  label: string;
  hint: string;
  icon: IconName;
}

/** Versão web: o seletor de aba/janela/tela é o do próprio navegador, como no Google Meet. */
const WEB_KINDS: KindDef[] = [
  { kind: "browser", label: "Aba ou tela", hint: "Escolha no seletor do navegador a aba ou a tela com o som da reunião.", icon: "tab" },
  { kind: "microphone", label: "Somente microfone", hint: "Capta a sua voz e quem estiver perto do computador.", icon: "mic" }
];

/** Desktop: aba do navegador só pela extensão, por isso não aparece como opção aqui. */
const KINDS: KindDef[] = [
  { kind: "screen", label: "Tela inteira", hint: "Capta o som reproduzido pelo computador enquanto a reunião acontece.", icon: "monitor" },
  { kind: "window", label: "Janela", hint: "Escolha o programa da reunião (Teams, Meet, Zoom…).", icon: "window" },
  { kind: "microphone", label: "Somente microfone", hint: "Capta a sua voz e quem estiver perto do computador.", icon: "mic" }
];

const makeStream = (tracks: MediaStreamTrackLike[]) =>
  new MediaStream(tracks as unknown as MediaStreamTrack[]) as unknown as MediaStreamLike;

/** Teste de áudio local por alguns segundos; nada é enviado ou gravado. */
function useAudioTest() {
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const stopRef = useRef<() => void>(() => undefined);

  const run = useCallback(async (acquire: () => Promise<MediaStreamLike>) => {
    setRunning(true);
    setResult(null);
    let stream: MediaStreamLike | undefined;
    try {
      stream = await acquire();
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream as unknown as MediaStream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      let peak = 0;
      const started = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          analyser.getFloatTimeDomainData(buffer);
          const l = rms(buffer);
          peak = Math.max(peak, l);
          setLevel(l);
          if (performance.now() - started > 5000) resolve();
          else requestAnimationFrame(tick);
        };
        stopRef.current = resolve;
        tick();
      });
      await ctx.close();
      setResult(
        peak > 0.003 ? "Áudio detectado. A fonte está pronta." : "Nenhum áudio detectado. Reproduza algum som na fonte e teste novamente."
      );
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setLevel(0);
      setRunning(false);
    }
  }, []);

  return { level, result, running, run, stop: () => stopRef.current() };
}

export function NewSessionScreen({ data }: { data: AppData }) {
  const { controller, navigate, notify } = useApp();
  const session = useSession();
  const [kind, setKind] = useState<SourceKind>(isWeb() ? "browser" : "screen");
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selected, setSelected] = useState<DesktopSource | null>(null);
  const [mic, setMic] = useState(false);
  const [mics, setMics] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [micId, setMicId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const [context, setContext] = useState<ReportContext>(data.settings?.defaultContext ?? "general");
  const test = useAudioTest();

  const platform = detectPlatform(capturePlatformEnv());
  const caps = capabilitiesFor(platform);
  const transcriber = data.providers.find((p) => p.config.id === data.settings?.transcriptionProviderId)?.config;
  const providerName = transcriber?.displayName;
  const busy = session.mode === "live" && (session.status === "capturing" || session.status === "paused");

  const refresh = useCallback(async () => {
    try {
      setSources(await unwrap(bridge().capture.listSources()));
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
    void listMicrophones(navigator.mediaDevices as unknown as MediaDevicesLike)
      .then(setMics)
      .catch(() => setMics([]));
  }, [refresh]);

  const visible = sources.filter((s) => s.kind === kind);
  const needsSource = kind === "screen" || kind === "window";
  const canStart = !!providerName && !starting && !busy && (needsSource ? !!selected : true);

  const devices = navigator.mediaDevices as unknown as MediaDevicesLike;
  const testSource = () => {
    if (kind === "browser") void test.run(() => acquireDisplayAudio(devices, makeStream));
    else if (needsSource && selected) {
      void test.run(async () => {
        await unwrap(bridge().capture.selectSource(selected.id));
        return acquireDisplayAudio(devices, makeStream);
      });
    } else void test.run(() => acquireMicrophone(devices, micId || undefined));
  };

  const start = async () => {
    if (
      session.mode !== "none" &&
      controller.hasContent &&
      !window.confirm("Iniciar uma nova sessão descarta a sessão atual (transcrição e relatório não exportados). Continuar?")
    )
      return;
    setStarting(true);
    try {
      await controller.discard();
      await controller.startLive({
        title: title.trim() || "Sessão ao vivo",
        ...(needsSource && selected ? { sourceId: selected.id } : kind === "browser" ? { sourceId: "browser" } : {}),
        sourceLabel: needsSource && selected ? selected.name : kind === "browser" ? "Fonte do navegador" : "Microfone",
        includeMicrophone: kind === "microphone" || mic,
        context,
        ...(micId ? { microphoneDeviceId: micId } : {})
      });
      navigate("session");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setStarting(false);
    }
  };

  const settings = data.settings;
  const kinds = isWeb() ? WEB_KINDS : KINDS;
  const languageLabel = LANGUAGES.find((l) => l.value === settings?.language)?.label ?? settings?.language ?? "—";

  return (
    <Page title="Nova reunião" subtitle="Escolha de onde vem o som, confira o resumo e comece.">
      {busy && (
        <div className="callout">
          <Icon name="info" size={15} />
          <span>Há uma gravação em andamento.</span>
          <button className="small" onClick={() => navigate("session")}>
            Abrir sessão
          </button>
        </div>
      )}
      <div className="split">
        <Panel title="De onde vem o áudio?" icon="volume" className="source-panel">
          <div className="choices" role="radiogroup" aria-label="Tipo de fonte">
            {kinds.map((k) => (
              <button
                key={k.kind}
                role="radio"
                aria-checked={kind === k.kind}
                className={kind === k.kind ? "choice selected" : "choice"}
                onClick={() => {
                  setKind(k.kind);
                  setSelected(null);
                }}
              >
                <span className="choice-icon">
                  <Icon name={k.icon} size={18} />
                </span>
                <span className="choice-text">
                  <strong>{k.label}</strong>
                  <small>{k.hint}</small>
                </span>
              </button>
            ))}
          </div>

          {needsSource && (
            <div className="source-picker">
              <div className="row between">
                <span className="field-label">{kind === "screen" ? "Qual tela?" : "Qual janela?"}</span>
                <button className="small ghost" onClick={() => void refresh()}>
                  <Icon name="refresh" size={13} /> Atualizar lista
                </button>
              </div>
              {visible.length === 0 ? (
                <p className="empty">Nenhuma {kind === "screen" ? "tela" : "janela"} encontrada.</p>
              ) : (
                <ul className="source-list" role="listbox" aria-label="Fontes disponíveis">
                  {visible.map((s) => (
                    <li key={s.id}>
                      <button
                        role="option"
                        aria-selected={selected?.id === s.id}
                        className={selected?.id === s.id ? "source selected" : "source"}
                        onClick={() => setSelected(s)}
                      >
                        <Icon name={s.kind === "screen" ? "monitor" : "window"} size={15} /> <span className="ellipsis">{s.name}</span>
                        {selected?.id === s.id && <Icon name="check" size={14} className="source-check" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!caps["source-audio"].supported && <p className="warn-text small-text">{caps["source-audio"].note}</p>}
            </div>
          )}
          {kind === "browser" && (
            <div className="callout">
              <Icon name="info" size={15} />
              <span>
                Ao iniciar, o navegador abre o seletor. Escolha a <strong>aba</strong> e deixe marcado “Compartilhar áudio da aba”, ou a{" "}
                <strong>tela inteira</strong> com “Compartilhar áudio do sistema” (Windows). Janelas avulsas não trazem áudio no navegador.
              </span>
            </div>
          )}

          <div className="mic-row">
            {kind !== "microphone" ? (
              <label className="check">
                <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> Incluir meu microfone
              </label>
            ) : (
              <span className="field-label">Microfone</span>
            )}
            {(mic || kind === "microphone") && (
              <select aria-label="Microfone" value={micId} onChange={(e) => setMicId(e.target.value)}>
                <option value="">Microfone padrão</option>
                {mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="test-row">
            <button className="small" disabled={test.running || (needsSource && !selected)} onClick={testSource}>
              <Icon name="wave" size={14} /> {test.running ? "Testando…" : "Testar áudio (5 s)"}
            </button>
            {test.running && <LevelMeter level={test.level} />}
            {test.result && <span className="muted small-text">{test.result}</span>}
          </div>

          <p className="footnote">
            <Icon name="shield" size={13} /> A tela serve só para escolher a fonte: o Ouve descarta a imagem e processa somente o som.
            {!isWeb() && " Para captar uma aba do navegador, use a extensão do Ouve para Chrome."}
          </p>
        </Panel>

        <Panel title="Resumo" icon="check" className="start-panel">
          <label className="field">
            <span>Nome da reunião</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Audiência de conciliação — processo 123"
              maxLength={200}
            />
          </label>
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
          <dl className="kv">
            <dt>IA de transcrição</dt>
            <dd>
              {providerName ? (
                <StatusBadge tone="ok" icon="check">
                  {providerName}
                </StatusBadge>
              ) : (
                <button className="small" onClick={() => navigate("providers")}>
                  <Icon name="alert" size={13} /> Configurar IA
                </button>
              )}
            </dd>
            {transcriber && (
              <>
                <dt>Modelo</dt>
                <dd className="ellipsis">{transcriber.transcriptionModel || transcriber.model || "automático"}</dd>
              </>
            )}
            <dt>Idioma</dt>
            <dd>{languageLabel}</dd>
          </dl>
          {settings && (
            <details className="advanced">
              <summary>Opções avançadas</summary>
              <label className="field">
                <span>Idioma falado</span>
                <select
                  aria-label="Idioma falado"
                  value={settings.language}
                  onChange={(e) => void data.saveSettings({ ...settings, language: e.target.value })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tamanho dos blocos enviados à IA (segundos)</span>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={settings.liveChunkSeconds}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 5 && v <= 120) void data.saveSettings({ ...settings, liveChunkSeconds: v });
                  }}
                />
              </label>
              <p className="muted small-text">Blocos menores mostram o texto mais rápido, mas fazem mais pedidos à IA.</p>
            </details>
          )}
          <div className="start-foot">
            {providerName && (
              <p className="muted small-text">
                <Icon name="info" size={13} /> O áudio vai em blocos para <strong>{providerName}</strong>. Lembre-se de informar os
                participantes.
              </p>
            )}
            {transcriber?.protocol === "gemini" && <p className="muted small-text">{GEMINI_FREE_TIER_NOTE}</p>}
            {providerName && needsSource && !selected && (
              <p className="warn-text small-text">
                <Icon name="info" size={13} /> Escolha {kind === "screen" ? "a tela" : "a janela"} ao lado para começar.
              </p>
            )}
            <button className="primary large" disabled={!canStart} onClick={() => void start()}>
              <Icon name="record" /> {starting ? "Iniciando…" : "Iniciar captura de áudio"}
            </button>
          </div>
        </Panel>
      </div>
    </Page>
  );
}
