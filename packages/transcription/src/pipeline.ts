import type { TranscriptStore, TranscriptionProvider } from "@ouve/core";
import { OuveError, retry, toOuveError } from "@ouve/shared";

export interface AudioJob {
  index: number;
  offsetMs: number;
  durationMs: number;
  mimeType: string;
  /** Dados temporários em memória; liberados após transcrição bem-sucedida ou descarte. */
  data: Uint8Array | Blob;
  silent?: boolean;
}

export type JobState = "queued" | "running" | "done" | "skipped" | "failed";

export interface PipelineStats {
  queued: number;
  running: number;
  done: number;
  skipped: number;
  failed: number;
  /** Fim do último trecho transcrito, em ms. */
  transcribedUntilMs: number;
}

export interface PipelineOptions {
  provider: TranscriptionProvider;
  store: TranscriptStore;
  language?: string;
  concurrency?: number;
  retries?: number;
  /** Envia blocos silenciosos mesmo assim (padrão: pula para economizar custo). */
  transcribeSilence?: boolean;
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onStats?: (stats: PipelineStats) => void;
  onJobError?: (index: number, error: OuveError) => void;
}

/**
 * Fila de transcrição em tempo real e de arquivos.
 * - Idempotente: um índice já transcrito, enfileirado ou em execução é ignorado.
 * - Falhas ficam retidas em memória para nova tentativa (sem duplicar segmentos).
 * - Cancelamento interrompe requisições em andamento.
 */
export class TranscriptionPipeline {
  private readonly jobs = new Map<number, { job: AudioJob; state: JobState }>();
  private readonly order: number[] = [];
  private running = 0;
  private controller = new AbortController();
  private idleWaiters: Array<() => void> = [];
  private readonly concurrency: number;

  constructor(private readonly options: PipelineOptions) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
  }

  enqueue(job: AudioJob): boolean {
    if (this.jobs.has(job.index) || this.options.store.hasChunk(job.index)) return false;
    if (job.silent && !this.options.transcribeSilence) {
      this.jobs.set(job.index, { job: { ...job, data: new Uint8Array(0) }, state: "skipped" });
      this.options.store.applyChunk({ chunkIndex: job.index, offsetMs: job.offsetMs, segments: [] });
      this.publish();
      return true;
    }
    this.jobs.set(job.index, { job, state: "queued" });
    this.order.push(job.index);
    this.order.sort((a, b) => a - b);
    this.publish();
    this.pump();
    return true;
  }

  /** Reenfileira blocos que falharam. */
  retryFailed(): number {
    let count = 0;
    for (const [index, entry] of this.jobs) {
      if (entry.state === "failed") {
        entry.state = "queued";
        this.order.push(index);
        count += 1;
      }
    }
    this.order.sort((a, b) => a - b);
    this.publish();
    this.pump();
    return count;
  }

  stats(): PipelineStats {
    const stats: PipelineStats = { queued: 0, running: 0, done: 0, skipped: 0, failed: 0, transcribedUntilMs: 0 };
    for (const { job, state } of this.jobs.values()) {
      stats[state] += 1;
      if (state === "done" || state === "skipped")
        stats.transcribedUntilMs = Math.max(stats.transcribedUntilMs, job.offsetMs + job.durationMs);
    }
    return stats;
  }

  /** Resolve quando não houver trabalho pendente. */
  whenIdle(): Promise<void> {
    if (this.running === 0 && this.order.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  /** Cancela requisições em andamento; blocos pendentes ficam como falhos para retomada. */
  cancel(): void {
    this.controller.abort();
    this.controller = new AbortController();
    for (const index of this.order.splice(0)) {
      const entry = this.jobs.get(index);
      if (entry) entry.state = "failed";
    }
    this.publish();
  }

  /** Libera todo áudio temporário em memória. */
  discard(): void {
    this.cancel();
    this.jobs.clear();
    this.publish();
  }

  private pump(): void {
    while (this.running < this.concurrency && this.order.length > 0) {
      const index = this.order.shift() as number;
      const entry = this.jobs.get(index);
      if (!entry || entry.state !== "queued") continue;
      entry.state = "running";
      this.running += 1;
      void this.run(entry).finally(() => {
        this.running -= 1;
        this.publish();
        this.pump();
        if (this.running === 0 && this.order.length === 0) {
          const waiters = this.idleWaiters.splice(0);
          waiters.forEach((resolve) => resolve());
        }
      });
    }
  }

  private previousText(index: number): string {
    return this.options.store
      .segments()
      .filter((s) => (s.chunkIndex ?? 0) < index)
      .slice(-5)
      .map((s) => s.text)
      .join(" ");
  }

  private async run(entry: { job: AudioJob; state: JobState }): Promise<void> {
    const { job } = entry;
    const signal = this.controller.signal;
    try {
      const audio = job.data instanceof Blob ? job.data : new Blob([job.data as BlobPart], { type: job.mimeType });
      const previousText = this.previousText(job.index);
      const result = await retry(
        () =>
          this.options.provider.transcribe(
            {
              audio,
              mimeType: job.mimeType,
              durationMs: job.durationMs,
              ...(this.options.language ? { language: this.options.language } : {}),
              ...(previousText ? { previousText } : {})
            },
            signal
          ),
        { retries: this.options.retries ?? 2, baseDelayMs: 1500, signal, ...(this.options.delay ? { delay: this.options.delay } : {}) }
      );
      if (signal.aborted) throw new OuveError("cancelled", "Operação cancelada.");
      this.options.store.applyChunk({ chunkIndex: job.index, offsetMs: job.offsetMs, segments: result.segments });
      entry.state = "done";
      entry.job = { ...job, data: new Uint8Array(0) };
    } catch (error) {
      const e = toOuveError(error);
      entry.state = "failed";
      if (e.code !== "cancelled") this.options.onJobError?.(job.index, e);
    }
  }

  private publish(): void {
    this.options.onStats?.(this.stats());
  }
}
