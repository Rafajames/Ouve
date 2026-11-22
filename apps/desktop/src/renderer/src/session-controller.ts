import { analyzeTranscript } from "@ouve/analysis";
import {
  AudioCaptureSession,
  acquireDisplayAudio,
  acquireMicrophone,
  type AudioContextLike,
  type MediaDevicesLike,
  type MediaStreamLike,
  type MediaStreamTrackLike
} from "@ouve/capture";
import {
  LiveHintEngine,
  MarkerStore,
  StageTimer,
  TranscriptStore,
  emptyAnalysis,
  type LiveHint,
  type MarkerKind,
  type MeetingAnalysis,
  type ReportContext,
  type ReportDocument,
  type SessionStatus
} from "@ouve/core";
import { planImport } from "@ouve/providers";
import {
  buildReport,
  exportDocx,
  exportFileName,
  exportPdf,
  reportToCsv,
  reportToMarkdown,
  reportToText,
  type ExportFormat,
  type ExportOptions,
  type SectionKey
} from "@ouve/reports";
import { createId, formatTimestamp, sleep, toOuveError } from "@ouve/shared";
import { TranscriptionPipeline, type PipelineStats } from "@ouve/transcription";
import type { AppSettings, ImportedMedia } from "../../shared/ipc";
import { IpcCompletionProvider, IpcTranscriptionProvider, bridge, unwrap } from "./bridge";

export type SessionMode = "none" | "live" | "import";
export type AnalysisStatus = "idle" | "running" | "done" | "error";

export interface SessionSnapshot {
  version: number;
  id: string;
  mode: SessionMode;
  status: SessionStatus;
  title: string;
  sourceLabel: string;
  microphone: boolean;
  microphoneMuted: boolean;
  level: number;
  activity: "unknown" | "audio" | "no-audio";
  capturedMs: number;
  stats: PipelineStats;
  messages: Array<{ id: string; kind: "info" | "warning" | "error"; text: string }>;
  importInfo?: ImportedMedia & { phase: "extracting" | "transcribing" | "done"; processedMs: number; segments: number };
  analysisStatus: AnalysisStatus;
  /** Tempo total de extração + transcrição da importação (ms). */
  processingMs?: number;
  /** Descrição do modo rápido escolhido para a importação. */
  importPlanLabel?: string;
  analysisProgress?: { done: number; total: number };
  report?: ReportDocument;
  /** Tipo de sessão (adapta análise e relatório). */
  context: ReportContext;
  /** Aviso discreto atual (regras locais). */
  hint?: LiveHint | undefined;
}

const EMPTY_STATS: PipelineStats = { queued: 0, running: 0, done: 0, skipped: 0, failed: 0, transcribedUntilMs: 0 };

function newSnapshot(): SessionSnapshot {
  return {
    version: 0,
    id: createId("sessao"),
    mode: "none",
    status: "idle",
    title: "",
    sourceLabel: "",
    microphone: false,
    microphoneMuted: false,
    level: 0,
    activity: "unknown",
    capturedMs: 0,
    stats: EMPTY_STATS,
    messages: [],
    analysisStatus: "idle",
    context: "general"
  };
}

export interface LiveStartOptions {
  title: string;
  /** Fonte selecionada (id do desktopCapturer); ausente = só microfone. */
  sourceId?: string;
  sourceLabel: string;
  includeMicrophone: boolean;
  microphoneDeviceId?: string;
}

/**
 * Orquestra uma sessão única e temporária (sem histórico): captura → transcrição
 * → análise → relatório. Descartar libera áudio, transcrição e temporários.
 */
export class SessionController {
  readonly store = new TranscriptStore();
  readonly markers = new MarkerStore();
  readonly stages = new StageTimer();
  private readonly hints = new LiveHintEngine();
  private snap: SessionSnapshot = newSnapshot();
  private listeners = new Set<() => void>();
  private capture: AudioCaptureSession | undefined;
  private pipeline: TranscriptionPipeline | undefined;
  private analysisAbort?: AbortController;
  private importAbort?: AbortController;
  private settings?: AppSettings;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.store.subscribe(() => this.bump());
    this.markers.subscribe(() => this.bump());
    this.stages.subscribe(() => this.bump());
  }

  /** Recomeça os auxiliares locais de uma nova sessão. */
  private resetLocal(): void {
    this.store.clear();
    this.markers.clear();
    this.stages.reset();
    this.hints.reset();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionSnapshot => this.snap;

  private set(patch: Partial<SessionSnapshot>): void {
    this.snap = { ...this.snap, ...patch, version: this.snap.version + 1 };
    for (const l of this.listeners) l();
  }

  private bump(): void {
    this.set({});
  }

  private message(kind: "info" | "warning" | "error", text: string): void {
    this.set({ messages: [...this.snap.messages.slice(-8), { id: createId("msg"), kind, text }] });
  }

  dismissMessage(id: string): void {
    this.set({ messages: this.snap.messages.filter((m) => m.id !== id) });
  }

  get hasContent(): boolean {
    return this.store.segments().length > 0 || this.snap.mode !== "none";
  }

  private async loadSettings(): Promise<AppSettings> {
    this.settings = await unwrap(bridge().settings.get());
    return this.settings;
  }

  private createPipeline(providerId: string, language: string, concurrency = 2): TranscriptionPipeline {
    return new TranscriptionPipeline({
      provider: new IpcTranscriptionProvider(providerId),
      store: this.store,
      language,
      concurrency,
      retries: 2,
      onStats: (stats) => this.set({ stats }),
      onJobError: (index, error) => this.message("error", `Bloco ${index + 1}: ${error.message}`)
    });
  }

  private requireTranscriptionProvider(settings: AppSettings): string {
    if (!settings.transcriptionProviderId) throw new Error("Escolha um provedor de transcrição em Provedores de IA antes de iniciar.");
    return settings.transcriptionProviderId;
  }

  // ---------- Captura ao vivo ----------

  async startLive(options: LiveStartOptions): Promise<void> {
    if (this.capture) throw new Error("Já existe uma captura em andamento.");
    const settings = await this.loadSettings();
    const providerId = this.requireTranscriptionProvider(settings);
    this.set({
      ...newSnapshot(),
      mode: "live",
      status: "preparing",
      title: options.title || "Sessão ao vivo",
      sourceLabel: options.sourceLabel,
      microphone: options.includeMicrophone,
      context: settings.defaultContext
    });
    this.resetLocal();

    const devices = navigator.mediaDevices as unknown as MediaDevicesLike;
    const makeStream = (tracks: MediaStreamTrackLike[]) =>
      new MediaStream(tracks as unknown as MediaStreamTrack[]) as unknown as MediaStreamLike;
    let source: MediaStreamLike | undefined;
    let mic: MediaStreamLike | undefined;
    try {
      if (options.sourceId) {
        await unwrap(bridge().capture.selectSource(options.sourceId));
        source = await acquireDisplayAudio(devices, makeStream);
      }
      if (options.includeMicrophone) mic = await acquireMicrophone(devices, options.microphoneDeviceId);
    } catch (error) {
      for (const s of [source, mic]) s?.getTracks().forEach((t) => t.stop());
      this.set({ status: "failed" });
      throw toOuveError(error);
    }

    this.pipeline = this.createPipeline(providerId, settings.language);
    this.capture = new AudioCaptureSession({
      createContext: () => new AudioContext() as unknown as AudioContextLike,
      ...(source ? { source } : {}),
      ...(mic ? { microphone: mic } : {}),
      chunkMs: settings.liveChunkSeconds * 1000,
      onChunk: (chunk) =>
        this.pipeline?.enqueue({
          index: chunk.index,
          offsetMs: chunk.offsetMs,
          durationMs: chunk.durationMs,
          mimeType: "audio/wav",
          data: chunk.wav,
          silent: chunk.silent
        }),
      onLevel: (level) => {
        if (Math.abs(level - this.snap.level) > 0.01) this.set({ level });
      },
      onActivity: (activity) => {
        this.set({ activity });
        if (activity === "no-audio")
          this.message("warning", "Nenhum áudio detectado nos últimos segundos. Verifique se a fonte está reproduzindo som.");
      },
      onSourceEnded: (which) =>
        this.message("warning", which === "source" ? "A fonte compartilhada foi encerrada." : "O microfone foi desconectado."),
      onStateChange: (state) => {
        if (state === "stopped") void this.finishLive();
      }
    });
    this.set({ status: "capturing" });
    void bridge().capture.setActive(true);
    this.timer = setInterval(() => {
      const capturedMs = this.capture?.capturedMs ?? this.snap.capturedMs;
      const patch: Partial<SessionSnapshot> = { capturedMs };
      if (this.settings?.liveHints && this.snap.status === "capturing" && !this.snap.hint) {
        const hint = this.hints.evaluate(this.store.segments(), capturedMs);
        if (hint) patch.hint = hint;
      }
      this.set(patch);
    }, 500);
  }

  pause(): void {
    if (this.snap.status !== "capturing") return;
    this.capture?.pause();
    this.set({ status: "paused", level: 0 });
  }

  resume(): void {
    if (this.snap.status !== "paused") return;
    this.capture?.resume();
    this.set({ status: "capturing" });
  }

  setMicrophoneMuted(muted: boolean): void {
    this.capture?.setMicrophoneEnabled(!muted);
    this.set({ microphoneMuted: muted });
  }

  async stopLive(): Promise<void> {
    await this.capture?.stop();
  }

  private async finishLive(): Promise<void> {
    if (!this.capture) return;
    clearInterval(this.timer);
    const captured = this.capture.capturedMs;
    this.capture = undefined;
    void bridge().capture.setActive(false);
    this.set({ status: "processing", level: 0, capturedMs: captured });
    this.set({ hint: undefined });
    await this.stages.measure("transcribe", async () => this.pipeline?.whenIdle(), "Blocos restantes após encerrar");
    this.set({ status: "completed" });
  }

  // ---------- Importação ----------

  async startImport(): Promise<boolean> {
    const settings = await this.loadSettings();
    const providerId = this.requireTranscriptionProvider(settings);
    const media = await unwrap(bridge().media.open());
    if (!media) return false;
    this.resetLocal();
    this.set({
      ...newSnapshot(),
      mode: "import",
      status: "processing",
      title: media.name.replace(/\.[^.]+$/, ""),
      sourceLabel: media.name,
      context: settings.defaultContext,
      importInfo: { ...media, phase: "extracting", processedMs: 0, segments: 0 }
    });
    this.importAbort = new AbortController();
    const signal = this.importAbort.signal;
    const off = bridge().media.onProgress((token, ms) => {
      if (token === media.token && this.snap.importInfo) this.set({ importInfo: { ...this.snap.importInfo, processedMs: ms } });
    });
    try {
      const started = Date.now();
      // Modo rápido: pedaços, formato e paralelismo escolhidos pela IA configurada (D-068).
      const providers = await unwrap(bridge().providers.list());
      const plan = settings.importAuto
        ? planImport(providers.find((p) => p.config.id === providerId)?.config)
        : { segmentSeconds: settings.importSegmentSeconds, format: "wav" as const, concurrency: 2, reason: "" };
      this.set({
        importPlanLabel: `Pedaços de ${Math.round(plan.segmentSeconds / 60)} min em ${plan.format.toUpperCase()}, ${plan.concurrency} ao mesmo tempo`
      });
      const segments = await this.stages.measure(
        "convert",
        () => unwrap(bridge().media.extract(media.token, plan.segmentSeconds, plan.format)),
        `${plan.format.toUpperCase()} em pedaços de ${Math.round(plan.segmentSeconds / 60)} min`
      );
      off();
      this.stages.start("transcribe", `${segments.length} pedaço(s), ${plan.concurrency} ao mesmo tempo (inclui envio)`);
      if (!this.snap.importInfo) return true;
      this.set({ importInfo: { ...this.snap.importInfo, phase: "transcribing", segments: segments.length } });
      this.pipeline = this.createPipeline(providerId, settings.language, plan.concurrency);
      for (const segment of segments) {
        // Alimenta a fila aos poucos para não manter o arquivo inteiro na memória.
        while ((this.pipeline.stats().queued ?? 0) + (this.pipeline.stats().running ?? 0) >= plan.concurrency + 1) await sleep(200, signal);
        const data = new Uint8Array(await unwrap(bridge().media.readSegment(media.token, segment.index)));
        this.pipeline.enqueue({
          index: segment.index,
          offsetMs: segment.offsetMs,
          durationMs: segment.durationMs,
          mimeType: segment.mimeType,
          data
        });
      }
      await this.pipeline.whenIdle();
      this.stages.end("transcribe", this.pipeline.stats().failed > 0 ? "failed" : "done");
      if (this.snap.importInfo)
        this.set({ importInfo: { ...this.snap.importInfo, phase: "done" }, status: "completed", processingMs: Date.now() - started });
      if (this.pipeline.stats().failed > 0)
        this.message("warning", "Alguns trechos falharam. Use “Tentar novamente” para reenviar apenas esses trechos.");
    } catch (error) {
      off();
      const e = toOuveError(error);
      for (const st of this.stages.list())
        if (st.status === "running") this.stages.end(st.stage, e.code === "cancelled" ? "canceled" : "failed");
      if (e.code !== "cancelled") {
        this.message("error", e.message);
        this.set({ status: "failed" });
      }
    } finally {
      await bridge().media.release(media.token);
    }
    return true;
  }

  cancelImport(): void {
    this.importAbort?.abort();
    this.pipeline?.cancel();
    this.set({ status: "cancelled" });
  }

  retryFailed(): number {
    const count = this.pipeline?.retryFailed() ?? 0;
    if (count > 0 && this.snap.mode === "live" && this.snap.status === "completed") {
      this.set({ status: "processing" });
      void this.pipeline?.whenIdle().then(() => this.set({ status: "completed" }));
    }
    return count;
  }

  // ---------- Participantes e transcrição ----------

  renameSpeaker(id: string, label: string): void {
    this.store.renameSpeaker(id, label);
    this.syncReportSpeakers();
  }

  editSegment(id: string, text: string): void {
    this.store.editSegmentText(id, text);
  }

  assignSpeaker(segmentId: string, speakerId: string | "new"): void {
    this.store.assignSpeaker(segmentId, speakerId);
  }

  private syncReportSpeakers(): void {
    if (this.snap.report) this.set({ report: { ...this.snap.report, speakers: this.store.speakerList() } });
  }

  // ---------- Análise e relatório ----------

  async analyze(): Promise<void> {
    const settings = this.settings ?? (await this.loadSettings());
    if (!settings.analysisProviderId) throw new Error("Escolha um provedor de análise em Provedores de IA.");
    const segments = this.store.segments();
    if (segments.length === 0) throw new Error("Ainda não há transcrição para analisar.");
    this.analysisAbort = new AbortController();
    this.set({ analysisStatus: "running", analysisProgress: { done: 0, total: 1 } });
    try {
      this.stages.start("analyze", "Somente o texto da transcrição é enviado; o áudio não é reenviado");
      const analysis = await analyzeTranscript({
        provider: new IpcCompletionProvider(settings.analysisProviderId),
        segments,
        speakerLabel: (id) => this.store.speakerLabel(id),
        title: this.snap.title,
        language: settings.language,
        context: this.snap.context,
        signal: this.analysisAbort.signal,
        onProgress: (done, total) => this.set({ analysisProgress: { done, total } })
      });
      this.stages.end("analyze");
      this.applyAnalysis(analysis);
      this.set({ analysisStatus: "done" });
    } catch (error) {
      const e = toOuveError(error);
      this.stages.end("analyze", e.code === "cancelled" ? "canceled" : "failed");
      this.set({ analysisStatus: e.code === "cancelled" ? "idle" : "error" });
      if (e.code !== "cancelled") throw e;
    }
  }

  cancelAnalysis(): void {
    this.analysisAbort?.abort();
  }

  private applyAnalysis(analysis: MeetingAnalysis): void {
    const providers = this.settings
      ? { transcription: this.settings.transcriptionProviderId ?? "n/d", analysis: this.settings.analysisProviderId ?? "n/d" }
      : undefined;
    const report = buildReport({
      sessionId: this.snap.id,
      title: this.snap.title,
      language: this.settings?.language ?? "pt-BR",
      transcript: this.store.segments(),
      speakers: this.store.speakerList(),
      analysis,
      context: this.snap.context,
      markers: this.markers.list(),
      durationMs: this.sessionDurationMs(),
      ...(providers ? { providers } : {})
    });
    this.set({ report });
  }

  /** Cria um relatório vazio para edição manual quando não houver análise por IA. */
  createManualReport(): void {
    this.applyAnalysis(emptyAnalysis());
  }

  updateReport(update: (report: ReportDocument) => ReportDocument): void {
    if (this.snap.report) this.set({ report: update(this.snap.report) });
  }

  setTitle(title: string): void {
    this.set({ title });
    if (this.snap.report) this.set({ report: { ...this.snap.report, title } });
  }

  /** Opções de exportação a partir das configurações (seções escolhidas na hora). */
  exportOptions(sections?: SectionKey[]): ExportOptions {
    const st = this.settings;
    return {
      includeTranscript: st?.includeTranscriptInExport ?? true,
      includeTimestamps: st?.exportTimestamps ?? true,
      includeMetrics: st?.exportMetrics ?? true,
      includeMarkers: st?.exportMarkers ?? true,
      includeNotes: st?.exportNotes ?? true,
      includeEvidence: st?.exportEvidence ?? true,
      ...(sections ? { sections } : {})
    };
  }

  /** Relatório com a transcrição, falantes e marcadores mais recentes (inclui edições). */
  currentReport(): ReportDocument | undefined {
    const base = this.snap.report;
    if (!base) return undefined;
    const markers = this.markers.list();
    return {
      ...base,
      transcript: this.store.segments(),
      speakers: this.store.speakerList(),
      context: this.snap.context,
      ...(markers.length ? { markers } : { markers: [] })
    };
  }

  async exportReport(format: ExportFormat, sections?: SectionKey[]): Promise<string | null> {
    if (!this.settings) await this.loadSettings();
    const report = this.currentReport();
    if (!report) throw new Error("Gere ou crie um relatório antes de exportar.");
    const options = this.exportOptions(sections);
    const bytes = await this.stages.measure(
      "export",
      async () => {
        switch (format) {
          case "pdf":
            return exportPdf(report, options);
          case "docx":
            return exportDocx(report, options);
          case "txt":
            return new TextEncoder().encode(reportToText(report, options));
          case "csv":
            return new TextEncoder().encode(reportToCsv(report));
          default:
            return new TextEncoder().encode(reportToMarkdown(report, options));
        }
      },
      format.toUpperCase()
    );
    return unwrap(bridge().files.save(exportFileName(report.title, format), bytes));
  }

  // ---------- Contexto, marcadores e avisos ----------

  setContext(context: ReportContext): void {
    this.set({ context });
    if (this.snap.report) this.set({ report: { ...this.snap.report, context } });
  }

  /** Tempo decorrido atual da sessão: captura ao vivo ou fim do último trecho. */
  sessionDurationMs(): number {
    if (this.snap.mode === "live") return this.capture?.capturedMs ?? this.snap.capturedMs;
    if (this.snap.importInfo?.durationMs) return this.snap.importInfo.durationMs;
    return this.store.segments().reduce((max, s) => Math.max(max, s.endMs), 0);
  }

  addMarker(kind: MarkerKind, atMs?: number, note?: string): void {
    const at = atMs ?? this.sessionDurationMs();
    this.markers.add(kind, at, note ? { note } : {});
  }

  acceptHint(): void {
    const hint = this.snap.hint;
    if (hint?.suggestedMarker) this.markers.add(hint.suggestedMarker, hint.atMs, { origin: "suggested", note: hint.text });
    this.set({ hint: undefined });
  }

  dismissHint(): void {
    this.set({ hint: undefined });
  }

  transcriptText(): string {
    return this.store.toPlainText(formatTimestamp);
  }

  // ---------- Descarte ----------

  async discard(): Promise<void> {
    clearInterval(this.timer);
    this.analysisAbort?.abort();
    this.importAbort?.abort();
    if (this.capture) {
      const capture = this.capture;
      this.capture = undefined;
      await capture.stop();
      void bridge().capture.setActive(false);
    }
    this.pipeline?.discard();
    this.pipeline = undefined;
    this.resetLocal();
    this.snap = { ...newSnapshot(), version: this.snap.version + 1 };
    for (const l of this.listeners) l();
  }
}
