import type { TranscriptSegment } from "../ai/contracts.js";

/** Marcadores locais registrados durante a captura ou a revisão. Nenhum custo de IA. */
export type MarkerKind = "decision" | "question" | "relevant" | "divergence" | "followup" | "review";

export interface Marker {
  id: string;
  kind: MarkerKind;
  /** Tempo decorrido da sessão (não o relógio). */
  atMs: number;
  note?: string;
  /** "user" = criado pelo usuário; "suggested" = sugerido pelos avisos locais. */
  origin: "user" | "suggested";
}

export const MARKER_KINDS: Array<{ kind: MarkerKind; label: string; shortcut: string }> = [
  { kind: "decision", label: "Decisão", shortcut: "1" },
  { kind: "question", label: "Pergunta pendente", shortcut: "2" },
  { kind: "relevant", label: "Informação relevante", shortcut: "3" },
  { kind: "divergence", label: "Divergência", shortcut: "4" },
  { kind: "followup", label: "Encaminhamento", shortcut: "5" },
  { kind: "review", label: "Ponto para revisar", shortcut: "6" }
];

export function markerLabel(kind: MarkerKind): string {
  return MARKER_KINDS.find((m) => m.kind === kind)?.label ?? kind;
}

export function isMarkerKind(value: unknown): value is MarkerKind {
  return typeof value === "string" && MARKER_KINDS.some((m) => m.kind === value);
}

/** Lista de marcadores ordenada, com edição e remoção. */
export class MarkerStore {
  private items: Marker[] = [];
  private seq = 0;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  add(kind: MarkerKind, atMs: number, options: { note?: string; origin?: Marker["origin"] } = {}): Marker {
    const marker: Marker = { id: `mk-${++this.seq}`, kind, atMs: Math.max(0, Math.round(atMs)), origin: options.origin ?? "user" };
    const note = options.note?.replace(/\s+/g, " ").trim().slice(0, 300);
    if (note) marker.note = note;
    this.items = [...this.items, marker].sort((a, b) => a.atMs - b.atMs);
    this.emit();
    return marker;
  }

  update(id: string, patch: Partial<Pick<Marker, "kind" | "note" | "origin">>): void {
    this.items = this.items.map((m) => (m.id === id ? { ...m, ...patch } : m));
    this.emit();
  }

  remove(id: string): void {
    this.items = this.items.filter((m) => m.id !== id);
    this.emit();
  }

  list(): Marker[] {
    return this.items;
  }

  clear(): void {
    this.items = [];
    this.emit();
  }
}

/** Trecho da transcrição mais próximo do marcador (o que contém o instante ou o imediatamente anterior). */
export function segmentForMarker(segments: TranscriptSegment[], atMs: number): TranscriptSegment | undefined {
  let best: TranscriptSegment | undefined;
  for (const s of segments) {
    if (s.startMs <= atMs && atMs <= s.endMs) return s;
    if (s.startMs <= atMs && (!best || s.startMs > best.startMs)) best = s;
  }
  return best ?? segments[0];
}
