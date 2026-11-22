import type { TranscriptSegment } from "../ai/contracts.js";
import type { Speaker } from "./report.js";

/**
 * Métricas de participação calculadas localmente a partir dos segmentos e
 * timestamps — sem nenhuma chamada de IA. São indicadores descritivos, não
 * julgamentos: dependem da qualidade da transcrição e da diarização.
 */
export interface SpeakerMetrics {
  speakerId: string;
  label: string;
  /** Soma das durações das falas (ms). */
  talkMs: number;
  /** Fração do tempo total de fala (0–1). */
  share: number;
  /** Quantidade de intervenções (falas consecutivas do mesmo participante contam como uma). */
  turns: number;
  words: number;
  /** Palavras por minuto falado; undefined se o tempo for curto demais para estimar. */
  wordsPerMinute?: number;
  questions: number;
  /** Maior intervenção contínua (ms). */
  longestTurnMs: number;
  /** Intervalos de fala, já mesclando segmentos consecutivos: base da linha do tempo. */
  intervals: Array<{ startMs: number; endMs: number }>;
}

export interface Monologue {
  speakerId: string;
  startMs: number;
  endMs: number;
}

export interface SilenceGap {
  startMs: number;
  endMs: number;
}

export interface MeetingMetrics {
  /** Do início do primeiro trecho ao fim do último (ms). */
  spanMs: number;
  totalTalkMs: number;
  turns: number;
  /** Trocas de participante entre falas consecutivas. */
  speakerChanges: number;
  questions: number;
  speakers: SpeakerMetrics[];
  monologues: Monologue[];
  silences: SilenceGap[];
  /** Participação por faixa de tempo (para o gráfico de distribuição). */
  buckets: Array<{ startMs: number; endMs: number; bySpeaker: Record<string, number> }>;
  /** Trechos sem falante identificado (ms). */
  unattributedMs: number;
}

export interface MetricsOptions {
  /** Intervenção contínua acima disto é um monólogo. Padrão: 2 min. */
  monologueMs?: number;
  /** Silêncio entre falas acima disto é registrado. Padrão: 10 s. */
  silenceMs?: number;
  /** Duas falas do mesmo participante separadas por menos que isto contam como uma intervenção. Padrão: 2 s. */
  mergeGapMs?: number;
  /** Quantidade de faixas para a distribuição. Padrão: 12. */
  buckets?: number;
}

export const METRICS_LIMITATIONS =
  "Indicadores calculados a partir da transcrição: dependem da precisão dos horários e da separação de vozes feitas pela IA. " +
  "Perguntas são contadas pelo ponto de interrogação. Não medem qualidade, comportamento ou competência de ninguém.";

const UNKNOWN = "__sem_falante__";

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function countQuestions(text: string): number {
  return (text.match(/\?+/g) ?? []).length;
}

export function computeMetrics(segments: TranscriptSegment[], speakers: Speaker[], options: MetricsOptions = {}): MeetingMetrics {
  const monologueMs = options.monologueMs ?? 120_000;
  const silenceMs = options.silenceMs ?? 10_000;
  const mergeGapMs = options.mergeGapMs ?? 2_000;
  const bucketCount = Math.max(1, options.buckets ?? 12);

  const list = segments.filter((s) => s.text.trim() && s.endMs >= s.startMs).sort((a, b) => a.startMs - b.startMs);
  const labelOf = new Map(speakers.map((s) => [s.id, s.label]));
  const bySpeaker = new Map<string, SpeakerMetrics>();
  const get = (id: string): SpeakerMetrics => {
    let m = bySpeaker.get(id);
    if (!m) {
      m = {
        speakerId: id,
        label: labelOf.get(id) ?? "Falante não identificado",
        talkMs: 0,
        share: 0,
        turns: 0,
        words: 0,
        questions: 0,
        longestTurnMs: 0,
        intervals: []
      };
      bySpeaker.set(id, m);
    }
    return m;
  };

  let turns = 0;
  let speakerChanges = 0;
  let questions = 0;
  let unattributedMs = 0;
  const monologues: Monologue[] = [];
  const silences: SilenceGap[] = [];
  let prevSpeaker: string | undefined;
  let lastEnd: number | undefined;

  for (const seg of list) {
    const id = seg.speakerId ?? UNKNOWN;
    const dur = seg.endMs - seg.startMs;
    const m = get(id);
    m.talkMs += dur;
    m.words += countWords(seg.text);
    const q = countQuestions(seg.text);
    m.questions += q;
    questions += q;
    if (id === UNKNOWN) unattributedMs += dur;

    if (lastEnd !== undefined && seg.startMs - lastEnd >= silenceMs) silences.push({ startMs: lastEnd, endMs: seg.startMs });

    const last = m.intervals[m.intervals.length - 1];
    const continues = prevSpeaker === id && last !== undefined && seg.startMs - last.endMs < mergeGapMs;
    if (continues && last) {
      last.endMs = Math.max(last.endMs, seg.endMs);
    } else {
      m.intervals.push({ startMs: seg.startMs, endMs: seg.endMs });
      m.turns += 1;
      turns += 1;
      if (prevSpeaker !== undefined && prevSpeaker !== id) speakerChanges += 1;
    }
    prevSpeaker = id;
    lastEnd = Math.max(lastEnd ?? 0, seg.endMs);
  }

  for (const m of bySpeaker.values()) {
    for (const iv of m.intervals) {
      const len = iv.endMs - iv.startMs;
      m.longestTurnMs = Math.max(m.longestTurnMs, len);
      if (len >= monologueMs && m.speakerId !== UNKNOWN) monologues.push({ speakerId: m.speakerId, ...iv });
    }
  }

  const totalTalkMs = [...bySpeaker.values()].reduce((sum, m) => sum + m.talkMs, 0);
  for (const m of bySpeaker.values()) {
    m.share = totalTalkMs > 0 ? m.talkMs / totalTalkMs : 0;
    if (m.talkMs >= 15_000) m.wordsPerMinute = Math.round(m.words / (m.talkMs / 60_000));
  }

  const start = list[0]?.startMs ?? 0;
  const end = list.reduce((max, s) => Math.max(max, s.endMs), start);
  const spanMs = Math.max(0, end - start);
  const size = spanMs / bucketCount;
  const buckets: MeetingMetrics["buckets"] = [];
  if (spanMs > 0) {
    for (let i = 0; i < bucketCount; i++) buckets.push({ startMs: start + i * size, endMs: start + (i + 1) * size, bySpeaker: {} });
    for (const seg of list) {
      const id = seg.speakerId ?? UNKNOWN;
      for (const b of buckets) {
        const overlap = Math.min(seg.endMs, b.endMs) - Math.max(seg.startMs, b.startMs);
        if (overlap > 0) b.bySpeaker[id] = (b.bySpeaker[id] ?? 0) + overlap;
      }
    }
  }

  const ordered = [...bySpeaker.values()].sort((a, b) => b.talkMs - a.talkMs);
  monologues.sort((a, b) => a.startMs - b.startMs);
  return { spanMs, totalTalkMs, turns, speakerChanges, questions, speakers: ordered, monologues, silences, buckets, unattributedMs };
}

/** Formata duração legível: "1 h 05 min", "3 min 20 s", "45 s". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${String(min).padStart(2, "0")} min`;
  if (min > 0) return `${min} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}
