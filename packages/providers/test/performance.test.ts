import { describe, expect, it } from "vitest";
import { PROFILE_SPECS, SPEAKER_MODELS, WHISPER_MODELS, cpuBenchmark, recommendProfile, resolveProfile, threadsFor } from "../src/index.js";

describe("perfis de desempenho", () => {
  it("escolhe pelo hardware", () => {
    expect(recommendProfile({ ramGb: 4, cores: 4 }).profile).toBe("leve");
    expect(recommendProfile({ ramGb: 8, cores: 2 }).profile).toBe("leve");
    expect(recommendProfile({ ramGb: 8, cores: 4 }).profile).toBe("equilibrado");
    expect(recommendProfile({ ramGb: 16, cores: 8 }).profile).toBe("maximo");
  });

  it("processador lento desce um nível; Máximo exige processador rápido", () => {
    expect(recommendProfile({ ramGb: 8, cores: 4, cpuScore: 1 }).profile).toBe("leve");
    expect(recommendProfile({ ramGb: 32, cores: 16, cpuScore: 3 }).profile).toBe("equilibrado");
    expect(recommendProfile({ ramGb: 32, cores: 16, cpuScore: 6 }).profile).toBe("maximo");
    expect(recommendProfile({ ramGb: 4, cores: 2, cpuScore: 0.5 }).profile).toBe("leve");
  });

  it("escolha manual prevalece; núcleos nunca abaixo de 1", () => {
    expect(resolveProfile("maximo", { ramGb: 4, cores: 2 }).id).toBe("maximo");
    expect(resolveProfile("auto", { ramGb: 4, cores: 2 }).id).toBe("leve");
    expect(threadsFor(PROFILE_SPECS.leve, 1)).toBe(1);
    expect(threadsFor(PROFILE_SPECS.leve, 8)).toBe(4);
  });

  it("cada perfil aponta para modelos existentes", () => {
    for (const spec of Object.values(PROFILE_SPECS)) {
      expect(WHISPER_MODELS.some((m) => m.name === spec.whisperModel)).toBe(true);
      expect(SPEAKER_MODELS.some((m) => m.id === spec.speakerModel)).toBe(true);
    }
  });

  it("teste do processador devolve um número positivo", () => {
    expect(cpuBenchmark(30)).toBeGreaterThan(0);
  });
});
