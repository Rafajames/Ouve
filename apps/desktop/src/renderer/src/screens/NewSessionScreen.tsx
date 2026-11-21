import { useCallback, useEffect, useRef, useState } from "react";
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
import { bridge, unwrap } from "../bridge";
import { LevelMeter, Page } from "../components";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";

type SourceKind = "screen" | "window" | "tab" | "microphone";

const KINDS: Array<{ kind: SourceKind; label: string; hint: string; icon: IconName }> = [
  { kind: "screen", label: "Tela inteira", hint: "Escolha um monitor", icon: "monitor" },
  { kind: "window", label: "Janela", hint: "Escolha um aplicativo", icon: "window" },
  { kind: "tab", label: "Aba do navegador", hint: "Pela extensão do Ouve", icon: "tab" },
  { kind: "microphone", label: "Somente microfone", hint: "Sem fonte compartilhada", icon: "mic" }
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
  const [kind, setKind] = useState<SourceKind>("screen");
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selected, setSelected] = useState<DesktopSource | null>(null);
  const [mic, setMic] = useState(false);
  const [mics, setMics] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [micId, setMicId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const test = useAudioTest();

  const platform = detectPlatform({ isElectron: true, os: bridge().platform });
  const caps = capabilitiesFor(platform);
  const providerName = data.providers.find((p) => p.config.id === data.settings?.transcriptionProviderId)?.config.displayName;
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
  const canStart = !!providerName && !starting && !busy && (needsSource ? !!selected : kind === "microphone");

  const devices = navigator.mediaDevices as unknown as MediaDevicesLike;
  const testSource = () => {
    if (needsSource && selected) {
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
        ...(needsSource && selected ? { sourceId: selected.id } : {}),
        sourceLabel: needsSource && selected ? selected.name : "Microfone",
        includeMicrophone: kind === "microphone" || mic,
        ...(micId ? { microphoneDeviceId: micId } : {})
      });
      navigate("session");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Page
      title="Nova sessão"
      subtitle="Selecione de onde vem o áudio. A tela é usada apenas para escolher a fonte: o Ouve descarta a imagem e processa somente o som."
    >
      {busy && (
        <div className="callout">
          Há uma captura em andamento. <button onClick={() => navigate("session")}>Abrir sessão</button>
        </div>
      )}
      <div className="panel">
        <label className="field">
          <span>Título da sessão</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Audiência de conciliação — processo 123"
            maxLength={200}
          />
        </label>
      </div>

      <div className="panel">
        <h2>Fonte de áudio</h2>
        <div className="choices" role="radiogroup" aria-label="Tipo de fonte">
          {KINDS.map((k) => (
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
                <Icon name={k.icon} size={20} />
              </span>
              <strong>{k.label}</strong>
              <small>{k.hint}</small>
            </button>
          ))}
        </div>

        {needsSource && (
          <>
            <div className="row between">
              <p className="muted">{caps["source-audio"].note}</p>
              <button className="small" onClick={() => void refresh()}>
                <Icon name="refresh" size={14} /> Atualizar lista
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
                      <Icon name={s.kind === "screen" ? "monitor" : "window"} size={16} /> {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {kind === "tab" && (
          <div className="callout">
            Para capturar o áudio de uma aba, use a extensão do Ouve para Chrome. No aplicativo desktop, escolha a janela do navegador ou a
            tela inteira. O Firefox não oferece captura de áudio de abas.
          </div>
        )}

        {kind !== "tab" && (
          <div className="mic-row">
            {kind !== "microphone" && (
              <label className="check">
                <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> Incluir meu microfone
              </label>
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
        )}

        {kind !== "tab" && (
          <div className="test-row">
            <button disabled={test.running || (needsSource && !selected)} onClick={testSource}>
              <Icon name="wave" /> {test.running ? "Testando…" : "Testar áudio (5 s)"}
            </button>
            {test.running && <LevelMeter level={test.level} />}
            {test.result && <span className="muted">{test.result}</span>}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Antes de começar</h2>
        {!providerName && (
          <p className="warn-text">
            Nenhum provedor de transcrição selecionado. <button onClick={() => navigate("providers")}>Configurar</button>
          </p>
        )}
        {providerName && (
          <p className="muted">
            <Icon name="info" size={14} /> O áudio será enviado em blocos para <strong>{providerName}</strong>. Lembre-se de informar os
            participantes.
          </p>
        )}
        <button className="primary large" disabled={!canStart} onClick={() => void start()}>
          <Icon name="record" /> {starting ? "Iniciando…" : "Iniciar captura de áudio"}
        </button>
      </div>
    </Page>
  );
}
