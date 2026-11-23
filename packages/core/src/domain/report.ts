import type { MeetingAnalysis, TranscriptSegment } from "../ai/contracts.js";
import type { Marker } from "./markers.js";

/** Tipo de sessão: adapta as instruções da análise e a organização do relatório. */
export type ReportContext = "general" | "meeting" | "hearing" | "interview" | "class";

export const REPORT_CONTEXTS: Array<{ value: ReportContext; label: string; hint: string }> = [
  { value: "general", label: "Geral", hint: "Qualquer conversa" },
  { value: "meeting", label: "Reunião", hint: "Decisões, tarefas e encaminhamentos" },
  { value: "hearing", label: "Audiência", hint: "Depoimentos por participante, perguntas e respostas, contradições" },
  { value: "interview", label: "Entrevista", hint: "Perguntas, respostas e pontos a aprofundar" },
  { value: "class", label: "Aula", hint: "Conteúdos, conceitos e dúvidas" }
];

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
  /** Tipo de sessão escolhido pelo usuário. */
  context?: ReportContext;
  /** Marcadores registrados durante a captura ou a revisão. */
  markers?: Marker[];
  /** Duração da sessão (tempo decorrido, não relógio). */
  durationMs?: number;
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
    divergences: [],
    clarifications: [],
    keyMoments: [],
    warnings: []
  };
}
