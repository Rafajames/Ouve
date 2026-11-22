import type { CompletionProvider, MeetingAnalysis, ReportContext, TranscriptSegment } from "@ouve/core";
import { OuveError, retry } from "@ouve/shared";
import { buildAnalysisMessages, buildSummaryConsolidationMessages, formatTranscriptForPrompt } from "./prompt.js";
import { extractJsonObject, mergeAnalyses, validateAnalysis } from "./validate.js";

export interface AnalyzeOptions {
  provider: CompletionProvider;
  segments: TranscriptSegment[];
  speakerLabel: (speakerId: string | undefined) => string;
  title?: string;
  language?: string;
  context?: ReportContext;
  /** Tamanho máximo de transcrição por chamada (caracteres). */
  maxCharsPerPart?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Divide a transcrição em partes que cabem no contexto do modelo, sem quebrar trechos. */
export function splitSegments(
  segments: TranscriptSegment[],
  maxChars: number,
  speakerLabel: AnalyzeOptions["speakerLabel"]
): TranscriptSegment[][] {
  const parts: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let size = 0;
  for (const segment of segments) {
    const length = formatTranscriptForPrompt([segment], speakerLabel).length + 1;
    if (current.length > 0 && size + length > maxChars) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(segment);
    size += length;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export async function analyzeTranscript(options: AnalyzeOptions): Promise<MeetingAnalysis> {
  if (options.segments.length === 0) throw new OuveError("invalid-input", "Não há transcrição para analisar.", { retryable: false });
  const parts = splitSegments(options.segments, options.maxCharsPerPart ?? 120_000, options.speakerLabel);
  const results: MeetingAnalysis[] = [];

  for (const [i, part] of parts.entries()) {
    const messages = buildAnalysisMessages(part, {
      speakerLabel: options.speakerLabel,
      ...(options.title ? { title: options.title } : {}),
      ...(options.language ? { language: options.language } : {}),
      ...(options.context ? { context: options.context } : {}),
      ...(parts.length > 1 ? { part: { index: i + 1, total: parts.length } } : {})
    });
    // Resposta inválida é reexecutável: o modelo pode acertar o formato na nova tentativa.
    const analysis = await retry(
      async () =>
        validateAnalysis(
          extractJsonObject(await options.provider.complete({ messages, json: true, temperature: 0.2 }, options.signal)),
          part,
          `p${i + 1}`
        ),
      { retries: 1, baseDelayMs: 1000, ...(options.signal ? { signal: options.signal } : {}) }
    );
    results.push(analysis);
    options.onProgress?.(i + 1, parts.length + (parts.length > 1 ? 1 : 0));
  }

  if (results.length === 1) return results[0] as MeetingAnalysis;

  let summary = results
    .map((r) => r.summary)
    .filter(Boolean)
    .join("\n\n");
  try {
    const raw = await options.provider.complete(
      {
        messages: buildSummaryConsolidationMessages(
          results.map((r) => r.summary),
          options.language
        ),
        json: true,
        temperature: 0.2
      },
      options.signal
    );
    const parsed = extractJsonObject(raw) as { summary?: unknown };
    if (typeof parsed.summary === "string" && parsed.summary.trim()) summary = parsed.summary.trim();
  } catch (error) {
    if (options.signal?.aborted) throw error;
    // Mantém a junção dos resumos parciais.
  }
  options.onProgress?.(parts.length + 1, parts.length + 1);
  const merged = mergeAnalyses(results, summary);
  merged.warnings.unshift(`Transcrição longa analisada em ${parts.length} partes.`);
  return merged;
}
