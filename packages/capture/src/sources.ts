import { OuveError } from "@ouve/shared";
import { selectAudioTracks } from "@ouve/core";

/**
 * Seleção de fonte e obtenção de áudio são capacidades distintas:
 * - a seleção (tela/janela/aba) é feita por um seletor da plataforma;
 * - a obtenção devolve SOMENTE trilhas de áudio. Trilhas de vídeo exigidas
 *   pela API para abrir o seletor são interrompidas imediatamente, sem
 *   leitura de quadros, codificação, transmissão ou armazenamento.
 */

export interface MediaStreamLike {
  getTracks(): MediaStreamTrackLike[];
  getAudioTracks(): MediaStreamTrackLike[];
}

export interface MediaStreamTrackLike {
  readonly kind: string;
  readonly label: string;
  readyState?: string;
  enabled: boolean;
  stop(): void;
  addEventListener(type: "ended", listener: () => void): void;
}

export interface MediaDevicesLike {
  getDisplayMedia?(constraints: unknown): Promise<MediaStreamLike>;
  getUserMedia(constraints: unknown): Promise<MediaStreamLike>;
  enumerateDevices?(): Promise<Array<{ kind: string; deviceId: string; label: string }>>;
}

export type StreamFactory = (tracks: MediaStreamTrackLike[]) => MediaStreamLike;

function mapMediaError(error: unknown, what: string): OuveError {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new OuveError("permission-denied", `Permissão negada ou seleção cancelada (${what}).`, { retryable: false });
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new OuveError("no-audio", `Nenhum dispositivo de áudio disponível (${what}).`, { retryable: false });
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return new OuveError("unsupported", `Recurso não suportado nesta plataforma (${what}).`, { retryable: false });
  }
  return new OuveError("internal", `Falha ao obter áudio (${what}).`, { cause: error, retryable: false });
}

/**
 * Abre o seletor de compartilhamento (tela/janela/aba) e devolve apenas o áudio.
 * Lança `no-audio` se a fonte escolhida não fornecer trilha de áudio.
 */
export async function acquireDisplayAudio(devices: MediaDevicesLike, makeStream: StreamFactory): Promise<MediaStreamLike> {
  if (!devices.getDisplayMedia)
    throw new OuveError("unsupported", "Seleção de tela/janela/aba não suportada nesta plataforma.", { retryable: false });
  let stream: MediaStreamLike;
  try {
    // A API exige video:true para exibir o seletor; os quadros são descartados abaixo.
    stream = await devices.getDisplayMedia({
      video: { width: 1, height: 1, frameRate: 1 },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: "include",
      selfBrowserSurface: "exclude",
      surfaceSwitching: "exclude"
    });
  } catch (error) {
    throw mapMediaError(error, "fonte compartilhada");
  }
  try {
    const audio = selectAudioTracks(stream.getTracks());
    return makeStream(audio);
  } catch {
    throw new OuveError(
      "no-audio",
      "A fonte selecionada não forneceu áudio. Verifique se a opção de compartilhar áudio foi marcada ou escolha outra fonte.",
      { retryable: false }
    );
  }
}

/** Microfone opcional, separado da fonte. */
export async function acquireMicrophone(devices: MediaDevicesLike, deviceId?: string): Promise<MediaStreamLike> {
  try {
    const stream = await devices.getUserMedia({
      audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true },
      video: false
    });
    if (stream.getAudioTracks().length === 0) throw new OuveError("no-audio", "O microfone não forneceu áudio.", { retryable: false });
    return stream;
  } catch (error) {
    if (error instanceof OuveError) throw error;
    throw mapMediaError(error, "microfone");
  }
}

/** Áudio de aba via `chrome.tabCapture` (id obtido pelo service worker). Somente áudio é solicitado. */
export async function acquireTabAudio(devices: MediaDevicesLike, streamId: string): Promise<MediaStreamLike> {
  try {
    const stream = await devices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
      video: false
    });
    if (stream.getAudioTracks().length === 0) throw new OuveError("no-audio", "A aba não forneceu áudio.", { retryable: false });
    return stream;
  } catch (error) {
    if (error instanceof OuveError) throw error;
    throw mapMediaError(error, "aba do navegador");
  }
}

export async function listMicrophones(devices: MediaDevicesLike): Promise<Array<{ deviceId: string; label: string }>> {
  const all = (await devices.enumerateDevices?.()) ?? [];
  return all.filter((d) => d.kind === "audioinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microfone ${i + 1}` }));
}
