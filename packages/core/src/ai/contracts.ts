/**
 * Serviços separados (prompt mestre §5): transcrição, identificação de
 * falantes, análise e geração de relatório. Um provedor diferente pode
 * atender cada serviço.
 */
export type AiTask = "transcription" | "diarization" | "analysis" | "report";
export type ProviderProtocol = "openai" | "openai-compatible" | "gemini" | "anthropic" | "xai" | "custom";

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl?: string;
  model: string;
  /** Modelo opcional usado só para transcrição (ex.: whisper-1). */
  transcriptionModel?: string;
  protocol: ProviderProtocol;
  enabledTasks: AiTask[];
  /** Opaque reference to a secret in the platform's secure local store. */
  credentialRef?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Cabeçalhos extras não secretos para provedores personalizados. */
  extraHeaders?: Record<string, string>;
}

export interface ProviderCredentials {
  /** Secret is supplied to an adapter at runtime and must never be persisted in ProviderConfig. */
  apiKey: string;
}

export interface ProviderCapabilities {
  tasks: AiTask[];
  streaming: boolean;
  diarization: boolean;
  /** Timestamps por segmento retornados pela API (e não estimados). */
  segmentTimestamps: boolean;
  /** Confiança por segmento disponível. */
  confidence: boolean;
  supportedMimeTypes?: string[];
  maxAudioBytes?: number;
  /** Observações em pt-BR sobre limitações conhecidas do adaptador. */
  notes?: string[];
}

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId?: string;
  confidence?: number;
  /** Índice do bloco de áudio de origem; garante idempotência em novas tentativas. */
  chunkIndex?: number;
  /** Texto foi editado manualmente pelo usuário. */
  edited?: boolean;
}

/** Segmento como retornado pelo provedor, relativo ao início do bloco. */
export interface ProviderSegment {
  startMs: number;
  endMs: number;
  text: string;
  /** Rótulo cru do provedor (ex.: "A", "speaker_0"); nunca é um nome real. */
  speakerLabel?: string;
  confidence?: number;
}

export interface TranscriptionRequest {
  audio: Blob;
  mimeType: string;
  /** Duração do bloco, usada quando o provedor não retorna timestamps. */
  durationMs: number;
  language?: string;
  /** Texto anterior para dar contexto ao modelo (não é instrução). */
  previousText?: string;
}

export interface TranscriptionResult {
  segments: ProviderSegment[];
  detectedLanguage?: string;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  transcribe(request: TranscriptionRequest, signal?: AbortSignal): Promise<TranscriptionResult>;
}

export interface AnalysisEvidence {
  segmentIds: string[];
  quote?: string;
}

/** Informação explícita no conteúdo versus inferência produzida pela IA. */
export type AnalysisBasis = "explicit" | "inferred";

export interface AnalysisItem {
  id: string;
  title: string;
  description: string;
  basis: AnalysisBasis;
  evidence: AnalysisEvidence[];
  confidence?: number;
}

export interface ActionItem extends AnalysisItem {
  /** Responsável apenas quando mencionado na transcrição. */
  assignee?: string;
  /** Prazo apenas quando mencionado na transcrição. */
  dueDate?: string;
}

export interface QuestionAnswer extends AnalysisItem {
  answer?: string;
}

export interface MeetingAnalysis {
  summary: string;
  topics: AnalysisItem[];
  questionsAndAnswers: QuestionAnswer[];
  decisions: AnalysisItem[];
  pendingItems: AnalysisItem[];
  actionItems: ActionItem[];
  attentionPoints: AnalysisItem[];
  nextSteps: AnalysisItem[];
  /** Avisos do validador (itens descartados, campos removidos por falta de evidência). */
  warnings: string[];
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  /** Solicita resposta em JSON quando o provedor suporta. */
  json: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

/** Provedor de texto usado para análise e geração de relatório. */
export interface CompletionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<string>;
}

export interface AnalysisProvider {
  readonly id: string;
  analyze(segments: TranscriptSegment[], signal?: AbortSignal): Promise<MeetingAnalysis>;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  models?: string[];
}
