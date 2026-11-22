import {
  METRICS_LIMITATIONS,
  computeMetrics,
  formatDuration,
  markerLabel,
  segmentForMarker,
  type AnalysisItem,
  type Marker,
  type MeetingAnalysis,
  type ReportContext,
  type ReportDocument,
  type Speaker,
  type TranscriptSegment
} from "@ouve/core";
import { OUVE_CREDIT, createId, formatTimestamp, sanitizeText } from "@ouve/shared";

export interface BuildReportInput {
  sessionId: string;
  title: string;
  language?: string;
  transcript: TranscriptSegment[];
  speakers: Speaker[];
  analysis: MeetingAnalysis;
  providers?: { transcription?: string; analysis?: string };
  context?: ReportContext;
  markers?: Marker[];
  durationMs?: number;
  now?: number;
}

export function buildReport(input: BuildReportInput): ReportDocument {
  const report: ReportDocument = {
    schemaVersion: 1,
    id: createId("rel"),
    sessionId: input.sessionId,
    title: sanitizeText(input.title, 200) || "Relatório de reunião",
    language: input.language ?? "pt-BR",
    createdAt: input.now ?? Date.now(),
    transcript: input.transcript,
    speakers: input.speakers,
    analysis: input.analysis
  };
  if (input.providers) report.providers = input.providers;
  if (input.context) report.context = input.context;
  if (input.markers?.length) report.markers = input.markers;
  if (input.durationMs !== undefined) report.durationMs = input.durationMs;
  return report;
}

export type SectionKey =
  | "topics"
  | "questionsAndAnswers"
  | "decisions"
  | "pendingItems"
  | "actionItems"
  | "attentionPoints"
  | "nextSteps"
  | "divergences"
  | "clarifications"
  | "keyMoments";

const TITLES: Record<SectionKey, string> = {
  topics: "Tópicos discutidos",
  questionsAndAnswers: "Perguntas e respostas",
  decisions: "Decisões tomadas",
  pendingItems: "Pendências",
  actionItems: "Tarefas",
  attentionPoints: "Pontos de atenção",
  nextSteps: "Encaminhamentos",
  divergences: "Divergências e contradições aparentes",
  clarifications: "Pontos que precisam de esclarecimento",
  keyMoments: "Momentos importantes"
};

/** Ordem e títulos das seções por tipo de sessão. */
const ORDER: Record<ReportContext, SectionKey[]> = {
  general: [
    "topics",
    "questionsAndAnswers",
    "decisions",
    "pendingItems",
    "actionItems",
    "nextSteps",
    "divergences",
    "clarifications",
    "attentionPoints",
    "keyMoments"
  ],
  meeting: [
    "topics",
    "decisions",
    "actionItems",
    "nextSteps",
    "pendingItems",
    "questionsAndAnswers",
    "divergences",
    "clarifications",
    "attentionPoints",
    "keyMoments"
  ],
  hearing: [
    "questionsAndAnswers",
    "topics",
    "divergences",
    "clarifications",
    "decisions",
    "nextSteps",
    "pendingItems",
    "actionItems",
    "attentionPoints",
    "keyMoments"
  ],
  interview: [
    "questionsAndAnswers",
    "topics",
    "clarifications",
    "keyMoments",
    "attentionPoints",
    "nextSteps",
    "decisions",
    "pendingItems",
    "actionItems",
    "divergences"
  ],
  class: [
    "topics",
    "questionsAndAnswers",
    "keyMoments",
    "nextSteps",
    "clarifications",
    "attentionPoints",
    "decisions",
    "pendingItems",
    "actionItems",
    "divergences"
  ]
};

const CONTEXT_TITLES: Partial<Record<ReportContext, Partial<Record<SectionKey, string>>>> = {
  hearing: { decisions: "Deliberações", nextSteps: "Providências e encaminhamentos" },
  class: { topics: "Conteúdos abordados", questionsAndAnswers: "Dúvidas e respostas", nextSteps: "Tarefas e leituras" }
};

export function sectionsFor(context: ReportContext = "general"): Array<{ key: SectionKey; title: string }> {
  return ORDER[context].map((key) => ({ key, title: CONTEXT_TITLES[context]?.[key] ?? TITLES[key] }));
}

/** Seções na ordem padrão (compatibilidade com telas existentes). */
export const REPORT_SECTIONS = sectionsFor("general");

/** O que incluir na exportação; tudo ligado por padrão, exceto métricas detalhadas desligadas apenas se o usuário quiser. */
export interface ExportOptions {
  includeTranscript?: boolean;
  includeTimestamps?: boolean;
  includeMetrics?: boolean;
  includeMarkers?: boolean;
  includeNotes?: boolean;
  includeEvidence?: boolean;
  /** Seções da análise a incluir; ausente = todas. */
  sections?: SectionKey[];
}

export interface ReportLine {
  kind: "h1" | "h2" | "meta" | "p" | "bullet" | "small";
  text: string;
}

type AnyItem = AnalysisItem & { assignee?: string; dueDate?: string; answer?: string };

function itemLines(item: AnyItem, report: ReportDocument, opts: ExportOptions): ReportLine[] {
  const tag = item.basis === "inferred" ? " (inferência da IA)" : "";
  const lines: ReportLine[] = [{ kind: "bullet", text: `${item.title}${tag}` }];
  if (item.description && item.description !== item.title) lines.push({ kind: "small", text: item.description });
  if (item.answer) lines.push({ kind: "small", text: `Resposta: ${item.answer}` });
  if ("assignee" in item || "dueDate" in item) {
    lines.push({ kind: "small", text: `Responsável: ${item.assignee ?? "não identificado"} · Prazo: ${item.dueDate ?? "não mencionado"}` });
  }
  if (opts.includeEvidence === false) return lines;
  const byId = new Map(report.transcript.map((s) => [s.id, s]));
  for (const ev of item.evidence) {
    const first = byId.get(ev.segmentIds[0] ?? "");
    const when = first && opts.includeTimestamps !== false ? `[${formatTimestamp(first.startMs)}] ` : "";
    if (ev.quote) lines.push({ kind: "small", text: `Evidência: ${when}"${ev.quote}"` });
    else if (first) lines.push({ kind: "small", text: `Evidência: ${when}${first.text.slice(0, 160)}` });
  }
  return lines;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Duração exibida: a informada ou, na falta, o fim do último trecho. */
export function reportDuration(report: ReportDocument): number {
  return report.durationMs ?? report.transcript.reduce((max, s) => Math.max(max, s.endMs), 0);
}

/**
 * Representação linear do relatório usada por todos os exportadores,
 * garantindo o mesmo conteúdo em PDF, DOCX, Markdown e TXT.
 */
export function reportToLines(report: ReportDocument, options: ExportOptions = {}): ReportLine[] {
  const opts: ExportOptions = {
    includeTranscript: true,
    includeTimestamps: true,
    includeMetrics: true,
    includeMarkers: true,
    includeNotes: true,
    ...options
  };
  const ts = (ms: number) => (opts.includeTimestamps ? `[${formatTimestamp(ms)}] ` : "");
  const speakerLabel = (id?: string) => report.speakers.find((s) => s.id === id)?.label ?? "Falante não identificado";
  const context = report.context ?? "general";
  const a = report.analysis;
  const lines: ReportLine[] = [
    { kind: "h1", text: report.title },
    { kind: "meta", text: `Gerado em ${new Date(report.createdAt).toLocaleString("pt-BR")} pelo Ouve (${OUVE_CREDIT})` },
    {
      kind: "meta",
      text: "Conteúdo organizado por IA a partir da transcrição. Itens marcados como inferência não foram ditos explicitamente; revise antes de usar."
    }
  ];
  const duration = reportDuration(report);
  if (duration > 0) lines.push({ kind: "meta", text: `Duração: ${formatDuration(duration)}` });
  if (report.providers?.transcription || report.providers?.analysis) {
    lines.push({
      kind: "meta",
      text: `Provedores: transcrição — ${report.providers.transcription ?? "n/d"}; análise — ${report.providers.analysis ?? "n/d"}`
    });
  }
  if (report.speakers.length > 0) lines.push({ kind: "meta", text: `Participantes: ${report.speakers.map((s) => s.label).join(", ")}` });

  if (a.objective) {
    lines.push({ kind: "h2", text: "Objetivo ou assunto principal" });
    lines.push({ kind: "p", text: a.objective });
  }
  lines.push({ kind: "h2", text: "Resumo executivo" });
  for (const paragraph of (a.summary || "Sem resumo.").split(/\n{2,}/)) lines.push({ kind: "p", text: paragraph.trim() });

  const wanted = opts.sections ? new Set(opts.sections) : undefined;
  for (const section of sectionsFor(context)) {
    if (wanted && !wanted.has(section.key)) continue;
    const items = (a[section.key] ?? []) as AnyItem[];
    lines.push({ kind: "h2", text: section.title });
    if (items.length === 0) lines.push({ kind: "small", text: "Nenhum item identificado." });
    for (const item of items) lines.push(...itemLines(item, report, opts));
    if (section.key === "questionsAndAnswers") {
      const open = items.filter((q) => !q.answer);
      if (open.length > 0) {
        lines.push({ kind: "h2", text: "Perguntas sem resposta identificada" });
        for (const q of open) lines.push({ kind: "bullet", text: q.title });
      }
    }
  }

  if (opts.includeMarkers && report.markers?.length) {
    lines.push({ kind: "h2", text: "Marcadores registrados" });
    for (const m of report.markers) {
      const seg = segmentForMarker(report.transcript, m.atMs);
      const origin = m.origin === "suggested" ? " (sugerido)" : "";
      lines.push({ kind: "bullet", text: `${ts(m.atMs)}${markerLabel(m.kind)}${origin}${m.note ? ` — ${m.note}` : ""}` });
      if (seg) lines.push({ kind: "small", text: `${speakerLabel(seg.speakerId)}: ${seg.text.slice(0, 200)}` });
    }
  }

  if (opts.includeMetrics && report.transcript.length > 0) {
    const m = computeMetrics(report.transcript, report.speakers);
    lines.push({ kind: "h2", text: context === "hearing" ? "Falas por participante (linha do tempo)" : "Participação" });
    for (const sp of m.speakers) {
      const wpm = sp.wordsPerMinute ? ` · ${sp.wordsPerMinute} palavras/min` : "";
      lines.push({
        kind: "bullet",
        text: `${sp.label}: ${formatDuration(sp.talkMs)} (${pct(sp.share)}) · ${sp.turns} intervenç${sp.turns === 1 ? "ão" : "ões"} · ${sp.questions} pergunta(s)${wpm}`
      });
      if (opts.includeTimestamps) {
        const ranges = sp.intervals.map((iv) => `${formatTimestamp(iv.startMs)}–${formatTimestamp(iv.endMs)}`);
        const shown = ranges.slice(0, 40).join(", ");
        lines.push({ kind: "small", text: `Falou em: ${shown}${ranges.length > 40 ? ` e mais ${ranges.length - 40} trechos` : ""}` });
      }
    }
    lines.push({ kind: "small", text: `Alternâncias entre participantes: ${m.speakerChanges} · Perguntas no total: ${m.questions}` });
    if (m.monologues.length)
      lines.push({
        kind: "small",
        text: `Falas contínuas acima de 2 min: ${m.monologues.map((x) => `${speakerLabel(x.speakerId)} ${formatTimestamp(x.startMs)}–${formatTimestamp(x.endMs)}`).join("; ")}`
      });
    if (m.silences.length) lines.push({ kind: "small", text: `Intervalos sem fala acima de 10 s: ${m.silences.length}` });
    lines.push({ kind: "meta", text: METRICS_LIMITATIONS });
  }

  if (a.conclusion) {
    lines.push({ kind: "h2", text: "Conclusão" });
    lines.push({ kind: "p", text: a.conclusion });
  }

  if (opts.includeNotes && report.notes?.trim()) {
    lines.push({ kind: "h2", text: "Observações" });
    for (const paragraph of report.notes.split(/\n{2,}/)) lines.push({ kind: "p", text: paragraph.trim() });
  }

  if (opts.includeTranscript) {
    lines.push({ kind: "h2", text: "Transcrição" });
    for (const s of report.transcript) lines.push({ kind: "p", text: `${ts(s.startMs)}${speakerLabel(s.speakerId)}: ${s.text}` });
  }
  return lines;
}

/** Texto simples, sem formatação. */
export function reportToText(report: ReportDocument, options?: ExportOptions): string {
  return reportToLines(report, options)
    .map((l) => {
      switch (l.kind) {
        case "h1":
          return `${l.text.toUpperCase()}\n${"=".repeat(Math.min(l.text.length, 80))}`;
        case "h2":
          return `\n${l.text.toUpperCase()}\n${"-".repeat(Math.min(l.text.length, 80))}`;
        case "bullet":
          return `• ${l.text}`;
        case "small":
          return `    - ${l.text}`;
        default:
          return l.text;
      }
    })
    .join("\n");
}

function csvCell(value: string): string {
  // Evita injeção de fórmulas ao abrir no Excel/Calc.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Transcrição (e marcadores) em CSV com BOM, para planilhas. */
export function reportToCsv(report: ReportDocument): string {
  const speakerLabel = (id?: string) => report.speakers.find((s) => s.id === id)?.label ?? "Falante não identificado";
  const rows = [["tipo", "inicio", "fim", "participante", "texto", "editado"]];
  for (const s of report.transcript)
    rows.push(["fala", formatTimestamp(s.startMs), formatTimestamp(s.endMs), speakerLabel(s.speakerId), s.text, s.edited ? "sim" : "não"]);
  for (const m of report.markers ?? [])
    rows.push(["marcador", formatTimestamp(m.atMs), "", "", `${markerLabel(m.kind)}${m.note ? `: ${m.note}` : ""}`, ""]);
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export function reportToMarkdown(report: ReportDocument, options?: ExportOptions): string {
  return reportToLines(report, options)
    .map((l) => {
      switch (l.kind) {
        case "h1":
          return `# ${l.text}\n`;
        case "h2":
          return `\n## ${l.text}\n`;
        case "meta":
          return `_${l.text}_  `;
        case "bullet":
          return `- **${l.text}**`;
        case "small":
          return `  - ${l.text}`;
        default:
          return `${l.text}\n`;
      }
    })
    .join("\n");
}

/** Nome de arquivo seguro para exportação. */
export function exportFileName(title: string, extension: ExportFormat): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "relatorio";
  return `${base}.${extension}`;
}

export type ExportFormat = "pdf" | "docx" | "md" | "txt" | "csv";
