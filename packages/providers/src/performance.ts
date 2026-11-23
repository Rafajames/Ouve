import type { WhisperModelName } from "./local.js";

/**
 * Perfis de desempenho (D-088): o Ouve mede o computador e escolhe quanto de
 * modelo ele aguenta, para funcionar do PC mais fraco ao mais potente.
 * Tudo roda localmente; a medição não guarda nem envia nada.
 */
export type PerformanceProfile = "leve" | "equilibrado" | "maximo";
export type ProfileChoice = "auto" | PerformanceProfile;

export interface MachineInfo {
  ramGb: number;
  cores: number;
  /** Resultado do teste rápido do processador (maior = mais rápido). */
  cpuScore?: number;
  /** Placa de vídeo dedicada detectada (só informativo: a aceleração ainda não é usada). */
  dedicatedGpu?: boolean;
}

export type SpeakerModelId = "campplus" | "titanet-small" | "titanet-large";

/**
 * Modelos de "impressão de voz" do sherpa-onnx (separação de falantes), baixados sob pedido.
 * Conferidos em 23/11/2026 com o áudio de teste de 4 vozes do sherpa-onnx (acertaram as 4,
 * com número de pessoas informado e no automático com limiar 0,9).
 */
export const SPEAKER_MODELS: Array<{ id: SpeakerModelId; file: string; sizeMb: number; note: string }> = [
  {
    id: "campplus",
    file: "3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx",
    sizeMb: 28,
    note: "Leve e rápido; bom para PCs simples."
  },
  { id: "titanet-small", file: "nemo_en_titanet_small.onnx", sizeMb: 40, note: "Equilíbrio entre precisão e velocidade." },
  { id: "titanet-large", file: "nemo_en_titanet_large.onnx", sizeMb: 101, note: "Mais preciso; usa mais processador." }
];

export const SPEAKER_MODEL_URL = (file: string) =>
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/${file}`;

export interface ProfileSpec {
  id: PerformanceProfile;
  label: string;
  description: string;
  whisperModel: WhisperModelName;
  speakerModel: SpeakerModelId;
  /** Fração dos núcleos usada pela IA local (deixa folga para o Windows e a gravação). */
  threadShare: number;
  /** Pedaços transcritos ao mesmo tempo com a IA local. */
  localConcurrency: number;
  /** Separação de vozes só depois da transcrição (não as duas juntas). */
  sequentialDiarization: boolean;
}

export const PROFILE_SPECS: Record<PerformanceProfile, ProfileSpec> = {
  leve: {
    id: "leve",
    label: "Leve",
    description: "Para PCs simples (4 GB de memória). Mais rápido, um pouco menos preciso.",
    whisperModel: "base",
    speakerModel: "campplus",
    threadShare: 0.5,
    localConcurrency: 1,
    sequentialDiarization: true
  },
  equilibrado: {
    id: "equilibrado",
    label: "Equilibrado",
    description: "Para a maioria dos computadores (8 GB). Boa precisão em português.",
    whisperModel: "small",
    speakerModel: "titanet-small",
    threadShare: 0.75,
    localConcurrency: 1,
    sequentialDiarization: false
  },
  maximo: {
    id: "maximo",
    label: "Máximo",
    description: "Para computadores potentes (16 GB, 8 núcleos ou mais). Mais preciso, mais pesado.",
    whisperModel: "large-v3-turbo",
    speakerModel: "titanet-large",
    threadShare: 0.85,
    localConcurrency: 2,
    sequentialDiarization: false
  }
};

/** Limites do teste do processador (provisórios; calibrar com uso real). */
export const CPU_SCORE_SLOW = 2;
export const CPU_SCORE_FAST = 5;

const ORDER: PerformanceProfile[] = ["leve", "equilibrado", "maximo"];

/** Escolhe o perfil pelo hardware: memória e núcleos definem o teto; um processador lento desce um nível. */
export function recommendProfile(hw: MachineInfo): { profile: PerformanceProfile; reason: string } {
  let level: number;
  let reason: string;
  if (hw.ramGb < 6 || hw.cores <= 2) {
    level = 0;
    reason = `${fmtGb(hw.ramGb)} de memória e ${hw.cores} núcleo(s)`;
  } else if (hw.ramGb >= 15 && hw.cores >= 8) {
    level = 2;
    reason = `${fmtGb(hw.ramGb)} de memória e ${hw.cores} núcleos`;
  } else {
    level = 1;
    reason = `${fmtGb(hw.ramGb)} de memória e ${hw.cores} núcleos`;
  }
  if (hw.cpuScore !== undefined) {
    if (hw.cpuScore < CPU_SCORE_SLOW && level > 0) {
      level -= 1;
      reason += "; processador lento no teste";
    } else if (hw.cpuScore >= CPU_SCORE_FAST && level === 2) reason += "; processador rápido no teste";
    else if (hw.cpuScore < CPU_SCORE_FAST && level === 2) {
      level = 1;
      reason += "; processador mediano no teste";
    }
  }
  return { profile: ORDER[level] as PerformanceProfile, reason };
}

export function resolveProfile(choice: ProfileChoice | undefined, hw: MachineInfo): ProfileSpec {
  const id = !choice || choice === "auto" ? recommendProfile(hw).profile : choice;
  return PROFILE_SPECS[id];
}

/** Núcleos para a IA local conforme o perfil (mínimo 1). */
export function threadsFor(spec: ProfileSpec, cores: number): number {
  return Math.max(1, Math.min(cores, Math.round(cores * spec.threadShare)));
}

/**
 * Teste rápido do processador (~0,4 s, uma thread): contas simples repetidas.
 * Não depende de modelo baixado; serve só para comparar computadores.
 */
export function cpuBenchmark(durationMs = 400, now: () => number = () => performance.now()): number {
  const data = new Float32Array(4096).map((_, i) => Math.sin(i));
  let acc = 0;
  let rounds = 0;
  const warm = now() + 50;
  while (now() < warm) acc += data[rounds++ & 4095] ?? 0;
  rounds = 0;
  const start = now();
  const end = start + durationMs;
  while (now() < end) {
    for (let r = 0; r < 64; r++) for (let i = 0; i < 4096; i++) acc += (data[i] ?? 0) * (data[(i * 7) & 4095] ?? 0);
    rounds++;
  }
  // Usa o acumulador para o otimizador não descartar o laço.
  if (Number.isNaN(acc)) return 0;
  return Math.round((rounds / Math.max(1, now() - start)) * 100) / 100;
}

function fmtGb(gb: number): string {
  return `${Math.round(gb)} GB`;
}
