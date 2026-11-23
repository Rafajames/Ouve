import type { AiTask, ProviderConfig } from "@ouve/core";
import type { FetchLike } from "./http.js";

/**
 * IA local: programas que rodam no próprio computador e expõem uma API
 * compatível com OpenAI. Nada sai da máquina. O Ouve só detecta, orienta e
 * configura — não instala programas sozinho.
 */
export type LocalServerId = "ollama" | "whisper-cpp" | "whisper-compatible";

/** Porta do servidor whisper.cpp (gerenciado pelo Ouve ou aberto manualmente). Evita a 8080, muito usada. */
export const LOCAL_WHISPER_PORT = 8178;

export type WhisperModelName = "base" | "small" | "medium" | "large-v3-turbo";

/** Modelos do whisper.cpp que o Ouve sabe baixar (huggingface.co/ggerganov/whisper.cpp). */
export const WHISPER_MODELS: Array<{ name: WhisperModelName; sizeMb: number; minRamGb: number; note: string }> = [
  { name: "base", sizeMb: 148, minRamGb: 2, note: "Rápido; erra mais em áudio com ruído." },
  { name: "small", sizeMb: 488, minRamGb: 4, note: "Bom equilíbrio para português." },
  { name: "medium", sizeMb: 1533, minRamGb: 8, note: "Mais preciso; lento sem placa de vídeo." },
  { name: "large-v3-turbo", sizeMb: 1624, minRamGb: 8, note: "Muito preciso e mais rápido que o large completo." }
];

export interface LocalModelSuggestion {
  name: string;
  /** Tamanho aproximado do download. */
  sizeGb: number;
  /** Memória (RAM) mínima recomendada. */
  minRamGb: number;
  note: string;
}

export interface LocalServerInfo {
  id: LocalServerId;
  name: string;
  task: "analysis" | "transcription";
  baseUrl: string;
  /** Endereço consultado para saber se o programa está aberto. */
  probeUrl: string;
  installUrl: string;
  license: string;
  steps: string[];
  models: LocalModelSuggestion[];
  limitations: string[];
}

export const LOCAL_SERVERS: LocalServerInfo[] = [
  {
    id: "ollama",
    name: "Ollama",
    task: "analysis",
    baseUrl: "http://localhost:11434/v1",
    probeUrl: "http://localhost:11434/api/tags",
    installUrl: "https://ollama.com/download",
    license: "MIT",
    steps: [
      "Baixe e instale o Ollama pelo site oficial (Windows, macOS ou Linux).",
      "Abra o Ollama — ele fica rodando na bandeja do sistema.",
      "Volte aqui e clique em “Verificar de novo”. Se ainda não houver modelo, use “Baixar modelo” (desktop) ou rode no terminal: ollama pull <modelo>."
    ],
    models: [
      { name: "qwen3:1.7b", sizeGb: 1.4, minRamGb: 4, note: "Mais leve; resumos simples, qualidade limitada." },
      { name: "gemma3:4b", sizeGb: 3.3, minRamGb: 8, note: "Bom equilíbrio para computadores comuns." },
      { name: "qwen3:8b", sizeGb: 5.2, minRamGb: 12, note: "Melhor qualidade em português; mais lento sem placa de vídeo." },
      { name: "qwen3:14b", sizeGb: 9.3, minRamGb: 20, note: "Alta qualidade; exige computador potente." }
    ],
    limitations: [
      "Faz a análise e o relatório; não transcreve áudio.",
      "Em computadores sem placa de vídeo dedicada, uma análise longa pode levar vários minutos.",
      "Na versão web e na extensão, o Ollama precisa permitir a origem do Ouve (variável OLLAMA_ORIGINS)."
    ]
  },
  {
    id: "whisper-cpp",
    name: "whisper.cpp (servidor)",
    task: "transcription",
    baseUrl: `http://127.0.0.1:${LOCAL_WHISPER_PORT}/v1`,
    probeUrl: `http://127.0.0.1:${LOCAL_WHISPER_PORT}/`,
    installUrl: "https://github.com/ggml-org/whisper.cpp/releases",
    license: "MIT",
    steps: [
      "No aplicativo desktop para Windows, o Ouve já traz o whisper.cpp: basta clicar em “Baixar e usar” num modelo.",
      "Em outros casos: compile ou obtenha o whisper-server, baixe um modelo (ex.: ggml-small.bin) em huggingface.co/ggerganov/whisper.cpp e rode:",
      `whisper-server -m ggml-small.bin --port ${LOCAL_WHISPER_PORT} --inference-path /v1/audio/transcriptions -l pt`,
      "Volte aqui e clique em “Verificar de novo”."
    ],
    models: WHISPER_MODELS.map((m) => ({ name: m.name, sizeGb: Math.round(m.sizeMb / 100) / 10, minRamGb: m.minRamGb, note: m.note })),
    limitations: [
      "O Whisper não separa as vozes; no desktop, o Ouve separa no computador (sherpa-onnx) se o modelo de vozes estiver baixado.",
      "Horários são por bloco de áudio, não por frase.",
      "Usa a memória e o processador do computador durante a transcrição."
    ]
  },
  {
    id: "whisper-compatible",
    name: "Outro servidor Whisper compatível",
    task: "transcription",
    baseUrl: "http://localhost:8000/v1",
    probeUrl: "http://localhost:8000/v1/models",
    installUrl: "https://github.com/speaches-ai/speaches",
    license: "varia",
    steps: [
      "Servidores como Speaches/faster-whisper ou LocalAI oferecem a mesma API da OpenAI na porta 8000.",
      "Exigem Docker ou Python — indicados para quem já usa essas ferramentas."
    ],
    models: [],
    limitations: ["Sem diarização na maioria dos servidores.", "Instalação mais técnica."]
  }
];

export interface LocalProbeResult {
  id: LocalServerId;
  running: boolean;
  /** Modelos instalados (Ollama) ou anunciados pelo servidor. */
  installedModels: Array<{ name: string; sizeGb?: number }>;
  error?: string;
}

async function probeOne(server: LocalServerInfo, fetchImpl: FetchLike, timeoutMs: number): Promise<LocalProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(server.probeUrl, { signal: controller.signal });
    if (!res.ok && res.status !== 404) return { id: server.id, running: false, installedModels: [], error: `Resposta ${res.status}` };
    let installedModels: LocalProbeResult["installedModels"] = [];
    if (server.id === "ollama") {
      const data = (await res.json()) as { models?: Array<{ name?: string; size?: number }> };
      installedModels = (data.models ?? [])
        .filter((m) => typeof m.name === "string")
        .map((m) => ({ name: m.name as string, ...(typeof m.size === "number" ? { sizeGb: Math.round((m.size / 1e9) * 10) / 10 } : {}) }));
    } else if (server.id === "whisper-compatible") {
      const data = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string }> };
      installedModels = (data.data ?? []).filter((m) => typeof m.id === "string").map((m) => ({ name: m.id as string }));
    }
    return { id: server.id, running: true, installedModels };
  } catch {
    return { id: server.id, running: false, installedModels: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** Verifica, em paralelo e com tempo curto, quais programas locais estão abertos. */
export async function probeLocalServers(fetchImpl: FetchLike, timeoutMs = 1500): Promise<LocalProbeResult[]> {
  return Promise.all(LOCAL_SERVERS.map((s) => probeOne(s, fetchImpl, timeoutMs)));
}

export interface HardwareInfo {
  /** Memória total (GB); undefined se o navegador não informar. */
  ramGb?: number;
  cores?: number;
}

export interface HardwareAdvice {
  level: "modest" | "medium" | "strong" | "unknown";
  message: string;
  analysisModel?: string;
  transcriptionModel?: string;
}

/** Recomenda modelos compatíveis com o computador, sem forçar máquinas modestas. */
export function adviseHardware(hw: HardwareInfo): HardwareAdvice {
  const ram = hw.ramGb;
  if (ram === undefined)
    return {
      level: "unknown",
      message: "Não foi possível ler a memória deste computador. Comece pelos modelos menores e teste.",
      analysisModel: "gemma3:4b",
      transcriptionModel: "small"
    };
  if (ram < 8)
    return {
      level: "modest",
      message: `Este computador tem cerca de ${Math.round(ram)} GB de memória. IA local vai funcionar devagar; prefira um provedor externo ou os modelos mais leves.`,
      analysisModel: "qwen3:1.7b",
      transcriptionModel: "base"
    };
  if (ram < 16)
    return {
      level: "medium",
      message: `Cerca de ${Math.round(ram)} GB de memória: modelos médios funcionam bem.`,
      analysisModel: "gemma3:4b",
      transcriptionModel: "small"
    };
  return {
    level: "strong",
    message: `Cerca de ${Math.round(ram)} GB de memória: modelos maiores são viáveis.`,
    analysisModel: "qwen3:8b",
    transcriptionModel: "large-v3-turbo"
  };
}

/** Configuração de provedor para um servidor local (sem chave; nada sai do computador). */
export function localProviderConfig(serverId: LocalServerId, model: string): ProviderConfig {
  const server = LOCAL_SERVERS.find((s) => s.id === serverId);
  if (!server) throw new Error("Servidor local desconhecido.");
  const tasks: AiTask[] = server.task === "analysis" ? ["analysis", "report"] : ["transcription"];
  return {
    id: `local-${serverId}`,
    displayName: `${server.name} (local)`,
    protocol: "openai-compatible",
    baseUrl: server.baseUrl,
    model: server.task === "analysis" ? model : model || "whisper-1",
    ...(server.task === "transcription" ? { transcriptionModel: model || "whisper-1" } : {}),
    enabledTasks: tasks,
    // Modelos locais podem demorar bem mais que serviços na nuvem.
    timeoutMs: 600_000,
    maxRetries: 0
  };
}

/** Baixa um modelo no Ollama (POST /api/pull). Só deve ser chamado por ação do usuário. */
export async function pullOllamaModel(fetchImpl: FetchLike, model: string, signal?: AbortSignal): Promise<void> {
  if (!/^[a-z0-9._:/-]{1,80}$/i.test(model)) throw new Error("Nome de modelo inválido.");
  const res = await fetchImpl("http://localhost:11434/api/pull", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Com stream o cabeçalho volta logo; lemos o progresso até o fim (downloads longos não estouram o tempo de resposta).
    body: JSON.stringify({ model, stream: true }),
    ...(signal ? { signal } : {})
  });
  if (!res.ok) throw new Error(`O Ollama não conseguiu baixar o modelo (resposta ${res.status}).`);
  const text = await res.text();
  const lines = text.split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as { error?: string };
      if (msg.error) throw new Error(`O Ollama informou: ${msg.error}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("O Ollama")) throw err;
    }
  }
}
