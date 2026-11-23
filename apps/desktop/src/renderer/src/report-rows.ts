import { REPORT_CONTEXTS, type ReportContext, type ReportDocument } from "@ouve/core";
import type { ExportFormat } from "@ouve/reports";
import type { SessionController, SessionSnapshot } from "./session-controller";

/** Linha da biblioteca de relatórios (sessão atual + relatórios desta execução). */
export interface ReportRow {
  /** null = relatório da sessão atual (editável). */
  id: string | null;
  title: string;
  createdAt: number;
  durationMs: number;
  participants: number;
  context: ReportContext;
  origin: "live" | "import";
  sourceLabel: string;
  exported: ExportFormat[];
}

function duration(report: ReportDocument): number {
  return report.durationMs ?? report.transcript.reduce((max, s) => Math.max(max, s.endMs), 0);
}

export function reportRows(controller: SessionController, s: SessionSnapshot): ReportRow[] {
  const rows: ReportRow[] = [];
  const current = controller.currentReport();
  if (current) {
    rows.push({
      id: null,
      title: s.title || current.title || "Sem título",
      createdAt: current.createdAt,
      durationMs: controller.sessionDurationMs() || duration(current),
      participants: current.speakers.length,
      context: s.context,
      origin: s.mode === "live" ? "live" : "import",
      sourceLabel: s.sourceLabel,
      exported: s.exported
    });
  }
  for (const e of controller.library()) {
    rows.push({
      id: e.id,
      title: e.report.title || "Sem título",
      createdAt: e.report.createdAt,
      durationMs: duration(e.report),
      participants: e.report.speakers.length,
      context: e.report.context ?? "general",
      origin: e.origin,
      sourceLabel: e.sourceLabel,
      exported: e.exported
    });
  }
  return rows;
}

export function contextLabel(context: ReportContext): string {
  return REPORT_CONTEXTS.find((c) => c.value === context)?.label ?? "Geral";
}

/** “14:05” hoje, “ontem, 09:12” ou “21/11, 16:40”. */
export function formatWhen(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date(now);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(today) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return `hoje, ${time}`;
  if (diffDays === 1) return `ontem, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

/** “1 h 05 min”, “12 min”, “40 s”. */
export function formatLength(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
