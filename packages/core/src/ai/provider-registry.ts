export interface IdentifiedProvider {
  readonly id: string;
}

export class ProviderRegistry<T extends IdentifiedProvider> {
  private readonly providers = new Map<string, T>();

  register(provider: T): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  get(id: string): T | undefined {
    return this.providers.get(id);
  }

  list(): T[] {
    return [...this.providers.values()];
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  unregister(id: string): boolean {
    return this.providers.delete(id);
  }
}
