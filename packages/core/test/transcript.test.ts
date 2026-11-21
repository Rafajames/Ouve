import { describe, expect, it } from "vitest";
import { TranscriptStore } from "../src/domain/transcript.js";
import { validateMediaFile, DEFAULT_MEDIA_LIMITS } from "../src/domain/media-limits.js";

describe("TranscriptStore", () => {
  it("aplica offset do bloco e ordena", () => {
    const store = new TranscriptStore();
    store.applyChunk({ chunkIndex: 1, offsetMs: 30_000, segments: [{ startMs: 0, endMs: 2000, text: "segundo" }] });
    store.applyChunk({ chunkIndex: 0, offsetMs: 0, segments: [{ startMs: 500, endMs: 1500, text: "primeiro" }] });
    expect(store.segments().map((s) => [s.text, s.startMs])).toEqual([
      ["primeiro", 500],
      ["segundo", 30_000]
    ]);
  });

  it("não duplica segmentos ao reaplicar o mesmo bloco", () => {
    const store = new TranscriptStore();
    const chunk = { chunkIndex: 0, offsetMs: 0, segments: [{ startMs: 0, endMs: 1, text: "olá" }] };
    store.applyChunk(chunk);
    store.applyChunk(chunk);
    expect(store.segments()).toHaveLength(1);
  });

  it("usa identificadores neutros e permite renomear", () => {
    const store = new TranscriptStore();
    store.applyChunk({
      chunkIndex: 0,
      offsetMs: 0,
      segments: [
        { startMs: 0, endMs: 1, text: "a", speakerLabel: "A" },
        { startMs: 1, endMs: 2, text: "b", speakerLabel: "B" },
        { startMs: 2, endMs: 3, text: "c", speakerLabel: "A" }
      ]
    });
    expect(store.speakerList().map((s) => s.label)).toEqual(["Falante 1", "Falante 2"]);
    store.renameSpeaker("spk-1", "  Juíza  ");
    expect(store.speakerLabel(store.segments()[2]?.speakerId)).toBe("Juíza");
    expect(() => store.renameSpeaker("spk-1", " ")).toThrow();
  });

  it("edita texto, marca baixa confiança e ignora trechos vazios", () => {
    const store = new TranscriptStore(0.5);
    store.applyChunk({
      chunkIndex: 0,
      offsetMs: 0,
      segments: [
        { startMs: 0, endMs: 1, text: "  ", confidence: 0.9 },
        { startMs: 0, endMs: 1, text: "talvez", confidence: 0.3 }
      ]
    });
    const [seg] = store.segments();
    expect(store.isLowConfidence(seg!)).toBe(true);
    store.editSegmentText(seg!.id, "com certeza");
    expect(store.segments()[0]).toMatchObject({ text: "com certeza", edited: true });
    expect(store.toPlainText(() => "00")).toBe("[00] Falante não identificado: com certeza");
  });
});

describe("validateMediaFile", () => {
  it("aceita áudio e vídeo como contêiner", () => {
    expect(validateMediaFile({ name: "a.MP3", sizeBytes: 10 })).toMatchObject({ ok: true, kind: "audio" });
    expect(validateMediaFile({ name: "b.mkv", sizeBytes: 10 })).toMatchObject({ ok: true, kind: "video" });
  });
  it("recusa formato, tamanho e duração fora do limite", () => {
    expect(validateMediaFile({ name: "c.exe", sizeBytes: 10 })).toMatchObject({ ok: false, code: "unsupported-format" });
    expect(validateMediaFile({ name: "c.wav", sizeBytes: DEFAULT_MEDIA_LIMITS.maxFileBytes + 1 })).toMatchObject({
      ok: false,
      code: "file-too-large"
    });
    expect(validateMediaFile({ name: "c.wav", sizeBytes: 1, durationMs: 5 * 3_600_000 })).toMatchObject({
      ok: false,
      code: "duration-exceeded"
    });
    expect(validateMediaFile({ name: "c.wav", sizeBytes: 0 })).toMatchObject({ ok: false, code: "empty-file" });
  });
});
