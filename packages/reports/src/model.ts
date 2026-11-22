import type { AnalysisItem, MeetingAnalysis, ReportDocument, Speaker, TranscriptSegment } from "@ouve/core";
import { OUVE_CREDIT, createId, formatTimestamp, sanitizeText } from "@ouve/shared";

export interface BuildReportInput {
  sessionId: string;
  title: string;
  language?: string;
  transcript: TranscriptSegment[];
  speakers: Speaker[];
  analysis: MeetingAnalysis;
  providers?: { transcription?: string; analysis?: string };
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
  return report;
}

/** Seções do relatório na ordem de exibição/exportação. */
export const REPORT_SECTIONS = [
  { key: "topics", title: "Tópicos discutidos" },
  { key: "questionsAndAnswers", title: "Perguntas e respostas" },
  { key: "decisions", title: "Decisões tomadas" },
  { key: "pendingItems", title: "Pendências" },
  { key: "actionItems", title: "Tarefas" },
  { key: "attentionPoints", title: "Pontos de atenção" },
  { key: "nextSteps", title: "Encaminhamentos" }
] as const;

export type SectionKey = (typeof REPORT_SECTIONS)[number]["key"];

export interface ReportLine {
  kind: "h1" | "h2" | "meta" | "p" | "bullet" | "small";
  text: string;
}

function itemLines(item: AnalysisItem & { assignee?: string; dueDate?: string; answer?: string }, report: ReportDocument): ReportLine[] {
  const tag = item.basis === "inferred" ? " (inferência da IA)" : "";
  const lines: ReportLine[] = [{ kind: "bullet", text: `${item.title}${tag}` }];
  if (item.description && item.description !== item.title) lines.push({ kind: "small", text: item.description });
  if (item.answer) lines.push({ kind: "small", text: `Resposta: ${item.answer}` });
  if ("assignee" in item || "dueDate" in item) {
    lines.push({ kind: "small", text: `Responsável: ${item.assignee ?? "não identificado"} · Prazo: ${item.dueDate ?? "não mencionado"}` });
  }
  const byId = new Map(report.transcript.map((s) => [s.id, s]));
  for (const ev of item.evidence) {
    const first = byId.get(ev.segmentIds[0] ?? "");
    const when = first ? `[${formatTimestamp(first.startMs)}] ` : "";
    if (ev.quote) lines.push({ kind: "small", text: `Evidência: ${when}"${ev.quote}"` });
    else if (first) lines.push({ kind: "small", text: `Evidência: ${when}${first.text.slice(0, 160)}` });
  }
  return lines;
}

/**
 * Representação linear do relatório usada por todos os exportadores,
 * garantindo o mesmo conteúdo em PDF, DOCX e Markdown.
 */
export function reportToLines(report: ReportDocument, options: { includeTranscript?: boolean } = {}): ReportLine[] {
  const speakerLabel = (id?: string) => report.speakers.find((s) => s.id === id)?.label ?? "Falante não identificado";
  const lines: ReportLine[] = [
    { kind: "h1", text: report.title },
    { kind: "meta", text: `Gerado em ${new Date(report.createdAt).toLocaleString("pt-BR")} pelo Ouve (${OUVE_CREDIT})` },
    {
      kind: "meta",
      text: "Conteúdo organizado por IA a partir da transcrição. Itens marcados como inferência não foram ditos explicitamente; revise antes de usar."
    }
  ];
  if (report.providers?.transcription || report.providers?.analysis) {
    lines.push({
      kind: "meta",
      text: `Provedores: transcrição — ${report.providers.transcription ?? "n/d"}; análise — ${report.providers.analysis ?? "n/d"}`
    });
  }
  if (report.speakers.length > 0) lines.push({ kind: "meta", text: `Participantes: ${report.speakers.map((s) => s.label).join(", ")}` });

  lines.push({ kind: "h2", text: "Resumo geral" });
  for (const paragraph of (report.analysis.summary || "Sem resumo.").split(/\n{2,}/)) lines.push({ kind: "p", text: paragraph.trim() });

  for (const section of REPORT_SECTIONS) {
    const items = report.analysis[section.key] as Array<AnalysisItem & { assignee?: string; dueDate?: string; answer?: string }>;
    lines.push({ kind: "h2", text: section.title });
    if (items.length === 0) lines.push({ kind: "small", text: "Nenhum item identificado." });
    for (const item of items) lines.push(...itemLines(item, report));
  }

  if (report.notes?.trim()) {
    lines.push({ kind: "h2", text: "Observações" });
    for (const paragraph of report.notes.split(/\n{2,}/)) lines.push({ kind: "p", text: paragraph.trim() });
  }

  if (options.includeTranscript ?? true) {
    lines.push({ kind: "h2", text: "Transcrição" });
    for (const s of report.transcript)
      lines.push({ kind: "p", text: `[${formatTimestamp(s.startMs)}] ${speakerLabel(s.speakerId)}: ${s.text}` });
  }
  return lines;
}

export function reportToMarkdown(report: ReportDocument, options?: { includeTranscript?: boolean }): string {
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
export function exportFileName(title: string, extension: "pdf" | "docx" | "md"): string {
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
