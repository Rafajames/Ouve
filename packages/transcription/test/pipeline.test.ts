import { describe, expect, it, vi } from "vitest";
import { TranscriptStore, type TranscriptionProvider } from "@ouve/core";
import { OuveError } from "@ouve/shared";
import { TranscriptionPipeline } from "../src/index.js";

const caps = { tasks: ["transcription" as const], streaming: false, diarization: false, segmentTimestamps: true, confidence: false };
const job = (index: number, extra = {}) => ({
  index,
  offsetMs: index * 10_000,
  durationMs: 10_000,
  mimeType: "audio/wav",
  data: new Uint8Array(4),
  ...extra
});

function provider(impl: TranscriptionProvider["transcribe"]): TranscriptionProvider {
  return { id: "fake", capabilities: caps, transcribe: vi.fn(impl) };
}

describe("TranscriptionPipeline", () => {
  it("transcreve em ordem com offsets e não duplica índices", async () => {
    const store = new TranscriptStore();
    const p = provider(async (req) => ({ segments: [{ startMs: 0, endMs: 1000, text: `t${req.durationMs}` }] }));
    const pipeline = new TranscriptionPipeline({ provider: p, store, language: "pt-BR" });
    expect(pipeline.enqueue(job(1))).toBe(true);
    expect(pipeline.enqueue(job(0))).toBe(true);
    expect(pipeline.enqueue(job(0))).toBe(false);
    await pipeline.whenIdle();
    expect(store.segments().map((s) => s.startMs)).toEqual([0, 10_000]);
    expect(pipeline.enqueue(job(1))).toBe(false);
    expect(p.transcribe).toHaveBeenCalledTimes(2);
    expect(pipeline.stats()).toMatchObject({ done: 2, transcribedUntilMs: 20_000 });
  });

  it("pula blocos silenciosos sem chamar o provedor", async () => {
    const store = new TranscriptStore();
    const p = provider(async () => ({ segments: [] }));
    const pipeline = new TranscriptionPipeline({ provider: p, store });
    pipeline.enqueue(job(0, { silent: true }));
    await pipeline.whenIdle();
    expect(p.transcribe).not.toHaveBeenCalled();
    expect(pipeline.stats().skipped).toBe(1);
  });

  it("retém falhas e permite nova tentativa sem duplicar", async () => {
    const store = new TranscriptStore();
    let fail = true;
    const onJobError = vi.fn();
    const p = provider(async () => {
      if (fail) throw new OuveError("auth", "credencial");
      return { segments: [{ startMs: 0, endMs: 1, text: "ok" }] };
    });
    const pipeline = new TranscriptionPipeline({ provider: p, store, onJobError, delay: async () => undefined });
    pipeline.enqueue(job(0));
    await pipeline.whenIdle();
    expect(pipeline.stats().failed).toBe(1);
    expect(onJobError).toHaveBeenCalledWith(0, expect.objectContaining({ code: "auth" }));
    fail = false;
    expect(pipeline.retryFailed()).toBe(1);
    await pipeline.whenIdle();
    pipeline.retryFailed();
    await pipeline.whenIdle();
    expect(store.segments()).toHaveLength(1);
  });

  it("repete erros transitórios automaticamente", async () => {
    const store = new TranscriptStore();
    let calls = 0;
    const p = provider(async () => {
      calls += 1;
      if (calls === 1) throw new OuveError("rate-limit", "429");
      return { segments: [{ startMs: 0, endMs: 1, text: "ok" }] };
    });
    const pipeline = new TranscriptionPipeline({ provider: p, store, delay: async () => undefined });
    pipeline.enqueue(job(0));
    await pipeline.whenIdle();
    expect(calls).toBe(2);
    expect(store.segments()).toHaveLength(1);
  });

  it("envia contexto do bloco anterior e cancela pendentes", async () => {
    const store = new TranscriptStore();
    const requests: Array<string | undefined> = [];
    const p = provider(async (req) => {
      requests.push(req.previousText);
      return { segments: [{ startMs: 0, endMs: 1, text: "anterior" }] };
    });
    const pipeline = new TranscriptionPipeline({ provider: p, store, concurrency: 1 });
    pipeline.enqueue(job(0));
    await pipeline.whenIdle();
    pipeline.enqueue(job(1));
    await pipeline.whenIdle();
    expect(requests).toEqual([undefined, "anterior"]);

    const slow = provider(
      (_req, signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))))
    );
    const p2 = new TranscriptionPipeline({ provider: slow, store: new TranscriptStore(), concurrency: 1 });
    p2.enqueue(job(0));
    p2.enqueue(job(1));
    p2.cancel();
    await p2.whenIdle();
    expect(p2.stats().failed).toBe(2);
    p2.discard();
    expect(p2.stats().failed).toBe(0);
  });
});
