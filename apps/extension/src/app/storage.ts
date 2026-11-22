import type { ProviderConfig } from "@ouve/core";
import { credentialRefFor, presetFor, type SecretStore } from "@ouve/providers";

/**
 * Armazenamento da extensão (chrome.storage.local). Somente preferências,
 * configurações de provedores e chaves — nunca áudio, transcrição ou relatório.
 * Chaves: por padrão em chrome.storage.session (memória, somem ao fechar o
 * navegador). “Lembrar neste navegador” as guarda no storage local, SEM
 * criptografia do sistema operacional — escolha do usuário, com aviso.
 */
export interface ExtSettings {
  language: string;
  transcriptionProviderId?: string;
  analysisProviderId?: string;
  liveChunkSeconds: number;
  /** Versão do termo aceita no primeiro uso (D-063). */
  termsAcceptedVersion?: number;
}

export const DEFAULT_EXT_SETTINGS: ExtSettings = { language: "pt-BR", liveChunkSeconds: 20 };

export interface StorageAreaLike {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export function localArea(): StorageAreaLike {
  return chrome.storage.local as unknown as StorageAreaLike;
}

/** chrome.storage.session quando disponível (Chrome 102+, Firefox 115+). */
export function sessionArea(): StorageAreaLike | undefined {
  return (globalThis as { chrome?: { storage?: { session?: unknown } } }).chrome?.storage?.session as StorageAreaLike | undefined;
}

function memoryArea(): StorageAreaLike {
  const map = new Map<string, unknown>();
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) if (map.has(k)) out[k] = map.get(k);
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) map.set(k, v);
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) map.delete(k);
    }
  };
}

export class ExtensionStorage {
  private readonly session: StorageAreaLike;
  constructor(
    private readonly area: StorageAreaLike = localArea(),
    session: StorageAreaLike | undefined = sessionArea()
  ) {
    this.session = session ?? memoryArea();
  }

  /** Lembrar chaves no navegador? Quem já tinha chave salva no local continua lembrando. */
  async rememberKeys(): Promise<boolean> {
    const { rememberKeys } = await this.area.get("rememberKeys");
    if (typeof rememberKeys === "boolean") return rememberKeys;
    const all = await this.area.get((await this.providers()).map((p) => `secret:${credentialRefFor(p.id)}`));
    return Object.values(all).some((v) => typeof v === "string" && v);
  }

  async setRememberKeys(remember: boolean): Promise<void> {
    const store = this.secrets();
    const refs = (await this.providers()).map((p) => credentialRefFor(p.id));
    const values = await Promise.all(refs.map(async (ref) => [ref, await store.get(ref)] as const));
    await this.area.set({ rememberKeys: remember });
    for (const [ref, value] of values) if (value) await store.set(ref, value);
  }

  async settings(): Promise<ExtSettings> {
    const { settings } = await this.area.get("settings");
    return { ...DEFAULT_EXT_SETTINGS, ...((settings as Partial<ExtSettings>) ?? {}) };
  }

  async saveSettings(settings: ExtSettings): Promise<void> {
    const chunk = Math.min(120, Math.max(5, Math.round(settings.liveChunkSeconds)));
    await this.area.set({ settings: { ...settings, liveChunkSeconds: chunk } });
  }

  async providers(): Promise<ProviderConfig[]> {
    const { providers } = await this.area.get("providers");
    return Array.isArray(providers) ? (providers as ProviderConfig[]) : [];
  }

  async saveProvider(config: ProviderConfig): Promise<void> {
    const list = (await this.providers()).filter((p) => p.id !== config.id);
    // Nunca persiste segredo dentro da configuração.
    const clean = { ...config, credentialRef: credentialRefFor(config.id) } as ProviderConfig & { apiKey?: unknown };
    delete clean.apiKey;
    await this.area.set({ providers: [...list, clean] });
  }

  async removeProvider(id: string): Promise<void> {
    await this.area.set({ providers: (await this.providers()).filter((p) => p.id !== id) });
    await this.secrets().delete(credentialRefFor(id));
  }

  secrets(): SecretStore {
    const local = this.area;
    const session = this.session;
    const key = (ref: string) => `secret:${ref}`;
    const rememberKeys = () => this.rememberKeys();
    const read = async (area: StorageAreaLike, ref: string) => {
      const value = (await area.get(key(ref)))[key(ref)];
      return typeof value === "string" ? value : undefined;
    };
    return {
      protection: "session-only",
      async get(ref) {
        return (await read(session, ref)) ?? (await read(local, ref));
      },
      async set(ref, secret) {
        const remember = await rememberKeys();
        await (remember ? local : session).set({ [key(ref)]: secret });
        await (remember ? session : local).remove(key(ref));
      },
      async delete(ref) {
        await session.remove(key(ref));
        await local.remove(key(ref));
      }
    };
  }
}

/** Origem que precisa de permissão de host para o provedor (permissões opcionais, pedidas sob demanda). */
export function originPatternFor(config: ProviderConfig): string | undefined {
  const base = config.baseUrl?.trim() || presetFor(config.protocol).defaultBaseUrl;
  try {
    const url = new URL(base);
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return undefined;
  }
}
