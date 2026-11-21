import type { ProviderConfig } from "@ouve/core";
import { credentialRefFor, presetFor, type SecretStore } from "@ouve/providers";

/**
 * Armazenamento da extensão (chrome.storage.local). Somente preferências,
 * configurações de provedores e chaves — nunca áudio, transcrição ou relatório.
 * As chaves ficam no perfil do navegador, SEM criptografia do sistema
 * operacional (limitação documentada em docs/09 e exibida na interface).
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

export class ExtensionStorage {
  constructor(private readonly area: StorageAreaLike = localArea()) {}

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
    const area = this.area;
    const key = (ref: string) => `secret:${ref}`;
    return {
      protection: "browser-profile",
      async get(ref) {
        const value = (await area.get(key(ref)))[key(ref)];
        return typeof value === "string" ? value : undefined;
      },
      async set(ref, secret) {
        await area.set({ [key(ref)]: secret });
      },
      async delete(ref) {
        await area.remove(key(ref));
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
