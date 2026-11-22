/**
 * Cronometragem por etapa do processamento (preparação, conversão, envio,
 * transcrição, análise, exportação). Serve para mostrar ao usuário o que está
 * acontecendo e para descobrir onde está a demora — sem guardar conteúdo.
 */
export type StageName = "prepare" | "convert" | "upload" | "transcribe" | "diarize" | "analyze" | "report" | "export";

export const STAGE_LABELS: Record<StageName, string> = {
  prepare: "Preparação do áudio",
  convert: "Conversão de formato",
  upload: "Envio ao provedor",
  transcribe: "Transcrição",
  diarize: "Separação de vozes",
  analyze: "Análise",
  report: "Montagem do relatório",
  export: "Exportação"
};

export interface StageRecord {
  stage: StageName;
  startedAt: number;
  endedAt?: number;
  /** Tempo efetivo acumulado (várias execuções da mesma etapa, ex.: blocos em paralelo contam pelo intervalo total). */
  durationMs?: number;
  status: "running" | "done" | "failed" | "canceled";
  detail?: string;
}

export class StageTimer {
  private records = new Map<StageName, StageRecord>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly now: () => number = () => Date.now()) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  start(stage: StageName, detail?: string): void {
    const existing = this.records.get(stage);
    const record: StageRecord =
      existing && existing.status === "running" ? existing : { stage, startedAt: existing?.startedAt ?? this.now(), status: "running" };
    record.status = "running";
    if (detail) record.detail = detail;
    this.records.set(stage, record);
    this.emit();
  }

  end(stage: StageName, status: Exclude<StageRecord["status"], "running"> = "done", detail?: string): void {
    const r = this.records.get(stage);
    if (!r) return;
    r.endedAt = this.now();
    r.durationMs = r.endedAt - r.startedAt;
    r.status = status;
    if (detail) r.detail = detail;
    this.emit();
  }

  /** Executa `fn` cronometrando a etapa. */
  async measure<T>(stage: StageName, fn: () => Promise<T>, detail?: string): Promise<T> {
    this.start(stage, detail);
    try {
      const value = await fn();
      this.end(stage, "done");
      return value;
    } catch (err) {
      const canceled = err instanceof Error && (err.name === "AbortError" || /cancel/i.test(err.message));
      this.end(stage, canceled ? "canceled" : "failed");
      throw err;
    }
  }

  list(): StageRecord[] {
    return [...this.records.values()].sort((a, b) => a.startedAt - b.startedAt);
  }

  elapsed(record: StageRecord): number {
    return record.durationMs ?? this.now() - record.startedAt;
  }

  reset(): void {
    this.records.clear();
    this.emit();
  }
}
