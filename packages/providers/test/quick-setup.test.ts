import { describe, expect, it, vi } from "vitest";
import {
  detectProtocolFromKey,
  parseDedicatedTranscription,
  parseOffsetMs,
  pickModels,
  runQuickSetup,
  GeminiTranscription
} from "../src/index.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("detecção do provedor pela chave", () => {
  it("reconhece os formatos principais", () => {
    expect(detectProtocolFromKey("sk-ant-api03-abcdefghijklmnop")).toBe("anthropic");
    expect(detectProtocolFromKey("xai-abcdefghijklmnop")).toBe("xai");
    expect(detectProtocolFromKey("AIzaSyD12345678901234567890123456789")).toBe("gemini");
    expect(detectProtocolFromKey("  sk-proj-abcdefghijklmnopqrstu  ")).toBe("openai");
    expect(detectProtocolFromKey("chave-qualquer")).toBeUndefined();
  });
});

describe("escolha de modelos", () => {
  it("prefere o modelo mais novo e evita variantes", () => {
    const gemini = pickModels("gemini", [
      "gemini-2.5-flash",
      "gemini-3.7-flash",
      "gemini-3.7-flash-lite",
      "gemini-3.8-flash-preview",
      "gemini-3.5-transcribe",
      "gemini-3.5-transcribe-live"
    ]);
    expect(gemini).toEqual({ model: "gemini-3.7-flash", transcriptionModel: "gemini-3.5-transcribe" });
    const openai = pickModels("openai", ["gpt-4o-mini", "gpt-5.1-mini", "gpt-5.1", "whisper-1", "gpt-4o-transcribe-diarize"]);
    expect(openai).toEqual({ model: "gpt-5.1-mini", transcriptionModel: "gpt-4o-transcribe-diarize" });
    expect(pickModels("anthropic", ["claude-haiku-4-5", "claude-sonnet-4-5-20250929", "claude-sonnet-5-20260101"]).model).toBe(
      "claude-sonnet-5-20260101"
    );
    expect(pickModels("xai", []).model).toBe("grok-4");
  });
});

describe("configuração rápida", () => {
  it("configura Gemini com transcrição, análise e aviso do plano gratuito", async () => {
    const fetch = vi.fn(async () => json({ models: [{ name: "models/gemini-3.7-flash" }, { name: "models/gemini-3.5-transcribe" }] }));
    const result = await runQuickSetup("AIzaSyD12345678901234567890123456789", fetch, "p1");
    expect(result).toMatchObject({
      ok: true,
      protocol: "gemini",
      canTranscribe: true,
      config: { model: "gemini-3.7-flash", transcriptionModel: "gemini-3.5-transcribe" }
    });
    expect(result.notes.join(" ")).toMatch(/plano gratuito/);
    expect(JSON.stringify(result.config)).not.toContain("AIza");
  });
  it("Claude configura só análise e avisa sobre transcrição", async () => {
    const result = await runQuickSetup("sk-ant-api03-abcdefghijklmnop", async () => json({ data: [{ id: "claude-sonnet-4-5" }] }), "p2");
    expect(result).toMatchObject({ ok: true, canTranscribe: false, config: { enabledTasks: ["analysis", "report"] } });
    expect(result.notes[0]).toMatch(/não transcreve/);
  });
  it("relata chave recusada e chave desconhecida", async () => {
    const bad = await runQuickSetup("sk-proj-abcdefghijklmnopqrstu", async () => new Response("", { status: 401 }), "p3");
    expect(bad).toMatchObject({ ok: false, message: expect.stringMatching(/credencial recusada/) });
    await expect(runQuickSetup("123", vi.fn(), "p4")).rejects.toMatchObject({ code: "invalid-input" });
  });
});

describe("Gemini transcribe dedicado", () => {
  it("agrupa palavras com tempo por falante e pausa", () => {
    expect(parseOffsetMs("1.250s")).toBe(1250);
    const segs = parseDedicatedTranscription(
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  audioTranscription: {
                    speakerLabel: "spk_1",
                    words: [
                      { word: "Bom", startOffset: "0.1s", endOffset: "0.3s" },
                      { word: "dia", startOffset: "0.3s", endOffset: "0.6s" },
                      { word: "senhores", startOffset: "3.0s", endOffset: "3.6s" }
                    ]
                  }
                },
                { audioTranscription: { speakerLabel: "spk_2", words: [{ word: "Obrigado", startOffset: "4.0s", endOffset: "4.5s" }] } }
              ]
            }
          }
        ]
      },
      10_000
    );
    expect(segs).toEqual([
      { startMs: 100, endMs: 600, text: "Bom dia", speakerLabel: "spk_1" },
      { startMs: 3000, endMs: 3600, text: "senhores", speakerLabel: "spk_1" },
      { startMs: 4000, endMs: 4500, text: "Obrigado", speakerLabel: "spk_2" }
    ]);
  });

  it("usa o modelo generativo se o dedicado recusar a requisição", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 400 }))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{"segments":[{"start":0,"end":1,"text":"oi"}]}' }] } }] }));
    const caps = { tasks: ["transcription" as const], streaming: false, diarization: true, segmentTimestamps: true, confidence: false };
    const t = new GeminiTranscription(
      {
        id: "g",
        baseUrl: "https://g.test/v1beta",
        apiKey: "AIza",
        model: "gemini-3.5-transcribe",
        fetch,
        timeoutMs: 1000,
        retries: 0,
        capabilities: caps
      },
      "gemini-3.7-flash"
    );
    const result = await t.transcribe({ audio: new Blob([new Uint8Array(4)]), mimeType: "audio/wav", durationMs: 2000, language: "pt-BR" });
    expect(result.segments[0]?.text).toBe("oi");
    expect(String(fetch.mock.calls[0]?.[0])).toContain("gemini-3.5-transcribe:generateContent");
    expect(JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string).generationConfig.audioTranscriptionConfig).toEqual({
      languageCodes: ["pt-BR"],
      diarization: true,
      wordTimestamp: true
    });
    expect(String(fetch.mock.calls[1]?.[0])).toContain("gemini-3.7-flash:generateContent");
  });
});
