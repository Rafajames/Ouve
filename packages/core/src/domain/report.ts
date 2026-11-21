import type { MeetingAnalysis, TranscriptSegment } from "../ai/contracts.js";

export interface Speaker {
  id: string;
  label: string;
  colorToken?: string;
}

export interface ReportDocument {
  schemaVersion: 1;
  id: string;
  sessionId: string;
  title: string;
  language: string;
  createdAt: number;
  transcript: TranscriptSegment[];
  speakers: Speaker[];
  analysis: MeetingAnalysis;
  /** Notas livres editadas pelo usuário. */
  notes?: string;
  /** Provedores usados, exibidos no relatório para transparência. */
  providers?: { transcription?: string; analysis?: string };
}

export interface SessionArtifact {
  id: string;
  sessionId: string;
  kind: "audio-temp" | "transcript" | "report";
  createdAt: number;
  expiresAt?: number;
}

export function emptyAnalysis(): MeetingAnalysis {
  return {
    summary: "",
    topics: [],
    questionsAndAnswers: [],
    decisions: [],
    pendingItems: [],
    actionItems: [],
    attentionPoints: [],
    nextSteps: [],
    warnings: []
  };
}
