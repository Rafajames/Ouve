/**
 * Porta de armazenamento de credenciais. Implementações:
 * - desktop: Electron safeStorage (DPAPI no Windows), no processo principal;
 * - extensão: storage local do navegador (proteção limitada, documentada).
 * Segredos nunca entram em ProviderConfig, logs ou exportações.
 */
/**
 * - os-encrypted: criptografia do sistema (desktop);
 * - session-only: só enquanto a aba/navegador estiver aberto (padrão na web e na extensão);
 * - browser-profile: lembrada no perfil do navegador, sem criptografia do sistema (opção do usuário);
 * - memory-only: só até fechar o aplicativo.
 */
export type SecretProtectionLevel = "os-encrypted" | "session-only" | "browser-profile" | "memory-only";

export interface SecretStore {
  /** Indica se há criptografia do sistema operacional disponível. */
  readonly protection: SecretProtectionLevel;
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

/** Armazenamento chave-valor assíncrono mínimo (sessionStorage, localStorage, chrome.storage). */
export interface AsyncKeyValue {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Chaves na web e na extensão: por padrão ficam só na sessão (somem ao fechar a
 * aba ou o navegador). O usuário pode escolher “lembrar neste navegador”, com
 * aviso explícito de que não há criptografia do sistema operacional.
 * A leitura procura nos dois lugares, para não perder chaves já salvas.
 */
export class SwitchableSecretStore implements SecretStore {
  private remember: boolean;
  constructor(
    private readonly session: AsyncKeyValue,
    private readonly persistent: AsyncKeyValue,
    remember: boolean,
    private readonly onRememberChange?: (remember: boolean) => Promise<void> | void
  ) {
    this.remember = remember;
  }

  get protection(): SecretProtectionLevel {
    return this.remember ? "browser-profile" : "session-only";
  }

  get remembering(): boolean {
    return this.remember;
  }

  async get(ref: string): Promise<string | undefined> {
    return (await this.session.get(ref)) ?? (await this.persistent.get(ref));
  }

  async set(ref: string, secret: string): Promise<void> {
    const [target, other] = this.remember ? [this.persistent, this.session] : [this.session, this.persistent];
    await target.set(ref, secret);
    await other.delete(ref);
  }

  async delete(ref: string): Promise<void> {
    await this.session.delete(ref);
    await this.persistent.delete(ref);
  }

  /** Troca o modo e move as chaves conhecidas para o novo local. */
  async setRemember(remember: boolean, refs: string[]): Promise<void> {
    if (remember === this.remember) return;
    const values = await Promise.all(refs.map(async (ref) => [ref, await this.get(ref)] as const));
    this.remember = remember;
    for (const [ref, value] of values) if (value) await this.set(ref, value);
    await this.onRememberChange?.(remember);
  }
}
