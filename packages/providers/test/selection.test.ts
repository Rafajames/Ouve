import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@ouve/core";
import { reconcileProviderSelection, type ProviderSelection } from "../src/selection";

const gemini = { id: "rapido-b", enabledTasks: ["transcription", "analysis", "report"] } as ProviderConfig;
const ollama = { id: "local-ollama", enabledTasks: ["analysis", "report"] } as ProviderConfig;

describe("reconcileProviderSelection", () => {
  it("troca escolha órfã pelo único provedor apto", () => {
    const r = reconcileProviderSelection({ transcriptionProviderId: "rapido-a", analysisProviderId: "rapido-a" }, [gemini]);
    expect(r).toEqual({ transcriptionProviderId: "rapido-b", analysisProviderId: "rapido-b" });
  });
  it("mantém escolhas válidas", () => {
    const r = reconcileProviderSelection({ transcriptionProviderId: "rapido-b", analysisProviderId: "local-ollama" }, [gemini, ollama]);
    expect(r).toEqual({ transcriptionProviderId: "rapido-b", analysisProviderId: "local-ollama" });
  });
  it("limpa escolha órfã quando há mais de um apto", () => {
    const sel: ProviderSelection = { analysisProviderId: "sumiu" };
    const r = reconcileProviderSelection(sel, [gemini, ollama]);
    expect(r.analysisProviderId).toBeUndefined();
    expect(r.transcriptionProviderId).toBe("rapido-b");
  });
});
