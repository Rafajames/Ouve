import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProviderConfig } from "@ouve/core";
import { MemorySecretStore, type SecretStore } from "@ouve/providers";
import { createLogger } from "@ouve/shared";
import { DEFAULT_SETTINGS, type AppSettings } from "../shared/ipc.js";
import { parseProviderConfig, parseSettings } from "./validate.js";

const log = createLogger("stores");

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Escrita atômica (arquivo temporário + rename). */
async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, path);
}

/**
 * Preferências e configurações de provedores (sem segredos). Não armazena
 * conteúdo de reuniões: o MVP não tem histórico permanente.
 */
export class SettingsStore {
  constructor(private readonly dir: string) {}

  async getSettings(): Promise<AppSettings> {
    return parseSettings(await readJsonFile(join(this.dir, "settings.json"), DEFAULT_SETTINGS));
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const clean = parseSettings(settings);
    await writeJsonFile(join(this.dir, "settings.json"), clean);
    return clean;
  }

  async listProviders(): Promise<ProviderConfig[]> {
    const raw = await readJsonFile<unknown[]>(join(this.dir, "providers.json"), []);
    const out: ProviderConfig[] = [];
    for (const entry of Array.isArray(raw) ? raw : []) {
      try {
        out.push(parseProviderConfig(entry));
      } catch {
        log.warn("Configuração de provedor inválida ignorada.");
      }
    }
    return out;
  }

  async saveProviders(list: ProviderConfig[]): Promise<void> {
    await writeJsonFile(join(this.dir, "providers.json"), list);
  }
}

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/**
 * Credenciais cifradas com Electron safeStorage (DPAPI no Windows, Keychain no
 * macOS, libsecret no Linux). Sem criptografia disponível, as chaves ficam só
 * em memória até o aplicativo fechar — nunca em texto puro no disco.
 */
export class SafeStorageSecretStore implements SecretStore {
  readonly protection: SecretStore["protection"];
  private readonly memory = new MemorySecretStore();

  constructor(
    private readonly path: string,
    private readonly safe: SafeStorageLike
  ) {
    this.protection = safe.isEncryptionAvailable() ? "os-encrypted" : "memory-only";
  }

  private async load(): Promise<Record<string, string>> {
    return readJsonFile<Record<string, string>>(this.path, {});
  }

  async get(ref: string): Promise<string | undefined> {
    if (this.protection === "memory-only") return this.memory.get(ref);
    const encrypted = (await this.load())[ref];
    if (!encrypted) return undefined;
    try {
      return this.safe.decryptString(Buffer.from(encrypted, "base64"));
    } catch {
      log.warn("Não foi possível decifrar uma credencial; será necessário informá-la novamente.");
      return undefined;
    }
  }

  async set(ref: string, secret: string): Promise<void> {
    if (this.protection === "memory-only") return this.memory.set(ref, secret);
    const all = await this.load();
    all[ref] = this.safe.encryptString(secret).toString("base64");
    await writeJsonFile(this.path, all);
  }

  async delete(ref: string): Promise<void> {
    if (this.protection === "memory-only") return this.memory.delete(ref);
    const all = await this.load();
    delete all[ref];
    await writeJsonFile(this.path, all);
  }
}
