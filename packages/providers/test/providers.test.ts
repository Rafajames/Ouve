import { describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "@ouve/core";
import {
  RateLimiter,
  createProviderBundle,
  parseGeminiSegments,
  parseOpenAiTranscription,
  responseFormatFor,
  sendRequest,
  validateProviderConfig
} from "../src/index.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const wav = new Blob([new Uint8Array(100)], { type: "audio/wav" });

function config(partial: Partial<ProviderConfig>): ProviderConfig {
  return { id: "p1", displayName: "Teste", model: "m", protocol: "openai", enabledTasks: ["transcription", "analysis"], ...partial };
}

describe("validação de configuração", () => {
  it("exige endpoint para compatível e recusa cabeçalhos de autenticação", () => {
    const errors = validateProviderConfig(config({ protocol: "openai-compatible", extraHeaders: { Authorization: "x" } }));
    expect(errors.join(" ")).toMatch(/endpoint/);
    expect(errors.join(" ")).toMatch(/Cabeçalho não permitido/);
  });
  it("recusa serviço não oferecido", () => {
    expect(validateProviderConfig(config({ protocol: "anthropic", enabledTasks: ["transcription"] })).join(" ")).toMatch(/não oferece/);
  });
  it("exige chave exceto em servidor local", () => {
    expect(() => createProviderBundle(config({}), undefined, vi.fn())).toThrow(/Chave/);
    expect(() =>
      createProviderBundle(
        config({ protocol: "openai-compatible", baseUrl: "http://localhost:11434/v1", enabledTasks: ["analysis"] }),
        undefined,
        vi.fn()
      )
    ).not.toThrow();
  });
});

describe("OpenAI", () => {
  it("escolhe formato de resposta por modelo", () => {
    expect(responseFormatFor("whisper-1")).toBe("verbose_json");
    expect(responseFormatFor("gpt-4o-transcribe-diarize")).toBe("diarized_json");
    expect(responseFormatFor("gpt-4o-transcribe")).toBe("json");
  });
  it("normaliza segmentos, falantes e confiança", () => {
    const r = parseOpenAiTranscription(
      { language: "portuguese", segments: [{ start: 1, end: 2.5, text: "oi", avg_logprob: -0.1, speaker: "A" }] },
      5000
    );
    expect(r.segments[0]).toMatchObject({ startMs: 1000, endMs: 2500, text: "oi", speakerLabel: "A" });
    expect(r.segments[0]?.confidence).toBeCloseTo(0.905, 2);
    expect(parseOpenAiTranscription({ text: "tudo" }, 5000).segments).toEqual([{ startMs: 0, endMs: 5000, text: "tudo" }]);
    expect(() => parseOpenAiTranscription({}, 1)).toThrow();
  });
  it("envia multipart com autenticação e idioma", async () => {
    const fetch = vi.fn(async () => json({ text: "olá" }));
    const bundle = createProviderBundle(config({ transcriptionModel: "gpt-4o-transcribe" }), { apiKey: "sk-test" }, fetch);
    const result = await bundle.transcription!.transcribe({ audio: wav, mimeType: "audio/wav", durationMs: 3000, language: "pt-BR" });
    expect(result.segments[0]?.text).toBe("olá");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect((init.body as FormData).get("language")).toBe("pt");
  });
  it("tenta sem response_format se o servidor compatível recusar", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 400 }))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: "{}" } }] }));
    const bundle = createProviderBundle(
      config({ protocol: "openai-compatible", baseUrl: "https://llm.local.exemplo/v1", enabledTasks: ["analysis"] }),
      { apiKey: "k" },
      fetch
    );
    await expect(bundle.completion!.complete({ messages: [{ role: "user", content: "x" }], json: true })).resolves.toBe("{}");
    expect(JSON.parse((fetch.mock.calls[1]?.[1] as RequestInit).body as string).response_format).toBeUndefined();
  });
  it("teste de conexão lista modelos e relata falha de autenticação", async () => {
    const ok = createProviderBundle(config({}), { apiKey: "k" }, async () => json({ data: [{ id: "whisper-1" }] }));
    expect(await ok.testConnection()).toMatchObject({ ok: true, models: ["whisper-1"] });
    const bad = createProviderBundle(config({}), { apiKey: "k" }, async () => new Response("", { status: 401 }));
    expect(await bad.testConnection()).toMatchObject({ ok: false, message: expect.stringMatching(/credencial recusada/) });
  });
});

describe("Gemini", () => {
  it("usa cabeçalho de chave e extrai texto", async () => {
    const fetch = vi.fn(async () => json({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }));
    const bundle = createProviderBundle(
      config({ protocol: "gemini", model: "gemini-x", enabledTasks: ["analysis"] }),
      { apiKey: "AIza-k" },
      fetch
    );
    await expect(
      bundle.completion!.complete({
        messages: [
          { role: "system", content: "s" },
          { role: "user", content: "u" }
        ],
        json: true
      })
    ).resolves.toBe('{"a":1}');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-x:generateContent");
    expect(url).not.toContain("key=");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIza-k");
  });
  it("limita timestamps estimados à duração do bloco", () => {
    const segs = parseGeminiSegments('```json\n{"segments":[{"start":1,"end":99,"speaker":"S1","text":"oi"},{"text":""}]}\n```', 5000);
    expect(segs).toEqual([{ startMs: 1000, endMs: 5000, text: "oi", speakerLabel: "S1" }]);
  });
});

describe("Anthropic", () => {
  it("envia versão da API e junta texto", async () => {
    const fetch = vi.fn(async () => json({ content: [{ type: "text", text: "ok" }] }));
    const bundle = createProviderBundle(config({ protocol: "anthropic", enabledTasks: ["analysis"] }), { apiKey: "sk-ant" }, fetch);
    expect(bundle.transcription).toBeUndefined();
    await expect(bundle.completion!.complete({ messages: [{ role: "user", content: "x" }], json: true })).resolves.toBe("ok");
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["anthropic-version"]).toBe("2023-06-01");
  });
});

describe("HTTP", () => {
  it("repete 503 e respeita cancelamento", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}"));
    const delay = vi.fn(async () => undefined);
    await sendRequest("https://x", {}, { fetch, providerName: "X", timeoutMs: 1000, retries: 2, delay });
    expect(fetch).toHaveBeenCalledTimes(2);

    const controller = new AbortController();
    controller.abort();
    await expect(
      sendRequest("https://x", {}, { fetch: vi.fn(), providerName: "X", timeoutMs: 1000, retries: 0, signal: controller.signal })
    ).rejects.toMatchObject({
      code: "cancelled"
    });
  });
  it("gera timeout", async () => {
    const fetch = (_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("a", "AbortError"))));
    await expect(sendRequest("https://x", {}, { fetch, providerName: "X", timeoutMs: 10, retries: 0 })).rejects.toMatchObject({
      code: "timeout"
    });
  });
  it("rate limiter espaça requisições", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(
      100,
      () => now,
      async (ms) => void waits.push(ms)
    );
    await limiter.acquire();
    await limiter.acquire();
    now = 50;
    await limiter.acquire();
    expect(waits).toEqual([100, 150]);
  });
});

describe("IA local", () => {
  it("detecta o Ollama aberto com modelos e o whisper.cpp fechado", async () => {
    const { probeLocalServers } = await import("../src/index.js");
    const fetchImpl = (async (url: string) => {
      if (url.includes("11434")) return new Response(JSON.stringify({ models: [{ name: "gemma3:4b", size: 3_300_000_000 }] }));
      throw new TypeError("connection refused");
    }) as unknown as typeof fetch;
    const r = await probeLocalServers(fetchImpl, 200);
    expect(r.find((x) => x.id === "ollama")).toEqual({
      id: "ollama",
      running: true,
      installedModels: [{ name: "gemma3:4b", sizeGb: 3.3 }]
    });
    expect(r.find((x) => x.id === "whisper-cpp")?.running).toBe(false);
  });

  it("recomenda modelos pelo hardware e gera configuração sem chave", async () => {
    const { adviseHardware, localProviderConfig, validateProviderConfig, createProviderBundle } = await import("../src/index.js");
    expect(adviseHardware({ ramGb: 4 }).level).toBe("modest");
    expect(adviseHardware({ ramGb: 12 }).analysisModel).toBe("gemma3:4b");
    expect(adviseHardware({}).level).toBe("unknown");
    const cfg = localProviderConfig("ollama", "gemma3:4b");
    expect(validateProviderConfig(cfg)).toEqual([]);
    expect(cfg.enabledTasks).toEqual(["analysis", "report"]);
    expect(() => createProviderBundle(cfg, undefined, fetch)).not.toThrow();
    expect(localProviderConfig("whisper-cpp", "").transcriptionModel).toBe("whisper-1");
  });
});

describe("teste de conexão de servidor só de transcrição", () => {
  it("não pede /models ao whisper.cpp local", async () => {
    const { createProviderBundle, localProviderConfig } = await import("../src");
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);
      return new Response("ok");
    };
    const result = await createProviderBundle(localProviderConfig("whisper-cpp", "small"), undefined, fetchImpl).testConnection();
    expect(result.ok).toBe(true);
    expect(urls[0]).not.toContain("/models");
  });
});
