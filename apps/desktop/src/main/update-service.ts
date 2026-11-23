import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OuveError, createLogger } from "@ouve/shared";
import type { UpdateInfo } from "../shared/ipc.js";

const log = createLogger("updates");

/**
 * Atualização MANUAL (D-070): o usuário clica em "Verificar atualizações" e,
 * se quiser, em "Baixar e instalar". Nada é verificado ou instalado sozinho.
 * Compara o commit embutido no build com o da pré-release publicada.
 */
export const RELEASE_API = "https://api.github.com/repos/Rafajames/Ouve/releases/tags/teste-windows";
export const RELEASE_PAGE = "https://github.com/Rafajames/Ouve/releases/tag/teste-windows";

interface ReleaseJson {
  body?: string;
  target_commitish?: string;
  published_at?: string;
  assets?: Array<{ name?: string; browser_download_url?: string; updated_at?: string }>;
}

export interface UpdateDeps {
  fetch: typeof fetch;
  currentBuild: string;
  /** Executa o instalador baixado (desacoplado) e encerra o app. */
  launchInstaller: (path: string) => void;
}

export function parseRelease(json: ReleaseJson): { build?: string; downloadUrl?: string; publishedAt?: string } {
  const fromNotes = /commit ([0-9a-f]{7,40})/i.exec(json.body ?? "")?.[1];
  const fromTarget = /^[0-9a-f]{7,40}$/i.test(json.target_commitish ?? "") ? json.target_commitish : undefined;
  const asset = (json.assets ?? []).find((a) => a.name?.toLowerCase().endsWith(".exe"));
  const build = (fromNotes ?? fromTarget)?.slice(0, 7);
  const publishedAt = asset?.updated_at ?? json.published_at;
  return {
    ...(build ? { build } : {}),
    ...(asset?.browser_download_url ? { downloadUrl: asset.browser_download_url } : {}),
    ...(publishedAt ? { publishedAt } : {})
  };
}

export class UpdateService {
  private latest?: UpdateInfo;

  constructor(private readonly deps: UpdateDeps) {}

  async check(): Promise<UpdateInfo> {
    let response: Response;
    try {
      response = await this.deps.fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Ouve-Desktop" } });
    } catch (error) {
      throw new OuveError("network", "Sem conexão para verificar atualizações.", { cause: error });
    }
    if (!response.ok) throw new OuveError("provider-unavailable", `Não foi possível verificar atualizações (HTTP ${response.status}).`);
    const release = parseRelease((await response.json()) as ReleaseJson);
    const current = this.deps.currentBuild;
    const isDev = current === "dev";
    const available = !isDev && !!release.build && release.build !== current.slice(0, 7) && !!release.downloadUrl;
    const info: UpdateInfo = {
      currentBuild: current,
      available,
      message: isDev
        ? "Versão de desenvolvimento: as atualizações valem só para o aplicativo instalado."
        : available
          ? "Nova versão disponível."
          : "Você já está na versão mais recente.",
      ...(release.build ? { latestBuild: release.build } : {}),
      ...(release.publishedAt ? { publishedAt: release.publishedAt } : {}),
      ...(release.downloadUrl ? { downloadUrl: release.downloadUrl } : {})
    };
    this.latest = info;
    return info;
  }

  /** Baixa o instalador para uma pasta temporária, com progresso, e o executa. */
  async install(onProgress: (percent: number) => void): Promise<string> {
    const info = this.latest?.available ? this.latest : await this.check();
    if (!info.available || !info.downloadUrl) throw new OuveError("invalid-input", "Não há atualização disponível.", { retryable: false });
    const response = await this.deps.fetch(info.downloadUrl, { headers: { "User-Agent": "Ouve-Desktop" } });
    if (!response.ok || !response.body) throw new OuveError("network", `Falha ao baixar a atualização (HTTP ${response.status}).`);
    const total = Number(response.headers.get("content-length") ?? 0);
    const dir = await mkdtemp(join(tmpdir(), "ouve-update-"));
    const target = join(dir, "Ouve-Setup.exe");
    const file = createWriteStream(target);
    const reader = response.body.getReader();
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (!file.write(value)) await new Promise<void>((r) => file.once("drain", () => r()));
        if (total > 0) onProgress(Math.min(100, Math.round((received / total) * 100)));
      }
    } finally {
      await new Promise<void>((resolve) => file.end(() => resolve()));
    }
    if (total > 0 && received < total) throw new OuveError("network", "Download da atualização incompleto. Tente novamente.");
    log.info("Atualização baixada.", { bytes: received });
    this.deps.launchInstaller(target);
    return target;
  }
}
