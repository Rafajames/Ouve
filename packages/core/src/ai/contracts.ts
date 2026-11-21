export type AiTask = "transcription" | "diarization" | "analysis";
export type ProviderProtocol = "openai-compatible" | "gemini" | "anthropic" | "xai" | "custom";

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl?: string;
  model: string;
  protocol: ProviderProtocol;
  enabledTasks: AiTask[];
  /** Opaque reference to a secret in the platform's secure local store. */
  credentialRef?: string;
}

export interface ProviderCredentials {
  /** Secret is supplied to an adapter at runtime and must never be persisted in ProviderConfig. */
  apiKey: string;
}

export interface ProviderCapabilities {
  tasks: AiTask[];
  streaming: boolean;
  diarization: boolean;
  supportedMimeTypes?: string[];
  maxAudioBytes?: number;
}

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId?: string;
  confidence?: number;
}

export interface TranscriptionRequest {
  audio: Blob;
  mimeType: string;
  language?: string;
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
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

export interface AnalysisItem {
  id: string;
  title: string;
  description: string;
  evidence: AnalysisEvidence[];
  confidence?: number;
}

export interface MeetingAnalysis {
  summary: string;
  topics: AnalysisItem[];
  questionsAndAnswers: AnalysisItem[];
  decisions: AnalysisItem[];
  actionItems: Array<AnalysisItem & { assignee?: string; dueDate?: string }>;
}

export interface AnalysisProvider {
  readonly id: string;
  analyze(segments: TranscriptSegment[], signal?: AbortSignal): Promise<MeetingAnalysis>;
}
