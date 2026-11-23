import type { TranscriptSegment } from "../ai/contracts.js";
import type { MarkerKind } from "./markers.js";

/**
 * Avisos discretos durante a reunião, calculados por regras locais sobre a
 * transcrição já recebida — nenhuma chamada extra de IA. Opcionais e com
 * intervalo mínimo entre avisos para não interromper o usuário.
 */
export interface LiveHint {
  id: string;
  kind: "pending-question" | "long-turn" | "suggested-marker";
  text: string;
  atMs: number;
  segmentId?: string;
  suggestedMarker?: MarkerKind;
}

const CUES: Array<{ re: RegExp; marker: MarkerKind; text: string }> = [
  {
    re: /\b(fica decidido|ficou decidido|decidimos|está decidido|aprovad[oa]s?|bater o martelo|defiro|indefiro|homologo)\b/i,
    marker: "decision",
    text: "Possível decisão"
  },
  {
    re: /\b(prazo|até (o dia|a próxima|sexta|segunda|amanhã)|vence(r)? (em|no|na)|dentro de \d+ dias)\b/i,
    marker: "followup",
    text: "Prazo mencionado"
  },
  {
    re: /\b(vou (enviar|mandar|verificar|providenciar)|fica(rá)? responsável|encaminh(ar|o|amos))\b/i,
    marker: "followup",
    text: "Possível encaminhamento"
  },
  { re: /\b(discordo|não concordo|não é bem assim|contradi[zç]|impugn)/i, marker: "divergence", text: "Possível divergência" }
];

export interface LiveHintOptions {
  /** Intervalo mínimo entre avisos (ms). Padrão: 90 s. */
  cooldownMs?: number;
  /** Pergunta sem fala de outro participante por este tempo vira aviso. Padrão: 20 s. */
  unansweredMs?: number;
  /** Intervenção contínua acima disto gera aviso. Padrão: 3 min. */
  longTurnMs?: number;
}

export class LiveHintEngine {
  private lastHintAt = -Infinity;
  private readonly seen = new Set<string>();
  private seq = 0;
  constructor(private readonly options: LiveHintOptions = {}) {}

  reset(): void {
    this.lastHintAt = -Infinity;
    this.seen.clear();
  }

  /** Avalia a transcrição até `nowMs` e devolve no máximo um aviso novo, respeitando o intervalo. */
  evaluate(segments: TranscriptSegment[], nowMs: number): LiveHint | undefined {
    const cooldown = this.options.cooldownMs ?? 90_000;
    if (nowMs - this.lastHintAt < cooldown) return undefined;
    const hint = this.cue(segments) ?? this.pendingQuestion(segments, nowMs) ?? this.longTurn(segments);
    if (hint) this.lastHintAt = nowMs;
    return hint;
  }

  private make(key: string, h: Omit<LiveHint, "id">): LiveHint | undefined {
    if (this.seen.has(key)) return undefined;
    this.seen.add(key);
    return { id: `hint-${++this.seq}`, ...h };
  }

  private cue(segments: TranscriptSegment[]): LiveHint | undefined {
    for (const s of segments.slice(-6)) {
      for (const c of CUES) {
        if (c.re.test(s.text)) {
          const h = this.make(`cue:${s.id}`, {
            kind: "suggested-marker",
            text: c.text,
            atMs: s.startMs,
            segmentId: s.id,
            suggestedMarker: c.marker
          });
          if (h) return h;
        }
      }
    }
    return undefined;
  }

  private pendingQuestion(segments: TranscriptSegment[], nowMs: number): LiveHint | undefined {
    const wait = this.options.unansweredMs ?? 20_000;
    for (let i = segments.length - 1; i >= Math.max(0, segments.length - 8); i--) {
      const s = segments[i]!;
      if (!s.text.includes("?") || nowMs - s.endMs < wait) continue;
      const answered = segments.slice(i + 1).some((n) => n.speakerId !== s.speakerId);
      if (!answered)
        return this.make(`q:${s.id}`, {
          kind: "pending-question",
          text: "Pergunta ainda sem resposta",
          atMs: s.startMs,
          segmentId: s.id,
          suggestedMarker: "question"
        });
    }
    return undefined;
  }

  private longTurn(segments: TranscriptSegment[]): LiveHint | undefined {
    const limit = this.options.longTurnMs ?? 180_000;
    const last = segments[segments.length - 1];
    if (!last?.speakerId) return undefined;
    let start = last.startMs;
    for (let i = segments.length - 2; i >= 0; i--) {
      const s = segments[i]!;
      if (s.speakerId !== last.speakerId) break;
      start = s.startMs;
    }
    if (last.endMs - start < limit) return undefined;
    return this.make(`turn:${last.speakerId}:${start}`, {
      kind: "long-turn",
      text: "Fala longa de um mesmo participante",
      atMs: start,
      segmentId: last.id
    });
  }
}
