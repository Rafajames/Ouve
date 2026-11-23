import type { ProviderSegment, TranscriptSegment } from "../ai/contracts.js";
import type { Speaker } from "./report.js";
import { matchTurns, type SpeakerTurn } from "./speaker-turns.js";

/** Quem decidiu o falante de um trecho; uma fonte só substitui outra de prioridade igual ou menor. */
const SPEAKER_PRIORITY = { provider: 1, auto: 2, keys: 3, manual: 4 } as const;
export type SpeakerSource = keyof typeof SPEAKER_PRIORITY;

export interface TranscriptChunkResult {
  chunkIndex: number;
  /** Início do bloco relativo ao início da sessão. */
  offsetMs: number;
  segments: ProviderSegment[];
}

const SPEAKER_COLORS = ["azul", "verde", "laranja", "roxo", "rosa", "ciano", "amarelo", "cinza"];

/**
 * Transcrição da sessão em memória.
 * - Idempotente por bloco: reaplicar o mesmo `chunkIndex` substitui, nunca duplica.
 * - Falantes recebem identificadores neutros (Falante 1, 2...). Nomes só mudam por ação do usuário.
 * - Rótulos de diarização são locais a cada bloco no provedor; o mapeamento global por
 *   rótulo é aproximado e documentado como limitação.
 */
export class TranscriptStore {
  private readonly chunks = new Map<number, TranscriptSegment[]>();
  private readonly speakers = new Map<string, Speaker>();
  private readonly labelToSpeaker = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private readonly speakerSource = new Map<string, number>();

  constructor(private readonly lowConfidenceThreshold = 0.6) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  hasChunk(chunkIndex: number): boolean {
    return this.chunks.has(chunkIndex);
  }

  applyChunk(result: TranscriptChunkResult): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    result.segments.forEach((raw, i) => {
      const text = raw.text.trim();
      if (!text) return;
      const segment: TranscriptSegment = {
        id: `seg-${result.chunkIndex}-${i}`,
        startMs: Math.max(0, Math.round(result.offsetMs + raw.startMs)),
        endMs: Math.max(0, Math.round(result.offsetMs + Math.max(raw.endMs, raw.startMs))),
        text,
        chunkIndex: result.chunkIndex
      };
      if (raw.speakerLabel) {
        segment.speakerId = this.speakerFor(raw.speakerLabel);
        this.speakerSource.set(segment.id, SPEAKER_PRIORITY.provider);
      }
      if (raw.confidence !== undefined) segment.confidence = raw.confidence;
      segments.push(segment);
    });
    this.chunks.set(result.chunkIndex, segments);
    this.emit();
    return segments;
  }

  private speakerFor(label: string): string {
    const existing = this.labelToSpeaker.get(label);
    if (existing) return existing;
    const n = this.speakers.size + 1;
    const speaker: Speaker = {
      id: `spk-${n}`,
      label: `Falante ${n}`,
      colorToken: SPEAKER_COLORS[(n - 1) % SPEAKER_COLORS.length] ?? "cinza"
    };
    this.speakers.set(speaker.id, speaker);
    this.labelToSpeaker.set(label, speaker.id);
    return speaker.id;
  }

  segments(): TranscriptSegment[] {
    return [...this.chunks.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, list]) => list)
      .sort((a, b) => a.startMs - b.startMs || (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
  }

  speakerList(): Speaker[] {
    return [...this.speakers.values()];
  }

  renameSpeaker(speakerId: string, label: string): void {
    const speaker = this.speakers.get(speakerId);
    if (!speaker) throw new Error("Falante não encontrado.");
    const clean = label.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!clean) throw new Error("O nome do falante não pode ficar vazio.");
    this.speakers.set(speakerId, { ...speaker, label: clean });
    this.emit();
  }

  /** Atribui manualmente um segmento a um falante (criando um novo se necessário). */
  assignSpeaker(segmentId: string, speakerId: string | "new"): void {
    const targetId = speakerId === "new" ? this.speakerFor(`manual-${this.speakers.size + 1}`) : speakerId;
    if (!this.speakers.has(targetId)) throw new Error("Falante não encontrado.");
    this.speakerSource.set(segmentId, SPEAKER_PRIORITY.manual);
    this.updateSegment(segmentId, (s) => ({ ...s, speakerId: targetId }));
  }

  /** Falante já criado para um rótulo de origem (ex.: "tecla:2"), se houver. */
  speakerIdForLabel(label: string): string | undefined {
    return this.labelToSpeaker.get(label);
  }

  /** Garante um falante para o rótulo, com nome inicial (ex.: tecla 2 = "Testemunha"). Não renomeia depois. */
  defineSpeaker(label: string, name?: string): string {
    const existed = this.labelToSpeaker.has(label);
    const id = this.speakerFor(label);
    const clean = name?.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!existed && clean) this.speakers.set(id, { ...(this.speakers.get(id) as Speaker), label: clean });
    return id;
  }

  /**
   * Aplica turnos de fala aos trechos por maior sobreposição de tempo. Não desfaz
   * escolhas de fonte mais forte (atribuição manual > teclas > automático > provedor).
   * Retorna quantos trechos mudaram.
   */
  applySpeakerTurns(turns: SpeakerTurn[], source: "auto" | "keys", names: Record<string, string> = {}): number {
    const priority = SPEAKER_PRIORITY[source];
    const matches = matchTurns(this.segments(), turns);
    let changed = 0;
    for (const [index, list] of this.chunks) {
      let next: TranscriptSegment[] | undefined;
      list.forEach((seg, i) => {
        const label = matches.get(seg.id);
        if (!label || (this.speakerSource.get(seg.id) ?? 0) > priority) return;
        const speakerId = this.defineSpeaker(label, names[label]);
        this.speakerSource.set(seg.id, priority);
        if (seg.speakerId === speakerId) return;
        next ??= [...list];
        next[i] = { ...seg, speakerId };
        changed++;
      });
      if (next) this.chunks.set(index, next);
    }
    if (changed) this.emit();
    return changed;
  }

  editSegmentText(segmentId: string, text: string): void {
    this.updateSegment(segmentId, (s) => ({ ...s, text: text.trim(), edited: true }));
  }

  private updateSegment(segmentId: string, update: (s: TranscriptSegment) => TranscriptSegment): void {
    for (const [index, list] of this.chunks) {
      const position = list.findIndex((s) => s.id === segmentId);
      if (position >= 0) {
        const next = [...list];
        next[position] = update(list[position] as TranscriptSegment);
        this.chunks.set(index, next);
        this.emit();
        return;
      }
    }
    throw new Error("Trecho não encontrado.");
  }

  isLowConfidence(segment: TranscriptSegment): boolean {
    return segment.confidence !== undefined && segment.confidence < this.lowConfidenceThreshold;
  }

  speakerLabel(speakerId: string | undefined): string {
    if (!speakerId) return "Falante não identificado";
    return this.speakers.get(speakerId)?.label ?? "Falante não identificado";
  }

  /** Texto plano com marcação temporal e falante (para análise e exportação). */
  toPlainText(formatTime: (ms: number) => string): string {
    return this.segments()
      .map((s) => `[${formatTime(s.startMs)}] ${this.speakerLabel(s.speakerId)}: ${s.text}`)
      .join("\n");
  }

  clear(): void {
    this.chunks.clear();
    this.speakers.clear();
    this.labelToSpeaker.clear();
    this.speakerSource.clear();
    this.emit();
  }
}
