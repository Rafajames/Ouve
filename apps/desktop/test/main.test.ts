import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_LIMITS } from "@ouve/core";
import { MediaService, locateFfmpeg, parseDurationMs } from "../src/main/media-service";
import { ProviderService } from "../src/main/provider-service";
import { SafeStorageSecretStore, SettingsStore } from "../src/main/stores";
import { parseProviderConfig, parseSettings } from "../src/main/validate";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ouve-test-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const fakeSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(`enc:${Buffer.from(s).toString("base64")}`),
  decryptString: (b: Buffer) => Buffer.from(b.toString().slice(4), "base64").toString()
};

describe("validação IPC", () => {
  it("rejeita configurações maliciosas", () => {
    expect(() => parseProviderConfig({ id: "../x", displayName: "a", model: "m", protocol: "openai", enabledTasks: [] })).toThrow();
    expect(() => parseProviderConfig({ id: "a", displayName: "a", model: "m", protocol: "shell", enabledTasks: [] })).toThrow();
    const c = parseProviderConfig({
      id: "a",
      displayName: " A\u0000 ",
      model: "m",
      protocol: "openai",
      enabledTasks: ["analysis", "rm -rf"],
      extraHeaders: { "X-Ok": "1", "bad header": "x" }
    });
    expect(c).toMatchObject({ displayName: "A", enabledTasks: ["analysis"], extraHeaders: { "X-Ok": "1" } });
  });
  it("normaliza configurações fora da faixa", () => {
    expect(parseSettings({ liveChunkSeconds: 1, language: "pt-BR; drop" })).toMatchObject({
      liveChunkSeconds: 20,
      language: "pt-BR",
      theme: "system"
    });
    expect(parseSettings({ theme: "light" }).theme).toBe("light");
    expect(parseSettings({ theme: "neon" }).theme).toBe("system");
  });
});

describe("cofre de credenciais", () => {
  it("cifra no disco e nunca grava a chave em texto puro", async () => {
    const path = join(dir, "credentials.json");
    const store = new SafeStorageSecretStore(path, fakeSafe);
    await store.set("ref", "sk-segredo-123");
    expect(await readFile(path, "utf8")).not.toContain("sk-segredo-123");
    expect(await store.get("ref")).toBe("sk-segredo-123");
    await store.delete("ref");
    expect(await store.get("ref")).toBeUndefined();
  });
  it("usa somente memória sem criptografia do SO", async () => {
    const path = join(dir, "none.json");
    const store = new SafeStorageSecretStore(path, { ...fakeSafe, isEncryptionAvailable: () => false });
    await store.set("ref", "k");
    expect(store.protection).toBe("memory-only");
    expect(existsSync(path)).toBe(false);
  });
});

describe("ProviderService", () => {
  it("salva configuração sem segredo e executa chamadas no processo principal", async () => {
    const settings = new SettingsStore(join(dir, "prov"));
    const secrets = new SafeStorageSecretStore(join(dir, "prov", "c.json"), fakeSafe);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })));
    const service = new ProviderService(settings, secrets, fetch);
    const saved = await service.save({
      config: { id: "p1", displayName: "OpenAI", protocol: "openai", model: "gpt", enabledTasks: ["analysis"] },
      apiKey: "sk-abc12345678"
    });
    expect(saved.hasKey).toBe(true);
    expect(await readFile(join(dir, "prov", "providers.json"), "utf8")).not.toContain("sk-abc");
    await expect(service.complete("r1", "p1", { messages: [{ role: "user", content: "x" }], json: true })).resolves.toBe("{}");
    await expect(service.transcribe("r2", "p1", { audio: new Uint8Array(1), mimeType: "audio/wav", durationMs: 1 })).rejects.toMatchObject({
      code: "unsupported"
    });
    await service.remove("p1");
    expect(await service.list()).toEqual([]);
  });
});

describe("configuração rápida", () => {
  it("salva o Gemini a partir só da chave e seleciona para transcrição e análise", async () => {
    const settings = new SettingsStore(join(dir, "rapido"));
    const secrets = new SafeStorageSecretStore(join(dir, "rapido", "c.json"), fakeSafe);
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ models: [{ name: "models/gemini-3.7-flash" }, { name: "models/gemini-3.5-transcribe" }] }))
    );
    const service = new ProviderService(settings, secrets, fetch);
    const outcome = await service.quickSetup("AIzaSyD12345678901234567890123456789");
    expect(outcome).toMatchObject({ ok: true, providerName: "Google Gemini", canTranscribe: true });
    const [summary] = await service.list();
    expect(summary).toMatchObject({
      hasKey: true,
      config: { protocol: "gemini", model: "gemini-3.7-flash", transcriptionModel: "gemini-3.5-transcribe" }
    });
    const saved = await settings.getSettings();
    expect(saved.transcriptionProviderId).toBe(summary?.config.id);
    expect(saved.analysisProviderId).toBe(summary?.config.id);
    expect(await readFile(join(dir, "rapido", "providers.json"), "utf8")).not.toContain("AIza");
    // Nova chave do mesmo provedor substitui a anterior.
    await service.quickSetup("AIzaSyD99999999999999999999999999999");
    expect(await service.list()).toHaveLength(1);
  });
});

describe("MediaService (ffmpeg real)", () => {
  const ffmpeg = locateFfmpeg();
  let available = true;
  try {
    execFileSync(ffmpeg, ["-version"], { stdio: "ignore" });
  } catch {
    available = false;
  }

  it("interpreta duração do ffmpeg", () => {
    expect(parseDurationMs("  Duration: 01:02:03.50, start")).toBe(3_723_500);
  });

  it.skipIf(!available)(
    "extrai somente o áudio de um vídeo em segmentos e limpa temporários",
    async () => {
      const video = join(dir, "amostra.mp4");
      execFileSync(ffmpeg, [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=64x64:rate=5",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440",
        "-t",
        "5",
        "-c:v",
        "mpeg4",
        "-c:a",
        "aac",
        "-shortest",
        video
      ]);
      const service = new MediaService(ffmpeg);
      const media = await service.register(video, DEFAULT_MEDIA_LIMITS);
      expect(media.kind).toBe("video");
      expect(media.durationMs).toBeGreaterThan(4000);
      const progress = vi.fn();
      const segments = await service.extract(media.token, 2, progress);
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(segments[1]?.offsetMs).toBeCloseTo(2000, -2);
      const wav = await service.readSegment(media.token, 0);
      expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
      expect(new DataView(wav.buffer, wav.byteOffset).getUint16(22, true)).toBe(1); // mono
      const before = (await readdir(tmpdir())).filter((f) => f.startsWith("ouve-")).length;
      await service.release(media.token);
      const after = (await readdir(tmpdir())).filter((f) => f.startsWith("ouve-")).length;
      expect(after).toBeLessThan(before);
    },
    30_000
  );

  it.skipIf(!available)(
    "recusa vídeo sem áudio e formato não suportado",
    async () => {
      const mute = join(dir, "mudo.mp4");
      execFileSync(ffmpeg, [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=64x64:rate=5",
        "-t",
        "1",
        "-c:v",
        "mpeg4",
        mute
      ]);
      const service = new MediaService(ffmpeg);
      await expect(service.register(mute, DEFAULT_MEDIA_LIMITS)).rejects.toMatchObject({ code: "no-audio" });
      await expect(service.register(join(dir, "credentials.json"), DEFAULT_MEDIA_LIMITS)).rejects.toMatchObject({ code: "invalid-input" });
    },
    30_000
  );
});
