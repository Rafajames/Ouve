import type { TranscriptSegment } from "../ai/contracts.js";

/**
 * Turnos de fala: "quem falou de que minuto a que minuto" (tempo decorrido da sessão).
 * Vêm da separação automática de vozes (sherpa-onnx) ou da marcação manual por teclas.
 */
export interface SpeakerTurn {
  startMs: number;
  endMs: number;
  /** Rótulo estável da origem (ex.: "auto:speaker_00", "tecla:2"). */
  label: string;
}

/** Para cada trecho, o rótulo do turno com maior sobreposição (ou nenhum, se não houver). */
export function matchTurns(segments: TranscriptSegment[], turns: SpeakerTurn[]): Map<string, string> {
  const sorted = [...turns].filter((t) => t.endMs > t.startMs).sort((a, b) => a.startMs - b.startMs);
  const out = new Map<string, string>();
  for (const seg of segments) {
    const start = seg.startMs;
    // Trecho sem duração (alguns provedores): considera 1 s a partir do início.
    const end = seg.endMs > seg.startMs ? seg.endMs : seg.startMs + 1000;
    const totals = new Map<string, number>();
    for (const t of sorted) {
      if (t.startMs >= end) break;
      const overlap = Math.min(end, t.endMs) - Math.max(start, t.startMs);
      if (overlap > 0) totals.set(t.label, (totals.get(t.label) ?? 0) + overlap);
    }
    let best: string | undefined;
    let bestMs = 0;
    for (const [label, ms] of totals)
      if (ms > bestMs) {
        best = label;
        bestMs = ms;
      }
    if (best) out.set(seg.id, best);
  }
  return out;
}

/** Lê a saída do sherpa-onnx ("0.638 -- 6.848 speaker_00") em turnos. */
export function parseSherpaTurns(stdout: string): SpeakerTurn[] {
  const turns: SpeakerTurn[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = /^\s*(\d+(?:\.\d+)?)\s+--\s+(\d+(?:\.\d+)?)\s+(speaker_\d+)/.exec(line);
    if (!m) continue;
    const startMs = Math.round(Number(m[1]) * 1000);
    const endMs = Math.round(Number(m[2]) * 1000);
    if (endMs > startMs) turns.push({ startMs, endMs, label: `auto:${m[3]}` });
  }
  return turns;
}

/**
 * Marcação manual durante a captura: a pessoa aperta 1–9 e aquele falante passa a
 * valer a partir do instante atual, até a próxima tecla (ou 0 para "ninguém").
 */
export class SpeakerMarks {
  private readonly marks: Array<{ atMs: number; key: number }> = [];

  mark(key: number, atMs: number): void {
    if (!Number.isInteger(key) || key < 0 || key > 9) throw new Error("Tecla de falante inválida.");
    const last = this.marks[this.marks.length - 1];
    if (last && last.key === key) return;
    if (last && atMs < last.atMs) atMs = last.atMs;
    this.marks.push({ atMs: Math.max(0, Math.round(atMs)), key });
  }

  current(): number | undefined {
    const key = this.marks[this.marks.length - 1]?.key;
    return key ? key : undefined;
  }

  isEmpty(): boolean {
    return this.marks.length === 0;
  }

  /** Turnos fechados até `untilMs` (tecla 0 encerra sem falante). */
  toTurns(untilMs: number): SpeakerTurn[] {
    const turns: SpeakerTurn[] = [];
    this.marks.forEach((m, i) => {
      const end = this.marks[i + 1]?.atMs ?? untilMs;
      if (m.key > 0 && end > m.atMs) turns.push({ startMs: m.atMs, endMs: end, label: `tecla:${m.key}` });
    });
    return turns;
  }

  clear(): void {
    this.marks.length = 0;
  }
}
