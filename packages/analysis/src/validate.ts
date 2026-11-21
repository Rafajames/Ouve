import {
  emptyAnalysis,
  type ActionItem,
  type AnalysisBasis,
  type AnalysisEvidence,
  type AnalysisItem,
  type MeetingAnalysis,
  type QuestionAnswer,
  type TranscriptSegment
} from "@ouve/core";
import { OuveError, sanitizeText } from "@ouve/shared";

const LIST_KEYS = ["topics", "questionsAndAnswers", "decisions", "pendingItems", "actionItems", "attentionPoints", "nextSteps"] as const;
type ListKey = (typeof LIST_KEYS)[number];

const LABELS: Record<ListKey, string> = {
  topics: "tópico",
  questionsAndAnswers: "pergunta",
  decisions: "decisão",
  pendingItems: "pendência",
  actionItems: "tarefa",
  attentionPoints: "ponto de atenção",
  nextSteps: "encaminhamento"
};

const MAX_ITEMS = 60;

/** Extrai o primeiro objeto JSON de uma resposta (tolera cercas de código). */
export function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new OuveError("invalid-response", "A análise não retornou JSON.", { retryable: true });
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new OuveError("invalid-response", "A análise retornou JSON inválido.", { retryable: true });
  }
}

const str = (v: unknown, max = 4000): string => (typeof v === "string" ? sanitizeText(v, max).trim() : "");

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Valida e higieniza a saída do modelo contra a transcrição real:
 * - descarta ids de evidência inexistentes;
 * - item "explicit" sem evidência válida é rebaixado para "inferred";
 * - responsável/prazo que não aparecem nos trechos citados são removidos;
 * - limita tamanho e quantidade de itens.
 */
export function validateAnalysis(raw: unknown, segments: TranscriptSegment[], idPrefix = "a"): MeetingAnalysis {
  if (typeof raw !== "object" || raw === null)
    throw new OuveError("invalid-response", "Formato de análise inesperado.", { retryable: true });
  const data = raw as Record<string, unknown>;
  const byId = new Map(segments.map((s) => [s.id, s]));
  const result = emptyAnalysis();
  result.summary = str(data.summary, 8000);
  let counter = 0;

  for (const key of LIST_KEYS) {
    const list = Array.isArray(data[key]) ? (data[key] as unknown[]).slice(0, MAX_ITEMS) : [];
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null) continue;
      const item = entry as Record<string, unknown>;
      const title = str(item.title, 300);
      const description = str(item.description);
      if (!title && !description) continue;

      const evidence: AnalysisEvidence[] = [];
      for (const ev of Array.isArray(item.evidence) ? item.evidence : []) {
        const e = ev as Record<string, unknown>;
        const ids = (Array.isArray(e.segmentIds) ? e.segmentIds : []).filter((id): id is string => typeof id === "string" && byId.has(id));
        if (ids.length === 0) continue;
        const quote = str(e.quote, 500);
        evidence.push(quote ? { segmentIds: ids, quote } : { segmentIds: ids });
      }

      let basis: AnalysisBasis = item.basis === "explicit" ? "explicit" : "inferred";
      if (basis === "explicit" && evidence.length === 0) {
        basis = "inferred";
        result.warnings.push(`Um(a) ${LABELS[key]} foi marcado(a) como inferência por não ter trecho de evidência válido.`);
      }

      const base: AnalysisItem = {
        id: `${idPrefix}-${key}-${++counter}`,
        title: title || description.slice(0, 80),
        description,
        basis,
        evidence
      };
      if (typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 1) base.confidence = item.confidence;

      if (key === "actionItems") {
        const evidenceText = normalize(evidence.flatMap((e) => e.segmentIds.map((id) => byId.get(id)?.text ?? "")).join(" "));
        const action: ActionItem = { ...base };
        for (const field of ["assignee", "dueDate"] as const) {
          const value = str(item[field], 200);
          if (!value) continue;
          if (evidenceText.includes(normalize(value))) action[field] = value;
          else
            result.warnings.push(`${field === "assignee" ? "Responsável" : "Prazo"} "${value}" removido: não aparece nos trechos citados.`);
        }
        result.actionItems.push(action);
      } else if (key === "questionsAndAnswers") {
        const qa: QuestionAnswer = { ...base };
        const answer = str(item.answer);
        if (answer) qa.answer = answer;
        result.questionsAndAnswers.push(qa);
      } else {
        result[key].push(base);
      }
    }
  }
  return result;
}

/** Junta análises de partes de uma transcrição longa. */
export function mergeAnalyses(parts: MeetingAnalysis[], summary: string): MeetingAnalysis {
  const merged = emptyAnalysis();
  merged.summary = summary;
  for (const part of parts) {
    for (const key of LIST_KEYS) (merged[key] as AnalysisItem[]).push(...(part[key] as AnalysisItem[]));
    merged.warnings.push(...part.warnings);
  }
  return merged;
}
