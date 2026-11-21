import type { ProviderSegment, TranscriptSegment } from "../ai/contracts.js";
import type { Speaker } from "./report.js";

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
      if (raw.speakerLabel) segment.speakerId = this.speakerFor(raw.speakerLabel);
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
    this.updateSegment(segmentId, (s) => ({ ...s, speakerId: targetId }));
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
    this.emit();
  }
}
