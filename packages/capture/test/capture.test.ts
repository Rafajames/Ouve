import { describe, expect, it, vi } from "vitest";
import {
  AudioActivityMonitor,
  AudioCaptureSession,
  PcmChunker,
  acquireDisplayAudio,
  acquireMicrophone,
  capabilitiesFor,
  detectPlatform,
  downmix,
  encodeWav,
  resampleLinear,
  rms,
  wavDurationMs,
  type AudioContextLike,
  type MediaStreamLike,
  type MediaStreamTrackLike,
  type PcmChunk
} from "../src/index.js";

function tone(n: number, amp = 0.5): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 5));
}

function fakeTrack(kind: string) {
  const listeners: Array<() => void> = [];
  const track = {
    kind,
    label: kind,
    enabled: true,
    readyState: "live",
    stop: vi.fn(() => {
      track.readyState = "ended";
    }),
    addEventListener: (_: "ended", l: () => void) => listeners.push(l),
    end: () => {
      track.readyState = "ended";
      listeners.forEach((l) => l());
    }
  };
  return track;
}

function stream(tracks: MediaStreamTrackLike[]): MediaStreamLike {
  return { getTracks: () => tracks, getAudioTracks: () => tracks.filter((t) => t.kind === "audio") };
}

describe("PCM", () => {
  it("codifica WAV válido com duração correta", () => {
    const wav = encodeWav(tone(16_000), 16_000);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(wav.byteLength).toBe(44 + 32_000);
    expect(wavDurationMs(wav)).toBe(1000);
  });
  it("reamostra 48k para 16k e mixa canais", () => {
    expect(resampleLinear(tone(48_000), 48_000, 16_000).length).toBe(16_000);
    expect(Array.from(downmix([Float32Array.of(1, 0), Float32Array.of(0, 1)]))).toEqual([0.5, 0.5]);
    expect(rms(new Float32Array(10))).toBe(0);
  });
});

describe("PcmChunker", () => {
  it("emite blocos sequenciais com offsets e marca silêncio", () => {
    const chunks: PcmChunk[] = [];
    const chunker = new PcmChunker({ sampleRate: 1000, chunkMs: 1000, onChunk: (c) => chunks.push(c) });
    chunker.push(tone(1500));
    chunker.push(new Float32Array(600));
    chunker.flush();
    // 100 amostras restantes (< 300 ms) são descartadas, mas contam no tempo.
    expect(chunks.map((c) => [c.index, c.offsetMs, c.durationMs])).toEqual([
      [0, 0, 1000],
      [1, 1000, 1000]
    ]);
    expect(chunks[0]?.silent).toBe(false);
    chunker.push(new Float32Array(400));
    chunker.flush();
    expect(chunks[2]).toMatchObject({ index: 2, offsetMs: 2100, durationMs: 400, silent: true });
  });
  it("rejeita blocos curtos demais", () => {
    expect(() => new PcmChunker({ sampleRate: 1000, chunkMs: 100, onChunk: () => undefined })).toThrow();
  });
});

describe("AudioActivityMonitor", () => {
  it("avisa ausência de áudio apenas após o limite", () => {
    const onChange = vi.fn();
    const m = new AudioActivityMonitor({ silenceAlertMs: 1000, onChange });
    m.observe(0, 500);
    expect(onChange).not.toHaveBeenCalled();
    m.observe(0, 600);
    expect(onChange).toHaveBeenLastCalledWith("no-audio");
    m.observe(0.2, 10);
    expect(onChange).toHaveBeenLastCalledWith("audio");
  });
});

describe("aquisição de fontes", () => {
  it("mantém só áudio da fonte compartilhada e interrompe o vídeo", async () => {
    const audio = fakeTrack("audio");
    const video = fakeTrack("video");
    const getDisplayMedia = vi.fn(async () => stream([audio, video]));
    const result = await acquireDisplayAudio({ getDisplayMedia, getUserMedia: vi.fn() }, stream);
    expect(result.getTracks()).toEqual([audio]);
    expect(video.stop).toHaveBeenCalledOnce();
  });
  it("informa fonte sem áudio", async () => {
    const video = fakeTrack("video");
    await expect(
      acquireDisplayAudio({ getDisplayMedia: async () => stream([video]), getUserMedia: vi.fn() }, stream)
    ).rejects.toMatchObject({ code: "no-audio" });
    expect(video.stop).toHaveBeenCalled();
  });
  it("mapeia cancelamento do seletor e falta de suporte", async () => {
    const denied = Object.assign(new Error("x"), { name: "NotAllowedError" });
    await expect(
      acquireDisplayAudio({ getDisplayMedia: async () => Promise.reject(denied), getUserMedia: vi.fn() }, stream)
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(acquireDisplayAudio({ getUserMedia: vi.fn() }, stream)).rejects.toMatchObject({ code: "unsupported" });
  });
  it("solicita microfone sem vídeo", async () => {
    const getUserMedia = vi.fn(async () => stream([fakeTrack("audio")]));
    await acquireMicrophone({ getUserMedia }, "mic-1");
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
  });
});

function fakeContext() {
  const processors: Array<{ onaudioprocess: ((e: { inputBuffer: { getChannelData(): Float32Array } }) => void) | null }> = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const ctx = {
    sampleRate: 16_000,
    destination: node(),
    createMediaStreamSource: vi.fn(node),
    createGain: vi.fn(() => ({ ...node(), gain: { value: 1 } })),
    createScriptProcessor: vi.fn(() => {
      const p = { ...node(), onaudioprocess: null };
      processors.push(p);
      return p;
    }),
    close: vi.fn(async () => undefined)
  };
  const feed = (samples: Float32Array) => processors[0]?.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } });
  return { ctx: ctx as unknown as AudioContextLike & typeof ctx, feed };
}

describe("AudioCaptureSession", () => {
  it("captura, pausa sem enviar áudio, retoma e libera recursos", async () => {
    const { ctx, feed } = fakeContext();
    const src = fakeTrack("audio");
    const chunks: PcmChunk[] = [];
    const session = new AudioCaptureSession({
      createContext: () => ctx,
      source: stream([src]),
      chunkMs: 1000,
      onChunk: (c) => chunks.push(c)
    });
    feed(tone(16_000));
    expect(chunks).toHaveLength(1);
    session.pause();
    feed(tone(16_000));
    expect(chunks).toHaveLength(1);
    session.resume();
    feed(tone(8000));
    await session.stop();
    expect(chunks).toHaveLength(2);
    expect(chunks[1]?.offsetMs).toBe(1000);
    expect(src.stop).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
    expect(session.currentState).toBe("stopped");
  });

  it("encerra quando a fonte termina e não há microfone", async () => {
    const { ctx } = fakeContext();
    const src = fakeTrack("audio");
    const onSourceEnded = vi.fn();
    const session = new AudioCaptureSession({ createContext: () => ctx, source: stream([src]), onChunk: vi.fn(), onSourceEnded });
    src.end();
    await Promise.resolve();
    expect(onSourceEnded).toHaveBeenCalledWith("source");
    expect(session.currentState).toBe("stopped");
  });

  it("exige ao menos uma fonte", () => {
    expect(() => new AudioCaptureSession({ createContext: () => fakeContext().ctx, onChunk: vi.fn() })).toThrow();
  });
});

describe("capacidades por plataforma", () => {
  it("declara limitações honestas", () => {
    expect(capabilitiesFor("firefox-extension")["tab-selection"].supported).toBe(false);
    expect(capabilitiesFor("electron-windows")["source-audio"].note).toMatch(/SISTEMA inteiro/);
    expect(detectPlatform({ isElectron: false, userAgent: "Mozilla Firefox/130" })).toBe("firefox-extension");
    expect(detectPlatform({ isElectron: true, os: "win32" })).toBe("electron-windows");
  });
});
