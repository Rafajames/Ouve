import { describe, expect, it, vi } from "vitest";
import { createWebBridge, type KeyValueStore } from "../src/web-bridge";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function bridge(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof createWebBridge>[0]> = {}) {
  const storage = memory();
  const b = createWebBridge({ storage, fetch: fetchImpl, pickFile: async () => null, download: vi.fn(), ...extra });
  return { b, storage };
}

describe("ponte web", () => {
  it("identifica a plataforma e não lista fontes (seletor do navegador)", async () => {
    const { b } = bridge(vi.fn());
    expect(b.platform).toBe("web");
    expect(b.updates).toBeUndefined();
    expect(await b.capture.listSources()).toEqual({ ok: true, value: [] });
  });

  it("configuração rápida salva a chave separada da configuração", async () => {
    const fetchImpl = vi.fn(async () => json({ models: [{ name: "models/gemini-3.7-flash" }, { name: "models/gemini-3.5-transcribe" }] }));
    const { b, storage } = bridge(fetchImpl as unknown as typeof fetch);
    const result = await b.providers.quickSetup("AQ.Ab8exemploExemploExemplo123456");
    expect(result).toMatchObject({ ok: true, value: { ok: true, providerName: "Google Gemini", canTranscribe: true } });
    expect(storage.data.get("ouve.providers")).not.toContain("AQ.");
    const settings = await b.settings.get();
    expect(settings.ok && settings.value.transcriptionProviderId).toMatch(/^rapido-/);
    const list = await b.providers.list();
    expect(list.ok && list.value[0]?.hasKey).toBe(true);
  });

  it("devolve erros serializados em vez de lançar", async () => {
    const { b } = bridge(vi.fn());
    const r = await b.providers.test("inexistente");
    expect(r).toMatchObject({ ok: false, error: { code: "invalid-input" } });
  });

  it("importa arquivo decodificado em pedaços WAV de até 5 min", async () => {
    const file = new File([new Uint8Array(10)], "aula.mp4");
    const decode = vi.fn(async (_f: File, chunk: number) => ({
      durationMs: 700_000,
      count: Math.ceil(700 / chunk),
      chunk: (i: number) => ({
        index: i,
        offsetMs: i * chunk * 1000,
        durationMs: Math.min(chunk, 700 - i * chunk) * 1000,
        wav: new Uint8Array([82, 73, 70, 70])
      })
    }));
    const { b } = bridge(vi.fn(), { pickFile: async () => file, decode });
    const opened = await b.media.open();
    expect(opened).toMatchObject({ ok: true, value: { name: "aula.mp4", kind: "video" } });
    const token = opened.ok && opened.value ? opened.value.token : "";
    const segments = await b.media.extract(token, 600, "mp3");
    expect(decode).toHaveBeenCalledWith(file, 300);
    expect(segments.ok && segments.value.map((s) => [s.offsetMs, s.mimeType])).toEqual([
      [0, "audio/wav"],
      [300_000, "audio/wav"],
      [600_000, "audio/wav"]
    ]);
    const bytes = await b.media.readSegment(token, 0);
    expect(bytes.ok && new Uint8Array(bytes.value)[0]).toBe(82);
  });
});
