import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LocalAiService } from "../src/main/local-ai-service";

const MB = 1e6;

function body(bytes: number): Response {
  const chunk = new Uint8Array(1024 * 1024);
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) return controller.close();
      const n = Math.min(chunk.length, bytes - sent);
      sent += n;
      controller.enqueue(chunk.subarray(0, n));
    }
  });
  return new Response(stream, { headers: { "content-length": String(bytes) } });
}

async function setup(platform: NodeJS.Platform = "win32") {
  const root = await mkdtemp(join(tmpdir(), "ouve-local-"));
  const resources = join(root, "resources");
  await mkdir(join(resources, "whisper"), { recursive: true });
  await writeFile(join(resources, "whisper", platform === "win32" ? "whisper-server.exe" : "whisper-server"), "");
  const child = Object.assign(new EventEmitter(), { exitCode: null as number | null, kill: vi.fn() });
  const spawnImpl = vi.fn(() => child);
  const openInstaller = vi.fn(async () => {});
  const urls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    urls.push(url);
    if (url.includes("huggingface")) return body(150 * MB);
    if (url.includes("ollama.com")) return body(25 * MB);
    if (url.includes("127.0.0.1")) return new Response("ok");
    throw new Error("inesperado");
  });
  const service = new LocalAiService({
    userDataDir: join(root, "data"),
    tempDir: root,
    resourcesPath: resources,
    platform,
    threads: 3,
    fetch: fetchImpl as unknown as typeof fetch,
    openInstaller,
    spawnImpl: spawnImpl as never
  });
  return { root, service, spawnImpl, openInstaller, urls, child };
}

describe("IA local gerenciada", () => {
  it("baixa o modelo com progresso, liga o servidor na porta própria e lembra o modelo", async () => {
    const { service, spawnImpl, urls } = await setup();
    const progress: number[] = [];
    await service.downloadModel("base", (_t, p) => progress.push(p));
    expect(urls[0]).toBe("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin");
    expect(progress.at(-1)).toBe(100);
    expect((await service.state()).installedModels).toEqual([{ name: "base", sizeMb: 150 }]);
    await service.startWhisper("base", "pt");
    const args = (spawnImpl.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).toEqual(expect.arrayContaining(["--port", "8178", "--inference-path", "/v1/audio/transcriptions", "-l", "pt", "-t", "3"]));
    const st = await service.state();
    expect(st).toMatchObject({ whisperBundled: true, whisperRunning: true, activeModel: "base" });
    await service.stopWhisper();
    expect((await service.state()).whisperRunning).toBe(false);
  });

  it("descarta download incompleto e recusa usar modelo não baixado", async () => {
    const { service, root } = await setup();
    const short = new LocalAiService({
      userDataDir: join(root, "data2"),
      tempDir: root,
      resourcesPath: join(root, "resources"),
      platform: "win32",
      threads: 1,
      fetch: (async () => body(10 * MB)) as unknown as typeof fetch,
      openInstaller: async () => {}
    });
    await expect(short.downloadModel("base", () => {})).rejects.toThrow(/incompleto/);
    expect(existsSync(join(root, "data2", "local-ai", "whisper", "ggml-base.bin.part"))).toBe(false);
    await expect(service.startWhisper("small")).rejects.toThrow(/Baixe o modelo/);
    await expect(service.ensureWhisper()).rejects.toThrow(/Nenhum modelo/);
  });

  it("baixa e abre o instalador do Ollama só no Windows", async () => {
    const { service, openInstaller, urls, root } = await setup();
    await service.installOllama(() => {});
    expect(urls[0]).toBe("https://ollama.com/download/OllamaSetup.exe");
    expect(openInstaller).toHaveBeenCalledWith(join(root, "OllamaSetup.exe"));
    const linux = await setup("linux");
    await expect(linux.service.installOllama(() => {})).rejects.toThrow(/só no Windows/);
    expect((await linux.service.state()).canInstallOllama).toBe(false);
  });

  it("informa quando a instalação não traz o whisper.cpp", async () => {
    const { root } = await setup();
    const none = new LocalAiService({
      userDataDir: root,
      tempDir: root,
      platform: "win32",
      threads: 1,
      fetch,
      openInstaller: async () => {}
    });
    expect((await none.state()).whisperBundled).toBe(false);
    await expect(none.startWhisper("base")).rejects.toThrow(/não está incluída/);
  });
});
