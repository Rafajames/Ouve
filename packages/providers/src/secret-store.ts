/**
 * Porta de armazenamento de credenciais. Implementações:
 * - desktop: Electron safeStorage (DPAPI no Windows), no processo principal;
 * - extensão: storage local do navegador (proteção limitada, documentada).
 * Segredos nunca entram em ProviderConfig, logs ou exportações.
 */
export interface SecretStore {
  /** Indica se há criptografia do sistema operacional disponível. */
  readonly protection: "os-encrypted" | "browser-profile" | "memory-only";
  get(ref: string): Promise<string | undefined>;
  set(ref: string, secret: string): Promise<void>;
  delete(ref: string): Promise<void>;
}

/** Usado quando não há proteção do SO: a chave vale só até fechar o aplicativo. */
export class MemorySecretStore implements SecretStore {
  readonly protection = "memory-only" as const;
  private readonly secrets = new Map<string, string>();
  async get(ref: string) {
    return this.secrets.get(ref);
  }
  async set(ref: string, secret: string) {
    this.secrets.set(ref, secret);
  }
  async delete(ref: string) {
    this.secrets.delete(ref);
  }
}

export function credentialRefFor(providerId: string): string {
  return `ouve.provider.${providerId}`;
}
