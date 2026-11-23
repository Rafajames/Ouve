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
  SpeakerMarks,
  StageTimer,
  TranscriptStore,
  emptyAnalysis,
  type LiveHint,
  type MarkerKind,
  type MeetingAnalysis,
  type ReportContext,
  type ReportDocument,
  type SessionStatus,
  type SpeakerTurn
} from "@ouve/core";
import { PROFILE_SPECS, planImport, type ProfileSpec } from "@ouve/providers";
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
import type { AppSettings, DiarizationSource, ImportedMedia } from "../../shared/ipc";
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
  /** Formatos já exportados do relatório atual. */
  exported: ExportFormat[];
  /** Tecla (1–9) do falante marcado agora na captura ao vivo. */
  speakerKey?: number | undefined;
  /** Separação de vozes local em andamento (0–100). */
  diarizePercent?: number | undefined;
}

/**
 * Relatório de uma sessão já descartada, mantido só na memória até fechar o app
 * (D-083). Áudio nunca é mantido; nada é gravado em disco.
 */
export interface LibraryEntry {
  id: string;
  report: ReportDocument;
  origin: "live" | "import";
  sourceLabel: string;
  exported: ExportFormat[];
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
    context: "general",
    exported: []
  };
}

export interface LiveStartOptions {
  title: string;
  /** Fonte selecionada (id do desktopCapturer); ausente = só microfone. */
  sourceId?: string;
  sourceLabel: string;
  includeMicrophone: boolean;
  microphoneDeviceId?: string;
  /** Tipo de sessão escolhido antes de iniciar (padrão: configurações). */
  context?: ReportContext;
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
  private archive: LibraryEntry[] = [];
  /** Marcação manual de quem está falando (teclas 1–9). */
  readonly speakerMarks = new SpeakerMarks();
  /** Grava o áudio ao vivo em temporário para separar as vozes ao encerrar. */
  private recordLive = false;
  private autoTurns: SpeakerTurn[] = [];

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
    this.speakerMarks.clear();
    this.recordLive = false;
    this.autoTurns = [];
    void bridge().diarization?.cancel();
    void bridge().diarization?.resetLive();
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

  /** Relatórios de sessões descartadas ficam na lista desta execução? */
  get keepsReports(): boolean {
    return this.settings?.keepReportsInSession !== false;
  }

  /** Mantém as preferências atuais (ex.: guardar relatórios) sincronizadas com a interface. */
  syncSettings(settings: AppSettings): void {
    this.settings = settings;
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

  /** Transcrição local gerenciada: liga o servidor do whisper.cpp antes de começar (D-082). */
  private async ensureLocalTranscription(providerId: string): Promise<void> {
    const managed = bridge().local?.managed;
    if (providerId !== "local-whisper-cpp" || !managed) return;
    await this.stages.measure("prepare", () => unwrap(managed.ensureWhisper()), "Ligando a transcrição local");
  }

  // ---------- Separação de vozes e perfil (D-087/D-088) ----------

  /** Perfil de desempenho em uso e se a separação de vozes local está pronta. */
  private async localCapabilities(settings: AppSettings): Promise<{ spec: ProfileSpec; diarization: boolean }> {
    const managed = bridge().local?.managed;
    if (!managed || !bridge().diarization) return { spec: PROFILE_SPECS.equilibrado, diarization: false };
    try {
      const [machine, state] = await Promise.all([unwrap(managed.machine()), unwrap(managed.state())]);
      return {
        spec: PROFILE_SPECS[machine.active],
        diarization: settings.autoDiarization && state.diarizationBundled && state.installedSpeakerModels.length > 0
      };
    } catch {
      return { spec: PROFILE_SPECS.equilibrado, diarization: false };
    }
  }

  /** Nome de cada tecla de falante (configurável); sem nome, "Pessoa N". */
  speakerKeyName(key: number): string {
    return this.settings?.speakerKeys[key - 1]?.trim() || `Pessoa ${key}`;
  }

  private keyNames(): Record<string, string> {
    const names: Record<string, string> = {};
    for (let k = 1; k <= 9; k++) names[`tecla:${k}`] = this.speakerKeyName(k);
    return names;
  }

  /** Dá nome a uma tecla (vale para as próximas sessões) e renomeia o falante dela, se já existir. */
  async renameSpeakerKey(key: number, name: string): Promise<void> {
    const settings = this.settings ?? (await this.loadSettings());
    const keys = Array.from({ length: 9 }, (_, i) => settings.speakerKeys[i] ?? "");
    keys[key - 1] = name.replace(/\s+/g, " ").trim().slice(0, 40);
    this.settings = await unwrap(bridge().settings.save({ ...settings, speakerKeys: keys }));
    const id = this.store.speakerIdForLabel(`tecla:${key}`);
    if (id && keys[key - 1]) this.renameSpeaker(id, keys[key - 1] as string);
    this.bump();
  }

  /** Marca quem está falando agora (1–9) ou ninguém (0), no tempo decorrido da captura. */
  markSpeaker(key: number): void {
    if (this.snap.mode !== "live" || !this.capture) return;
    this.speakerMarks.mark(key, this.capture.capturedMs);
    this.set({ speakerKey: this.speakerMarks.current() });
    this.applyKeyTurns();
  }

  /** Reaplica falantes (automático e teclas) aos trechos que chegaram depois. */
  private reapplySpeakers(): void {
    if (this.autoTurns.length) this.store.applySpeakerTurns(this.autoTurns, "auto");
    this.applyKeyTurns();
  }

  private applyKeyTurns(): void {
    if (this.speakerMarks.isEmpty()) return;
    this.store.applySpeakerTurns(this.speakerMarks.toTurns(this.sessionDurationMs()), "keys", this.keyNames());
  }

  /** Separa as vozes no computador e aplica aos trechos. Falha não interrompe a sessão. */
  private async runDiarization(source: DiarizationSource): Promise<void> {
    const api = bridge().diarization;
    const managed = bridge().local?.managed;
    if (!api) return;
    const off = managed?.onProgress((task, pct) => {
      if (task === "separando-vozes") this.set({ diarizePercent: pct });
    });
    this.set({ diarizePercent: 0 });
    try {
      const turns = await this.stages.measure(
        "diarize",
        () => unwrap(api.run(source, this.settings?.speakerCount ?? 0)),
        "No seu computador; o áudio não sai daqui"
      );
      this.autoTurns = turns;
      this.store.applySpeakerTurns(turns, "auto");
      const people = new Set(turns.map((t) => t.label)).size;
      if (people > 0)
        this.message("info", `Vozes separadas: ${people} pessoa(s). Renomeie em Participantes (ex.: “Falante 1” → “Testemunha”).`);
      else this.message("warning", "A separação de vozes não encontrou falas. Atribua os falantes manualmente.");
    } catch (error) {
      const e = toOuveError(error);
      if (e.code !== "cancelled") this.message("warning", `Não foi possível separar as vozes: ${e.message}`);
    } finally {
      off?.();
      this.set({ diarizePercent: undefined });
    }
  }

  // ---------- Captura ao vivo ----------

  async startLive(options: LiveStartOptions): Promise<void> {
    if (this.capture) throw new Error("Já existe uma captura em andamento.");
    const settings = await this.loadSettings();
    const providerId = this.requireTranscriptionProvider(settings);
    this.resetLocal();
    await this.ensureLocalTranscription(providerId);
    this.recordLive = (await this.localCapabilities(settings)).diarization;
    this.set({
      ...newSnapshot(),
      mode: "live",
      status: "preparing",
      title: options.title || "Sessão ao vivo",
      sourceLabel: options.sourceLabel,
      microphone: options.includeMicrophone,
      context: options.context ?? settings.defaultContext
    });

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
      onChunk: (chunk) => {
        if (this.recordLive)
          void bridge()
            .diarization?.appendLive(chunk.index, chunk.wav)
            .then((r) => {
              if (!r.ok) this.recordLive = false;
            });
        this.pipeline?.enqueue({
          index: chunk.index,
          offsetMs: chunk.offsetMs,
          durationMs: chunk.durationMs,
          mimeType: "audio/wav",
          data: chunk.wav,
          silent: chunk.silent
        });
      },
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
      this.applyKeyTurns();
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
    this.applyKeyTurns();
    if (this.recordLive) await this.runDiarization({ kind: "live" });
    this.set({ status: "completed", speakerKey: undefined });
  }

  // ---------- Importação ----------

  async startImport(context?: ReportContext): Promise<boolean> {
    const settings = await this.loadSettings();
    const providerId = this.requireTranscriptionProvider(settings);
    const media = await unwrap(bridge().media.open());
    if (!media) return false;
    this.resetLocal();
    await this.ensureLocalTranscription(providerId);
    this.set({
      ...newSnapshot(),
      mode: "import",
      status: "processing",
      title: media.name.replace(/\.[^.]+$/, ""),
      sourceLabel: media.name,
      context: context ?? settings.defaultContext,
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
      const local = await this.localCapabilities(settings);
      const plan = settings.importAuto
        ? planImport(providers.find((p) => p.config.id === providerId)?.config)
        : { segmentSeconds: settings.importSegmentSeconds, format: "wav" as const, concurrency: 2, reason: "" };
      // IA local: o perfil do computador decide quantos pedaços ao mesmo tempo (D-088).
      if (providerId === "local-whisper-cpp") plan.concurrency = local.spec.localConcurrency;
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
      // PCs fortes: separa as vozes junto com a transcrição; no perfil Leve, só depois (D-088).
      const diarize = () => this.runDiarization({ kind: "import", token: media.token });
      const parallelDiarization = local.diarization && !local.spec.sequentialDiarization ? diarize() : undefined;
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
      if (parallelDiarization) {
        await parallelDiarization;
        this.reapplySpeakers();
      } else if (local.diarization) await diarize();
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
    void bridge().diarization?.cancel();
    this.pipeline?.cancel();
    this.set({ status: "cancelled" });
  }

  retryFailed(): number {
    const count = this.pipeline?.retryFailed() ?? 0;
    if (count > 0 && this.snap.mode === "live" && this.snap.status === "completed") {
      this.set({ status: "processing" });
      void this.pipeline?.whenIdle().then(() => {
        this.reapplySpeakers();
        this.set({ status: "completed" });
      });
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
    const settings = await this.loadSettings();
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

  async exportReport(format: ExportFormat, sections?: SectionKey[], entryId?: string): Promise<string | null> {
    if (!this.settings) await this.loadSettings();
    const entry = entryId ? this.archive.find((e) => e.id === entryId) : undefined;
    if (entryId && !entry) throw new Error("Este relatório não está mais disponível.");
    const report = entry ? entry.report : this.currentReport();
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
    const path = await unwrap(bridge().files.save(exportFileName(report.title, format), bytes));
    if (path) {
      if (entry) {
        if (!entry.exported.includes(format)) entry.exported = [...entry.exported, format];
        this.archive = [...this.archive];
        this.bump();
      } else if (!this.snap.exported.includes(format)) this.set({ exported: [...this.snap.exported, format] });
    }
    return path;
  }

  // ---------- Relatórios desta execução (memória) ----------

  /** Relatórios de sessões descartadas, mais recentes primeiro. */
  library(): LibraryEntry[] {
    return this.archive;
  }

  libraryEntry(id: string): LibraryEntry | undefined {
    return this.archive.find((e) => e.id === id);
  }

  updateLibraryEntry(id: string, update: (report: ReportDocument) => ReportDocument): void {
    this.archive = this.archive.map((e) => (e.id === id ? { ...e, report: update(e.report) } : e));
    this.bump();
  }

  removeFromLibrary(id: string): void {
    this.archive = this.archive.filter((e) => e.id !== id);
    this.bump();
  }

  clearLibrary(): void {
    this.archive = [];
    this.bump();
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

  /** Descarta a sessão. Por padrão o relatório (se houver) vai para a lista desta execução (D-083). */
  async discard(options: { keepReport?: boolean } = {}): Promise<void> {
    const report = this.currentReport();
    const keep = options.keepReport ?? this.settings?.keepReportsInSession !== false;
    if (report && this.snap.mode !== "none" && keep) {
      this.archive = [
        {
          id: createId("rel"),
          report: { ...report, title: this.snap.title || report.title, durationMs: report.durationMs ?? this.sessionDurationMs() },
          origin: (this.snap.mode === "live" ? "live" : "import") as LibraryEntry["origin"],
          sourceLabel: this.snap.sourceLabel,
          exported: this.snap.exported
        },
        ...this.archive
      ].slice(0, 500);
    }
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
