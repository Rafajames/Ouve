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
}

export interface SessionArtifact {
  id: string;
  sessionId: string;
  kind: "audio-temp" | "transcript" | "report";
  createdAt: number;
  expiresAt?: number;
}
