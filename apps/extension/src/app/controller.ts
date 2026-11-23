import { analyzeTranscript } from "@ouve/analysis";
import {
  AudioCaptureSession,
  acquireDisplayAudio,
  acquireMicrophone,
  acquireTabAudio,
  type AudioContextLike,
  type MediaDevicesLike,
  type MediaStreamLike,
  type MediaStreamTrackLike
} from "@ouve/capture";
import { TranscriptStore, type ReportDocument, type SessionStatus } from "@ouve/core";
import { createProviderBundle, credentialRefFor, planImport, type ProviderBundle } from "@ouve/providers";
import { buildReport, exportDocx, exportFileName, exportPdf, reportToMarkdown } from "@ouve/reports";
import { createId, sleep, toOuveError } from "@ouve/shared";
import { TranscriptionPipeline, type PipelineStats } from "@ouve/transcription";
import { decodeFile } from "@ouve/capture";
import type { ExtensionStorage, ExtSettings } from "./storage";

export interface ExtSnapshot {
  version: number;
  status: SessionStatus;
  mode: "none" | "live" | "import";
  sourceLabel: string;
  level: number;
  activity: "unknown" | "audio" | "no-audio";
  capturedMs: number;
  stats: PipelineStats;
  messages: Array<{ id: string; kind: "info" | "warning" | "error"; text: string }>;
  analysisStatus: "idle" | "running" | "done" | "error";
  report?: ReportDocument;
}

const EMPTY: ExtSnapshot = {
  version: 0,
  status: "idle",
  mode: "none",
  sourceLabel: "",
  level: 0,
  activity: "unknown",
  capturedMs: 0,
  stats: { queued: 0, running: 0, done: 0, skipped: 0, failed: 0, transcribedUntilMs: 0 },
  messages: [],
  analysisStatus: "idle"
};

export type LiveSource = { kind: "tab"; streamId: string; label: string } | { kind: "display" } | { kind: "microphone" };

/** Sessão temporária da extensão: mesma lógica do desktop, com provedores chamados diretamente. */
export class ExtensionController {
  readonly store = new TranscriptStore();
  private snap: ExtSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private capture: AudioCaptureSession | undefined;
  private pipeline: TranscriptionPipeline | undefined;
  private analysisAbort: AbortController | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private settings: ExtSettings | undefined;

  constructor(private readonly storage: ExtensionStorage) {
    this.store.subscribe(() => this.set({}));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;

  private set(patch: Partial<ExtSnapshot>): void {
    this.snap = { ...this.snap, ...patch, version: this.snap.version + 1 };
    this.listeners.forEach((l) => l());
  }

  message(kind: "info" | "warning" | "error", text: string): void {
    this.set({ messages: [...this.snap.messages.slice(-6), { id: createId("m"), kind, text }] });
  }

  dismiss(id: string): void {
    this.set({ messages: this.snap.messages.filter((m) => m.id !== id) });
  }

  private async bundle(id: string | undefined, purpose: string): Promise<ProviderBundle> {
    if (!id) throw new Error(`Escolha um provedor de ${purpose}.`);
    const config = (await this.storage.providers()).find((p) => p.id === id);
    if (!config) throw new Error("Provedor não encontrado.");
    const key = await this.storage.secrets().get(credentialRefFor(id));
    return createProviderBundle(config, key ? { apiKey: key } : undefined, (input, init) => fetch(input, init));
  }

  private async newPipeline(concurrency = 2): Promise<TranscriptionPipeline> {
    this.settings = await this.storage.settings();
    const bundle = await this.bundle(this.settings.transcriptionProviderId, "transcrição");
    if (!bundle.transcription) throw new Error("O provedor escolhido não oferece transcrição.");
    return new TranscriptionPipeline({
      provider: bundle.transcription,
      store: this.store,
      language: this.settings.language,
      concurrency,
      onStats: (stats) => this.set({ stats }),
      onJobError: (i, e) => this.message("error", `Bloco ${i + 1}: ${e.message}`)
    });
  }

  async startLive(source: LiveSource, includeMic: boolean): Promise<void> {
    await this.discard();
    this.pipeline = await this.newPipeline();
    const devices = navigator.mediaDevices as unknown as MediaDevicesLike;
    const makeStream = (t: MediaStreamTrackLike[]) => new MediaStream(t as unknown as MediaStreamTrack[]) as unknown as MediaStreamLike;
    let stream: MediaStreamLike | undefined;
    let mic: MediaStreamLike | undefined;
    let label = "Microfone";
    try {
      if (source.kind === "tab") {
        stream = await acquireTabAudio(devices, source.streamId);
        label = source.label;
      } else if (source.kind === "display") {
        stream = await acquireDisplayAudio(devices, makeStream);
        label = "Fonte compartilhada";
      }
      if (includeMic || source.kind === "microphone") mic = await acquireMicrophone(devices);
    } catch (error) {
      [stream, mic].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
      throw toOuveError(error);
    }
    this.set({ ...EMPTY, mode: "live", status: "capturing", sourceLabel: label });
    this.capture = new AudioCaptureSession({
      createContext: () => new AudioContext() as unknown as AudioContextLike,
      ...(stream ? { source: stream } : {}),
      ...(mic ? { microphone: mic } : {}),
      // tabCapture silencia a aba; o áudio é devolvido ao usuário localmente.
      playbackSource: source.kind === "tab",
      chunkMs: (this.settings?.liveChunkSeconds ?? 20) * 1000,
      onChunk: (c) =>
        this.pipeline?.enqueue({
          index: c.index,
          offsetMs: c.offsetMs,
          durationMs: c.durationMs,
          mimeType: "audio/wav",
          data: c.wav,
          silent: c.silent
        }),
      onLevel: (level) => {
        if (Math.abs(level - this.snap.level) > 0.01) this.set({ level });
      },
      onActivity: (activity) => {
        this.set({ activity });
        if (activity === "no-audio") this.message("warning", "Nenhum áudio detectado nos últimos segundos.");
      },
      onSourceEnded: () => this.message("warning", "A fonte de áudio foi encerrada."),
      onStateChange: (state) => {
        if (state === "stopped") void this.finishLive();
      }
    });
    this.timer = setInterval(() => this.set({ capturedMs: this.capture?.capturedMs ?? this.snap.capturedMs }), 500);
  }

  pause(): void {
    this.capture?.pause();
    if (this.capture) this.set({ status: "paused", level: 0 });
  }

  resume(): void {
    this.capture?.resume();
    if (this.capture) this.set({ status: "capturing" });
  }

  async stop(): Promise<void> {
    await this.capture?.stop();
  }

  private async finishLive(): Promise<void> {
    if (!this.capture) return;
    clearInterval(this.timer);
    this.capture = undefined;
    this.set({ status: "processing", level: 0 });
    await this.pipeline?.whenIdle();
    this.set({ status: "completed" });
  }

  async importFile(file: File): Promise<void> {
    await this.discard();
    // Importação rápida (D-068): no navegador os pedaços vão em WAV, até 5 min para caber no limite por pedido.
    const settings = await this.storage.settings();
    const config = (await this.storage.providers()).find((p) => p.id === settings.transcriptionProviderId);
    const plan = planImport(config);
    const chunkSeconds = plan.segmentSeconds > 120 ? 300 : 120;
    this.pipeline = await this.newPipeline(plan.concurrency);
    this.set({ ...EMPTY, mode: "import", status: "processing", sourceLabel: file.name });
    try {
      const decoded = await decodeFile(file, chunkSeconds);
      for (let i = 0; i < decoded.count; i++) {
        while (this.pipeline.stats().queued + this.pipeline.stats().running >= plan.concurrency + 1) await sleep(200);
        const c = decoded.chunk(i);
        this.pipeline.enqueue({ index: c.index, offsetMs: c.offsetMs, durationMs: c.durationMs, mimeType: "audio/wav", data: c.wav });
      }
      await this.pipeline.whenIdle();
      this.set({ status: "completed" });
    } catch (error) {
      this.message("error", toOuveError(error).message);
      this.set({ status: "failed" });
    }
  }

  retryFailed(): number {
    return this.pipeline?.retryFailed() ?? 0;
  }

  async analyze(): Promise<void> {
    const settings = this.settings ?? (await this.storage.settings());
    const bundle = await this.bundle(settings.analysisProviderId, "análise");
    if (!bundle.completion) throw new Error("O provedor escolhido não oferece análise.");
    this.analysisAbort = new AbortController();
    this.set({ analysisStatus: "running" });
    try {
      const analysis = await analyzeTranscript({
        provider: bundle.completion,
        segments: this.store.segments(),
        speakerLabel: (id) => this.store.speakerLabel(id),
        title: this.snap.sourceLabel,
        language: settings.language,
        signal: this.analysisAbort.signal
      });
      this.set({
        analysisStatus: "done",
        report: buildReport({
          sessionId: "ext",
          title: this.snap.sourceLabel || "Relatório",
          transcript: this.store.segments(),
          speakers: this.store.speakerList(),
          analysis
        })
      });
    } catch (error) {
      this.set({ analysisStatus: "error" });
      throw error;
    }
  }

  updateReport(update: (r: ReportDocument) => ReportDocument): void {
    if (this.snap.report) this.set({ report: update(this.snap.report) });
  }

  /** Gera o arquivo localmente e oferece o download; nada é enviado. */
  async export(format: "pdf" | "docx" | "md"): Promise<void> {
    const base = this.snap.report;
    if (!base) return;
    const report = { ...base, transcript: this.store.segments(), speakers: this.store.speakerList() };
    const bytes =
      format === "pdf"
        ? await exportPdf(report)
        : format === "docx"
          ? await exportDocx(report)
          : new TextEncoder().encode(reportToMarkdown(report));
    const mime = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      md: "text/markdown"
    }[format];
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(report.title, format);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async discard(): Promise<void> {
    clearInterval(this.timer);
    this.analysisAbort?.abort();
    const capture = this.capture;
    this.capture = undefined;
    await capture?.stop();
    this.pipeline?.discard();
    this.pipeline = undefined;
    this.store.clear();
    this.snap = { ...EMPTY, version: this.snap.version + 1 };
    this.listeners.forEach((l) => l());
  }
}
