import { useState } from "react";
import { Icon } from "@ouve/ui";
import {
  REPORT_CONTEXTS,
  type ActionItem,
  type AnalysisItem,
  type QuestionAnswer,
  type ReportContext,
  type ReportDocument
} from "@ouve/core";
import { sectionsFor, type ExportFormat, type SectionKey } from "@ouve/reports";
import { createId, formatTimestamp } from "@ouve/shared";
import { EmptyState, Page, SpeakersPanel, Tabs, TranscriptView } from "../components";
import { isWeb } from "../bridge";
import { formatWhen } from "../report-rows";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";
import { ContextSelect, MetricsPanel, jumpToSegment } from "../insights";
import type { AppSettings } from "../../../shared/ipc";

type AnyItem = AnalysisItem & Partial<ActionItem> & Partial<QuestionAnswer>;

function ItemEditor({
  item,
  section,
  report,
  onChange,
  onRemove,
  onMove,
  onJump
}: {
  item: AnyItem;
  section: SectionKey;
  report: ReportDocument;
  onChange: (i: AnyItem) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onJump: (segmentId: string) => void;
}) {
  const byId = new Map(report.transcript.map((s) => [s.id, s]));
  return (
    <li className={`item ${item.basis}`}>
      <div className="row">
        <input
          className="item-title"
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          aria-label="Título do item"
        />
        <select
          value={item.basis}
          onChange={(e) => onChange({ ...item, basis: e.target.value as AnyItem["basis"] })}
          aria-label="Natureza da informação"
        >
          <option value="explicit">Explícito</option>
          <option value="inferred">Inferência da IA</option>
        </select>
        <button className="small icon-only ghost" onClick={() => onMove(-1)} aria-label="Mover para cima" title="Mover para cima">
          <Icon name="chevronDown" size={14} className="flip" />
        </button>
        <button className="small icon-only ghost" onClick={() => onMove(1)} aria-label="Mover para baixo" title="Mover para baixo">
          <Icon name="chevronDown" size={14} />
        </button>
        <button className="small icon-only ghost danger" onClick={onRemove} aria-label="Remover item" title="Remover item">
          <Icon name="trash" size={14} />
        </button>
      </div>
      <textarea
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        rows={2}
        aria-label="Descrição"
        placeholder="Descrição"
      />
      {section === "questionsAndAnswers" && (
        <input
          value={item.answer ?? ""}
          onChange={(e) => onChange({ ...item, answer: e.target.value })}
          placeholder="Resposta dada (se houver)"
          aria-label="Resposta"
        />
      )}
      {section === "actionItems" && (
        <div className="row">
          <input
            value={item.assignee ?? ""}
            onChange={(e) => onChange({ ...item, assignee: e.target.value })}
            placeholder="Responsável mencionado"
            aria-label="Responsável"
          />
          <input
            value={item.dueDate ?? ""}
            onChange={(e) => onChange({ ...item, dueDate: e.target.value })}
            placeholder="Prazo mencionado"
            aria-label="Prazo"
          />
        </div>
      )}
      {item.evidence.length > 0 && (
        <ul className="evidence">
          {item.evidence.map((ev, i) => {
            const seg = byId.get(ev.segmentIds[0] ?? "");
            return (
              <li key={i}>
                {seg ? (
                  <button className="time link" title="Ver na transcrição" onClick={() => onJump(seg.id)}>
                    {formatTimestamp(seg.startMs)}
                  </button>
                ) : null}{" "}
                {ev.quote ? `“${ev.quote}”` : seg?.text}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

type View = "summary" | "participants" | SectionKey | "transcript" | "metrics" | "notes" | "export";

const INCLUDE: Array<[keyof AppSettings, string]> = [
  ["includeTranscriptInExport", "Transcrição completa"],
  ["exportTimestamps", "Horários (tempo decorrido)"],
  ["exportMetrics", "Participação e linha do tempo das falas"],
  ["exportMarkers", "Marcadores"],
  ["exportEvidence", "Trechos de evidência"],
  ["exportNotes", "Observações"]
];

/** Transcrição somente leitura de um relatório guardado nesta execução. */
function StaticTranscript({ report }: { report: ReportDocument }) {
  const label = (id?: string) => report.speakers.find((sp) => sp.id === id)?.label ?? "Não identificado";
  if (report.transcript.length === 0) return <p className="empty">Sem transcrição.</p>;
  return (
    <ol className="transcript" aria-label="Transcrição">
      {report.transcript.map((seg) => (
        <li key={seg.id} data-seg-id={seg.id} className="segment">
          <div className="segment-meta">
            <span className="time">{formatTimestamp(seg.startMs)}</span>
            <span className="speaker">{label(seg.speakerId)}</span>
          </div>
          <p className="segment-text">{seg.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** Tela de leitura e edição de um relatório (sessão atual ou desta execução). */
export function ReportScreen({ data }: { data: AppData }) {
  const { controller, navigate, notify, reportId } = useApp();
  const s = useSession();
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<View>("summary");
  const [chosen, setChosen] = useState<Set<SectionKey> | null>(null);
  const isCurrent = reportId === null;
  const entry = reportId ? controller.libraryEntry(reportId) : undefined;
  const report = isCurrent ? s.report : entry?.report;
  const context: ReportContext = isCurrent ? s.context : (report?.context ?? "general");
  const analysisProvider = data.providers.find((p) => p.config.id === data.settings?.analysisProviderId)?.config.displayName;
  const hasTranscript = controller.store.segments().length > 0;
  const sections = sectionsFor(context);
  const selected = chosen ?? new Set(sections.map((x) => x.key));
  const settings = data.settings;

  const update = (fn: (r: ReportDocument) => ReportDocument) =>
    isCurrent ? controller.updateReport(fn) : reportId && controller.updateLibraryEntry(reportId, fn);
  const setTitle = (title: string) => (isCurrent ? controller.setTitle(title) : update((r) => ({ ...r, title })));
  const setContext = (c: ReportContext) => (isCurrent ? controller.setContext(c) : update((r) => ({ ...r, context: c })));
  const updateSection = (key: SectionKey, items: AnyItem[]) => update((r) => ({ ...r, analysis: { ...r.analysis, [key]: items } }));
  const toggleSetting = (key: keyof AppSettings) => settings && void data.saveSettings({ ...settings, [key]: !settings[key] });
  const run = () => void controller.analyze().catch((e: unknown) => notify(errorMessage(e), "error"));

  const jump = (segmentId: string) => {
    if (isCurrent) {
      navigate("session");
      setTimeout(() => jumpToSegment(segmentId), 150);
    } else {
      setView("transcript");
      setTimeout(() => jumpToSegment(segmentId), 100);
    }
  };

  const exportAs = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const path = await controller.exportReport(format, chosen ? [...selected] : undefined, reportId ?? undefined);
      if (path) notify(`Relatório salvo em ${path}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setExporting(false);
    }
  };

  const back = (
    <button className="small ghost" onClick={() => navigate("reports")}>
      <Icon name="chevronLeft" size={14} /> Relatórios
    </button>
  );

  if (!isCurrent && !entry) {
    return (
      <Page title="Relatório" actions={back}>
        <EmptyState icon="library" title="Este relatório não está mais na lista" text="Ele foi excluído ou o Ouve foi reaberto." />
      </Page>
    );
  }

  if (!report) {
    return (
      <Page
        title="Relatório da sessão"
        subtitle={
          analysisProvider
            ? `A análise é feita por ${analysisProvider}, que recebe só o texto da transcrição.`
            : "Configure uma IA de análise para gerar o relatório."
        }
        actions={back}
      >
        <div className="center-stage">
          {!hasTranscript ? (
            <EmptyState
              icon="report"
              title="Ainda não há transcrição"
              text="Grave uma reunião ou importe um arquivo para gerar o relatório."
            >
              <button className="primary small" onClick={() => navigate("new")}>
                <Icon name="record" size={14} /> Nova reunião
              </button>
              <button className="small" onClick={() => navigate("import")}>
                <Icon name="upload" size={14} /> Importar arquivo
              </button>
            </EmptyState>
          ) : s.analysisStatus === "running" ? (
            <div className="panel analysis-running" role="status">
              <span className="spinner large" aria-hidden />
              <strong>Analisando a transcrição…</strong>
              <span className="muted">
                {s.analysisProgress && s.analysisProgress.total > 1
                  ? `Parte ${s.analysisProgress.done} de ${s.analysisProgress.total}`
                  : "Isso costuma levar menos de um minuto."}
              </span>
              <button className="small" onClick={() => controller.cancelAnalysis()}>
                Cancelar análise
              </button>
            </div>
          ) : (
            <div className="panel analysis-start">
              <span className="empty-icon">
                <Icon name="sparkles" size={22} />
              </span>
              <strong>Transcrição pronta</strong>
              <span className="muted">A IA organiza resumo, decisões, tarefas e perguntas com os trechos que comprovam cada item.</span>
              <ContextSelect id="ctx-report" />
              <div className="row center">
                <button className="primary" disabled={!analysisProvider} onClick={run}>
                  <Icon name="sparkles" /> Analisar com IA
                </button>
                <button onClick={() => controller.createManualReport()}>Criar relatório manualmente</button>
              </div>
              {!analysisProvider && (
                <button className="small ghost" onClick={() => navigate("providers")}>
                  Configurar uma IA de análise
                </button>
              )}
              {s.analysisStatus === "error" && <p className="warn-text">A análise falhou. Verifique o provedor e tente novamente.</p>}
            </div>
          )}
        </div>
      </Page>
    );
  }

  const count = (key: SectionKey) => ((report.analysis[key] ?? []) as AnyItem[]).length;
  const navItems = [
    { id: "summary" as View, label: "Resumo", icon: "report" as const },
    { id: "participants" as View, label: "Participantes", icon: "users" as const, count: report.speakers.length },
    ...sections.map((sec) => ({ id: sec.key as View, label: sec.title, count: count(sec.key) })),
    { id: "transcript" as View, label: "Transcrição", icon: "transcript" as const },
    ...(isCurrent ? [{ id: "metrics" as View, label: "Métricas", icon: "chart" as const }] : []),
    { id: "notes" as View, label: "Observações", icon: "edit" as const },
    { id: "export" as View, label: "Exportar", icon: "download" as const }
  ];
  const section = sections.find((x) => x.key === view);
  const items = section ? ((report.analysis[section.key] ?? []) as AnyItem[]) : [];

  return (
    <Page
      title={report.title || "Relatório"}
      subtitle={
        isCurrent
          ? `Sessão atual · ${formatWhen(report.createdAt)}${analysisProvider ? ` · análise por ${analysisProvider}` : ""}`
          : `Guardado nesta execução · ${formatWhen(report.createdAt)} · ${entry?.sourceLabel ?? ""}`
      }
      actions={
        <>
          {back}
          <button className="small" disabled={exporting} onClick={() => void exportAs("pdf")}>
            <Icon name="download" size={14} /> Exportar PDF
          </button>
          <button className="small" disabled={exporting} onClick={() => void exportAs("docx")}>
            <Icon name="download" size={14} /> Exportar DOCX
          </button>
        </>
      }
    >
      <div className="reader">
        <aside className="reader-nav">
          <Tabs items={navItems} value={view} onChange={setView} label="Seções do relatório" vertical idPrefix="rep" />
        </aside>
        <div className="reader-body" role="tabpanel" aria-labelledby={`rep-${view}`}>
          {view === "summary" && (
            <div className="reader-stack">
              <div className="row nowrap">
                <label className="field grow">
                  <span>Título</span>
                  <input value={report.title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="field">
                  <span>Tipo de reunião</span>
                  <select value={context} onChange={(e) => setContext(e.target.value as ReportContext)} aria-label="Tipo de sessão">
                    {REPORT_CONTEXTS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {isCurrent && hasTranscript && s.analysisStatus !== "running" && (
                  <button
                    className="small field-btn"
                    disabled={!analysisProvider}
                    onClick={run}
                    title="Gera a análise de novo a partir da transcrição atual"
                  >
                    <Icon name="refresh" size={14} /> Refazer análise
                  </button>
                )}
                {s.analysisStatus === "running" && isCurrent && (
                  <span className="muted small-text field-btn">
                    <span className="spinner" /> Analisando…{" "}
                    <button className="small ghost" onClick={() => controller.cancelAnalysis()}>
                      Cancelar
                    </button>
                  </span>
                )}
              </div>
              <label className="field">
                <span>Objetivo ou assunto principal</span>
                <textarea
                  value={report.analysis.objective ?? ""}
                  rows={2}
                  placeholder="Não identificado"
                  onChange={(e) => update((r) => ({ ...r, analysis: { ...r.analysis, objective: e.target.value } }))}
                />
              </label>
              <label className="field">
                <span>Resumo executivo</span>
                <textarea
                  value={report.analysis.summary}
                  rows={6}
                  aria-label="Resumo geral"
                  onChange={(e) => update((r) => ({ ...r, analysis: { ...r.analysis, summary: e.target.value } }))}
                />
              </label>
              <label className="field">
                <span>Conclusão</span>
                <textarea
                  value={report.analysis.conclusion ?? ""}
                  rows={3}
                  placeholder="Não identificada"
                  onChange={(e) => update((r) => ({ ...r, analysis: { ...r.analysis, conclusion: e.target.value } }))}
                />
              </label>
              <div className="overview">
                {sections.map((sec) => (
                  <button key={sec.key} className="overview-item" onClick={() => setView(sec.key)}>
                    <b>{count(sec.key)}</b>
                    <span>{sec.title}</span>
                  </button>
                ))}
              </div>
              <p className="footnote">
                <Icon name="info" size={13} /> Itens marcados como “Inferência da IA” não foram ditos explicitamente. Responsáveis e prazos
                só aparecem quando mencionados nos trechos citados. Revise antes de usar.
              </p>
              {report.analysis.warnings.length > 0 && (
                <details className="warnings">
                  <summary>{report.analysis.warnings.length} aviso(s) do validador</summary>
                  <ul>
                    {report.analysis.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {view === "participants" &&
            (isCurrent ? (
              <SpeakersPanel />
            ) : report.speakers.length === 0 ? (
              <p className="empty">Nenhum participante identificado.</p>
            ) : (
              <ul className="mini-speakers">
                {report.speakers.map((sp) => (
                  <li key={sp.id}>
                    <span className={`dot tone-${sp.colorToken ?? "cinza"}`} aria-hidden />
                    {sp.label}
                    <span className="count">{report.transcript.filter((x) => x.speakerId === sp.id).length} trechos</span>
                  </li>
                ))}
              </ul>
            ))}

          {section && (
            <div className="reader-stack">
              <div className="row between">
                <h2 className="reader-title">
                  {section.title} <span className="count">{items.length}</span>
                </h2>
                <button
                  className="small"
                  onClick={() =>
                    updateSection(section.key, [
                      ...items,
                      { id: createId("item"), title: "Novo item", description: "", basis: "explicit", evidence: [] }
                    ])
                  }
                >
                  <Icon name="plus" size={14} /> Adicionar
                </button>
              </div>
              {items.length === 0 ? (
                <p className="empty">Nenhum item identificado.</p>
              ) : (
                <ul className="items">
                  {items.map((item, index) => (
                    <ItemEditor
                      key={item.id}
                      item={item}
                      section={section.key}
                      report={report}
                      onChange={(next) =>
                        updateSection(
                          section.key,
                          items.map((it, i) => (i === index ? next : it))
                        )
                      }
                      onRemove={() =>
                        updateSection(
                          section.key,
                          items.filter((_, i) => i !== index)
                        )
                      }
                      onMove={(delta) => {
                        const to = index + delta;
                        if (to < 0 || to >= items.length) return;
                        const next = [...items];
                        [next[index], next[to]] = [next[to] as AnyItem, next[index] as AnyItem];
                        updateSection(section.key, next);
                      }}
                      onJump={jump}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {view === "transcript" &&
            (isCurrent ? (
              <>
                <p className="muted small-text">Clique duas vezes em um trecho para corrigir.</p>
                <TranscriptView />
              </>
            ) : (
              <StaticTranscript report={report} />
            ))}

          {view === "metrics" && isCurrent && <MetricsPanel />}

          {view === "notes" && (
            <label className="field">
              <span>Observações (entram no documento exportado)</span>
              <textarea
                value={report.notes ?? ""}
                rows={12}
                aria-label="Observações"
                onChange={(e) => update((r) => ({ ...r, notes: e.target.value }))}
              />
            </label>
          )}

          {view === "export" && (
            <div className="reader-stack">
              <div className="export-grid">
                <fieldset>
                  <legend>Seções da análise</legend>
                  {sections.map((sec) => (
                    <label key={sec.key} className="check">
                      <input
                        type="checkbox"
                        checked={selected.has(sec.key)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(sec.key)) next.delete(sec.key);
                          else next.add(sec.key);
                          setChosen(next);
                        }}
                      />
                      {sec.title}
                    </label>
                  ))}
                </fieldset>
                {settings && (
                  <fieldset>
                    <legend>Também incluir</legend>
                    {INCLUDE.map(([key, label]) => (
                      <label key={key} className="check">
                        <input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggleSetting(key)} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
              <div className="row">
                {(["pdf", "docx", "md", "txt", "csv"] as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    disabled={exporting}
                    onClick={() => void exportAs(f)}
                    title={f === "csv" ? "Transcrição e marcadores em planilha" : undefined}
                  >
                    <Icon name="download" size={14} /> {f === "md" ? "Markdown" : f.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="footnote">
                <Icon name="shield" size={13} /> Os arquivos são gerados no seu {isWeb() ? "navegador" : "computador"}. Nada é enviado a
                terceiros na exportação.
              </p>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
