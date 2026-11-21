import type { AiTask, ProviderCapabilities, ProviderProtocol } from "@ouve/core";

/**
 * Catálogo de provedores. Modelos são SUGESTÕES editáveis (referência: jun/2026);
 * o teste de conexão lista os modelos realmente disponíveis para a chave do usuário.
 * Capacidades declaradas dependem da API contratada e não foram validadas com chaves reais.
 */
export interface ProviderPreset {
  protocol: ProviderProtocol;
  displayName: string;
  defaultBaseUrl: string;
  /** Endpoint precisa ser informado pelo usuário. */
  requiresBaseUrl: boolean;
  suggestedModel: string;
  suggestedTranscriptionModel?: string;
  tasks: AiTask[];
  transcription?: ProviderCapabilities;
  completion: ProviderCapabilities;
  docsUrl: string;
  /** Política de dados deve ser conferida pelo usuário na fonte oficial. */
  dataPolicyNote: string;
}

const textCaps = (notes: string[]): ProviderCapabilities => ({
  tasks: ["analysis", "report"],
  streaming: false,
  diarization: false,
  segmentTimestamps: false,
  confidence: false,
  notes
});

export const PROVIDER_PRESETS: Record<ProviderProtocol, ProviderPreset> = {
  openai: {
    protocol: "openai",
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresBaseUrl: false,
    suggestedModel: "gpt-4o-mini",
    suggestedTranscriptionModel: "gpt-4o-transcribe",
    tasks: ["transcription", "diarization", "analysis", "report"],
    transcription: {
      tasks: ["transcription", "diarization"],
      streaming: false,
      diarization: true,
      segmentTimestamps: true,
      confidence: true,
      supportedMimeTypes: ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/flac"],
      maxAudioBytes: 25 * 1024 * 1024,
      notes: [
        "whisper-1: timestamps e confiança por segmento.",
        "gpt-4o-transcribe / gpt-4o-mini-transcribe: texto por bloco, sem timestamps internos.",
        "gpt-4o-transcribe-diarize: falantes e timestamps por segmento.",
        "Limite de 25 MB por requisição."
      ]
    },
    completion: textCaps(["Resposta em JSON via response_format."]),
    docsUrl: "https://platform.openai.com/docs",
    dataPolicyNote: "Consulte a política de uso de dados da API OpenAI antes de enviar conteúdo confidencial."
  },
  gemini: {
    protocol: "gemini",
    displayName: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    requiresBaseUrl: false,
    suggestedModel: "gemini-2.5-flash",
    suggestedTranscriptionModel: "gemini-2.5-flash",
    tasks: ["transcription", "diarization", "analysis", "report"],
    transcription: {
      tasks: ["transcription", "diarization"],
      streaming: false,
      diarization: true,
      segmentTimestamps: false,
      confidence: false,
      supportedMimeTypes: ["audio/wav", "audio/mpeg", "audio/aac", "audio/ogg", "audio/flac"],
      maxAudioBytes: 15 * 1024 * 1024,
      notes: [
        "Transcrição por modelo generativo: timestamps e falantes são estimados pelo modelo e podem ser imprecisos.",
        "Envio inline limitado (~20 MB por requisição)."
      ]
    },
    completion: textCaps(["Resposta em JSON via responseMimeType."]),
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    dataPolicyNote: "Termos do nível gratuito e pago diferem quanto ao uso de dados; verifique na documentação oficial."
  },
  anthropic: {
    protocol: "anthropic",
    displayName: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    requiresBaseUrl: false,
    suggestedModel: "claude-sonnet-4-5",
    tasks: ["analysis", "report"],
    completion: textCaps(["A API Messages não transcreve áudio; use outro provedor para transcrição."]),
    docsUrl: "https://docs.anthropic.com",
    dataPolicyNote: "Consulte a política comercial de dados da Anthropic antes de enviar conteúdo confidencial."
  },
  xai: {
    protocol: "xai",
    displayName: "xAI Grok",
    defaultBaseUrl: "https://api.x.ai/v1",
    requiresBaseUrl: false,
    suggestedModel: "grok-4",
    tasks: ["analysis", "report"],
    completion: textCaps(["API compatível com o formato OpenAI. Transcrição de áudio não habilitada neste adaptador."]),
    docsUrl: "https://docs.x.ai",
    dataPolicyNote: "Consulte a política de dados da xAI antes de enviar conteúdo confidencial."
  },
  "openai-compatible": {
    protocol: "openai-compatible",
    displayName: "API compatível com OpenAI",
    defaultBaseUrl: "",
    requiresBaseUrl: true,
    suggestedModel: "",
    tasks: ["transcription", "analysis", "report"],
    transcription: {
      tasks: ["transcription"],
      streaming: false,
      diarization: false,
      segmentTimestamps: false,
      confidence: false,
      notes: ["Depende do servidor: muitos não implementam /audio/transcriptions."]
    },
    completion: textCaps(["Se o servidor não aceitar response_format, o Ouve tenta novamente sem ele."]),
    docsUrl: "https://platform.openai.com/docs/api-reference",
    dataPolicyNote: "Os dados vão para o servidor que você configurou; servidores locais (localhost) não saem do computador."
  },
  custom: {
    protocol: "custom",
    displayName: "Provedor personalizado",
    defaultBaseUrl: "",
    requiresBaseUrl: true,
    suggestedModel: "",
    tasks: ["transcription", "analysis", "report"],
    transcription: {
      tasks: ["transcription"],
      streaming: false,
      diarization: false,
      segmentTimestamps: false,
      confidence: false,
      notes: ["Usa o formato OpenAI. Outros formatos exigem um novo adaptador."]
    },
    completion: textCaps(["Formato OpenAI (chat/completions) com cabeçalhos extras opcionais."]),
    docsUrl: "",
    dataPolicyNote: "Os dados vão para o endpoint informado por você."
  }
};

export function presetFor(protocol: ProviderProtocol): ProviderPreset {
  return PROVIDER_PRESETS[protocol];
}
