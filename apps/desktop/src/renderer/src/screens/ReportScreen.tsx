import { useState } from "react";
import { Icon } from "@ouve/ui";
import type { ActionItem, AnalysisItem, QuestionAnswer, ReportDocument } from "@ouve/core";
import { REPORT_SECTIONS, type SectionKey } from "@ouve/reports";
import { createId, formatTimestamp } from "@ouve/shared";
import { Page } from "../components";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";

type AnyItem = AnalysisItem & Partial<ActionItem> & Partial<QuestionAnswer>;

function ItemEditor({
  item,
  section,
  report,
  onChange,
  onRemove
}: {
  item: AnyItem;
  section: SectionKey;
  report: ReportDocument;
  onChange: (i: AnyItem) => void;
  onRemove: () => void;
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
                {seg ? <span className="time">{formatTimestamp(seg.startMs)}</span> : null} {ev.quote ? `“${ev.quote}”` : seg?.text}
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

  const exportAs = async (format: "pdf" | "docx" | "md") => {
    setExporting(true);
    try {
      const path = await controller.exportReport(format);
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
            <button disabled={exporting} onClick={() => void exportAs("md")}>
              Markdown
            </button>
          </>
        )
      }
    >
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
          <section className="panel">
            <h2>Resumo geral</h2>
            <textarea
              value={report.analysis.summary}
              rows={6}
              aria-label="Resumo geral"
              onChange={(e) => controller.updateReport((r) => ({ ...r, analysis: { ...r.analysis, summary: e.target.value } }))}
            />
          </section>
          {REPORT_SECTIONS.map((section) => {
            const items = report.analysis[section.key] as AnyItem[];
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
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
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
