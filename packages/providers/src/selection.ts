import type { ProviderConfig } from "@ouve/core";

export interface ProviderSelection {
  transcriptionProviderId?: string;
  analysisProviderId?: string;
}

/**
 * Corrige escolhas de provedor que apontam para um provedor que não existe mais
 * (ex.: chave nova do Gemini substituiu a antiga, provedor removido). Se a escolha
 * estiver vazia ou órfã e só existir um provedor apto para a tarefa, ele é escolhido.
 */
export function reconcileProviderSelection<T extends ProviderSelection>(settings: T, providers: readonly ProviderConfig[]): T {
  const next: ProviderSelection = { ...settings };
  const pick = (field: keyof ProviderSelection, task: "transcription" | "analysis") => {
    const current = next[field];
    if (current && providers.some((p) => p.id === current)) return;
    delete next[field];
    const able = providers.filter((p) => p.enabledTasks.includes(task));
    if (able[0] && able.length === 1) next[field] = able[0].id;
  };
  pick("transcriptionProviderId", "transcription");
  pick("analysisProviderId", "analysis");
  return next as T;
}
