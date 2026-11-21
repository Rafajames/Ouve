export type AiTask = "transcription" | "diarization" | "analysis";

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl?: string;
  apiKey: string;
  model: string;
  protocol: "openai-compatible" | "gemini" | "anthropic" | "xai" | "custom";
  enabledTasks: AiTask[];
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
