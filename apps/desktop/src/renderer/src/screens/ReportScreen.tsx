import { useState } from "react";
import { Icon } from "@ouve/ui";
import type { ActionItem, AnalysisItem, QuestionAnswer, ReportDocument } from "@ouve/core";
import { sectionsFor, type ExportFormat, type SectionKey } from "@ouve/reports";
import { createId, formatTimestamp } from "@ouve/shared";
import { Page } from "../components";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";
import { ContextSelect, jumpToSegment } from "../insights";
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
        <button className="small icon-only" onClick={() => onMove(-1)} aria-label="Mover para cima" title="Mover para cima">
          ↑
        </button>
        <button className="small icon-only" onClick={() => onMove(1)} aria-label="Mover para baixo" title="Mover para baixo">
          ↓
        </button>
        <button className="small danger" onClick={onRemove} aria-label="Remover item">
          Remover
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

export function ReportScreen({ data }: { data: AppData }) {
  const { controller, navigate, notify } = useApp();
  const s = useSession();
  const [exporting, setExporting] = useState(false);
  const report = s.report;
  const analysisProvider = data.providers.find((p) => p.config.id === data.settings?.analysisProviderId)?.config.displayName;
  const hasTranscript = controller.store.segments().length > 0;

  const run = () => void controller.analyze().catch((e: unknown) => notify(errorMessage(e), "error"));
  const sections = sectionsFor(s.context);
  const [chosen, setChosen] = useState<Set<SectionKey> | null>(null);
  const selected = chosen ?? new Set(sections.map((x) => x.key));
  const settings = data.settings;
  const toggleSetting = (key: keyof AppSettings) => settings && void data.saveSettings({ ...settings, [key]: !settings[key] });

  const jump = (segmentId: string) => {
    navigate("session");
    setTimeout(() => jumpToSegment(segmentId), 150);
  };

  const exportAs = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const path = await controller.exportReport(format, chosen ? [...selected] : undefined);
      if (path) notify(`Relatório salvo em ${path}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setExporting(false);
    }
  };

  const updateSection = (key: SectionKey, items: AnyItem[]) =>
    controller.updateReport((r) => ({ ...r, analysis: { ...r.analysis, [key]: items } }));

  return (
    <Page
      title="Análise e relatório"
      subtitle={
        analysisProvider
          ? `Análise por ${analysisProvider}. O conteúdo da transcrição será enviado a esse provedor.`
          : "Configure um provedor de análise."
      }
      actions={
        report && (
          <>
            <button disabled={exporting} onClick={() => void exportAs("pdf")}>
              <Icon name="download" /> Exportar PDF
            </button>
            <button disabled={exporting} onClick={() => void exportAs("docx")}>
              <Icon name="download" /> Exportar DOCX
            </button>
          </>
        )
      }
    >
      <div className="row">
        <ContextSelect id="ctx-report" />
        <span className="muted small-text">
          <Icon name="info" size={13} /> A análise usa só o texto da transcrição — o áudio não é enviado de novo.
        </span>
      </div>
      {!hasTranscript && !report && (
        <div className="callout">
          Ainda não há transcrição. <button onClick={() => navigate("new")}>Nova sessão</button>{" "}
          <button onClick={() => navigate("import")}>Importar arquivo</button>
        </div>
      )}

      {s.analysisStatus === "running" && (
        <div className="panel">
          <p>
            Analisando a transcrição…{" "}
            {s.analysisProgress && s.analysisProgress.total > 1 ? `(${s.analysisProgress.done}/${s.analysisProgress.total})` : ""}
          </p>
          <progress />
          <button onClick={() => controller.cancelAnalysis()}>Cancelar análise</button>
        </div>
      )}

      {hasTranscript && s.analysisStatus !== "running" && (
        <div className="row">
          <button className="primary" disabled={!analysisProvider} onClick={run}>
            <Icon name="sparkles" /> {report ? "Refazer análise" : "Analisar com IA"}
          </button>
          {!report && <button onClick={() => controller.createManualReport()}>Criar relatório manualmente</button>}
          {s.analysisStatus === "error" && <span className="warn-text">A análise falhou. Verifique o provedor e tente novamente.</span>}
        </div>
      )}

      {report && (
        <div className="report">
          <label className="field">
            <span>Título</span>
            <input value={report.title} onChange={(e) => controller.setTitle(e.target.value)} />
          </label>
          <p className="muted">
            Itens marcados como “Inferência da IA” não foram ditos explicitamente. Responsáveis e prazos só aparecem quando mencionados nos
            trechos citados. Revise antes de usar.
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
          <details className="panel export-panel">
            <summary>
              <Icon name="download" size={15} /> Exportar e escolher o que incluir
            </summary>
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
                  {(
                    [
                      ["includeTranscriptInExport", "Transcrição completa"],
                      ["exportTimestamps", "Horários (tempo decorrido)"],
                      ["exportMetrics", "Participação e linha do tempo das falas"],
                      ["exportMarkers", "Marcadores"],
                      ["exportEvidence", "Trechos de evidência"],
                      ["exportNotes", "Observações"]
                    ] as Array<[keyof AppSettings, string]>
                  ).map(([key, label]) => (
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
            <p className="muted small-text">Os arquivos são gerados no seu computador. Nada é enviado a terceiros na exportação.</p>
          </details>
          <section className="panel">
            <h2>Objetivo ou assunto principal</h2>
            <textarea
              value={report.analysis.objective ?? ""}
              rows={2}
              aria-label="Objetivo ou assunto principal"
              placeholder="Não identificado"
              onChange={(e) => controller.updateReport((r) => ({ ...r, analysis: { ...r.analysis, objective: e.target.value } }))}
            />
          </section>
          <section className="panel">
            <h2>Resumo executivo</h2>
            <textarea
              value={report.analysis.summary}
              rows={6}
              aria-label="Resumo geral"
              onChange={(e) => controller.updateReport((r) => ({ ...r, analysis: { ...r.analysis, summary: e.target.value } }))}
            />
          </section>
          {sections.map((section) => {
            const items = (report.analysis[section.key] ?? []) as AnyItem[];
            return (
              <section className="panel" key={section.key}>
                <div className="row between">
                  <h2>
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
              </section>
            );
          })}
          <section className="panel">
            <h2>Conclusão</h2>
            <textarea
              value={report.analysis.conclusion ?? ""}
              rows={3}
              aria-label="Conclusão"
              placeholder="Não identificada"
              onChange={(e) => controller.updateReport((r) => ({ ...r, analysis: { ...r.analysis, conclusion: e.target.value } }))}
            />
          </section>
          <section className="panel">
            <h2>Observações</h2>
            <textarea
              value={report.notes ?? ""}
              rows={4}
              aria-label="Observações"
              onChange={(e) => controller.updateReport((r) => ({ ...r, notes: e.target.value }))}
            />
          </section>
        </div>
      )}
    </Page>
  );
}
