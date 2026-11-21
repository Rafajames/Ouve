import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decodeFile } from "../src/app/file-decoder";
import { ExtensionStorage, originPatternFor, type StorageAreaLike } from "../src/app/storage";

function memoryArea(): StorageAreaLike & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, data[k]]));
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
    }
  };
}

const manifest = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "public", name), "utf8"));

describe("manifestos", () => {
  it("pedem permissões mínimas e nenhuma permissão de captura de tela", () => {
    const chrome = manifest("manifest.json");
    const firefox = manifest("manifest.firefox.json");
    expect(chrome.permissions.sort()).toEqual(["activeTab", "storage", "tabCapture"]);
    expect(firefox.permissions.sort()).toEqual(["activeTab", "storage"]);
    for (const m of [chrome, firefox]) {
      expect(m.permissions).not.toContain("desktopCapture");
      expect(m.host_permissions).toBeUndefined();
      expect(m.version).toBe("0.2.0");
    }
  });
});

describe("armazenamento da extensão", () => {
  it("separa chave da configuração", async () => {
    const area = memoryArea();
    const storage = new ExtensionStorage(area);
    const config = {
      id: "p1",
      displayName: "OpenAI",
      protocol: "openai" as const,
      model: "m",
      enabledTasks: ["analysis" as const],
      apiKey: "sk-vazou"
    };
    await storage.saveProvider(config as never);
    await storage.secrets().set("ouve.provider.p1", "sk-segura");
    expect(JSON.stringify(area.data.providers)).not.toContain("sk-");
    expect(await storage.secrets().get("ouve.provider.p1")).toBe("sk-segura");
    await storage.removeProvider("p1");
    expect(await storage.secrets().get("ouve.provider.p1")).toBeUndefined();
  });

  it("limita a duração de bloco e calcula a origem do provedor", async () => {
    const storage = new ExtensionStorage(memoryArea());
    await storage.saveSettings({ language: "pt-BR", liveChunkSeconds: 1 });
    expect((await storage.settings()).liveChunkSeconds).toBe(5);
    expect(originPatternFor({ id: "x", displayName: "x", model: "m", protocol: "gemini", enabledTasks: [] })).toBe(
      "https://generativelanguage.googleapis.com/*"
    );
    expect(
      originPatternFor({ id: "x", displayName: "x", model: "m", protocol: "custom", baseUrl: "http://localhost:8080/v1", enabledTasks: [] })
    ).toBe("http://localhost/*");
  });
});

describe("decodificação de arquivos", () => {
  const file = (name: string, size = 10) => ({ name, size, arrayBuffer: async () => new ArrayBuffer(8) });
  const factory =
    (seconds: number, channels = 2) =>
    () => ({
      decodeAudioData: vi.fn(async () => ({
        numberOfChannels: channels,
        length: seconds * 16_000,
        sampleRate: 16_000,
        getChannelData: () => new Float32Array(seconds * 16_000).fill(0.5)
      }))
    });

  it("gera blocos WAV sob demanda com offsets", async () => {
    const decoded = await decodeFile(file("a.webm"), 120, factory(250));
    expect(decoded.count).toBe(3);
    const last = decoded.chunk(2);
    expect(last.offsetMs).toBe(240_000);
    expect(last.durationMs).toBe(10_000);
    expect(new TextDecoder().decode(last.wav.slice(0, 4))).toBe("RIFF");
  });

  it("recusa formato, tamanho e duração acima do limite da extensão", async () => {
    await expect(decodeFile(file("a.exe"), 120, factory(1))).rejects.toMatchObject({ code: "invalid-input" });
    await expect(decodeFile(file("a.wav", 400 * 1024 * 1024), 120, factory(1))).rejects.toThrow(/300 MB/);
    await expect(decodeFile(file("a.wav"), 120, factory(3 * 3600, 1))).rejects.toMatchObject({ code: "duration-exceeded" });
  });
});
