import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@ouve/ui";
import type { ExportFormat } from "@ouve/reports";
import { EmptyState, Page, StatusBadge } from "../components";
import { errorMessage, useApp, useSession } from "../hooks";
import { contextLabel, formatLength, formatWhen, reportRows, type ReportRow } from "../report-rows";

type SortKey = "title" | "createdAt" | "durationMs" | "participants";
type Period = "all" | "today" | "week" | "month";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "all", label: "Qualquer data" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Últimos 7 dias" },
  { value: "month", label: "Últimos 30 dias" }
];
const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (DOCX)" },
  { value: "md", label: "Markdown" },
  { value: "txt", label: "Texto (TXT)" },
  { value: "csv", label: "Planilha (CSV)" }
];
const PAGE_SIZE = 12;

function inPeriod(ms: number, period: Period, now = Date.now()): boolean {
  if (period === "all") return true;
  if (period === "today") return new Date(ms).toDateString() === new Date(now).toDateString();
  return now - ms <= (period === "week" ? 7 : 30) * 86_400_000;
}

/** Menu “Exportar” de uma linha. */
function ExportMenu({ row }: { row: ReportRow }) {
  const { controller, notify } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  const run = async (format: ExportFormat) => {
    setOpen(false);
    try {
      const path = await controller.exportReport(format, undefined, row.id ?? undefined);
      if (path) notify(`Relatório salvo em ${path}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="small icon-only ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Exportar ${row.title}`}
        title="Exportar"
        onClick={() => setOpen(!open)}
      >
        <Icon name="download" size={15} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {FORMATS.map((f) => (
            <button key={f.value} role="menuitem" onClick={() => void run(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportsScreen() {
  const { controller, navigate, notify, openReport } = useApp();
  const s = useSession();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [page, setPage] = useState(0);
  const all = reportRows(controller, s);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return all
      .filter((r) => inPeriod(r.createdAt, period))
      .filter((r) => !q || `${r.title} ${r.sourceLabel} ${contextLabel(r.context)}`.toLocaleLowerCase("pt-BR").includes(q))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        return (typeof av === "string" ? av.localeCompare(String(bv), "pt-BR") : av - (bv as number)) * sort.dir;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version, query, period, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => setPage(0), [query, period]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={className} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        className="th-sort"
        onClick={() => setSort((p) => ({ key, dir: p.key === key ? (-p.dir as 1 | -1) : key === "title" ? 1 : -1 }))}
      >
        {label}
        <Icon name={sort.key === key ? "chevronDown" : "sort"} size={12} className={sort.key === key && sort.dir === 1 ? "flip" : ""} />
      </button>
    </th>
  );

  const remove = async (row: ReportRow) => {
    if (row.id === null) {
      if (!window.confirm("Excluir o relatório da sessão atual descarta também a transcrição e o áudio desta sessão. Continuar?")) return;
      await controller.discard({ keepReport: false });
    } else {
      if (
        !window.confirm(
          `Excluir “${row.title}” da lista? ${row.exported.length ? "" : "Ele ainda não foi exportado e não poderá ser recuperado."}`
        )
      )
        return;
      controller.removeFromLibrary(row.id);
    }
    notify("Relatório excluído.");
  };

  const archived = all.filter((r) => r.id !== null).length;

  return (
    <Page
      title="Relatórios"
      subtitle="Ficam só na memória até você fechar o Ouve. Exporte os que quiser guardar."
      actions={
        archived > 0 && (
          <button
            className="small ghost"
            onClick={() => {
              if (window.confirm(`Excluir os ${archived} relatório(s) da lista? Os que não foram exportados não poderão ser recuperados.`))
                controller.clearLibrary();
            }}
          >
            <Icon name="trash" size={14} /> Limpar lista
          </button>
        )
      }
    >
      <div className="library">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={15} />
            <input
              type="search"
              placeholder="Pesquisar por nome, arquivo ou tipo"
              aria-label="Pesquisar relatórios"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="muted small-text">
            {rows.length} de {all.length}
          </span>
        </div>

        <div className="table-wrap panel flush">
          {all.length === 0 ? (
            <EmptyState
              icon="library"
              title="Nenhum relatório nesta execução"
              text="Os relatórios gerados aparecem aqui. Comece por uma reunião ou um arquivo."
            >
              <button className="primary small" onClick={() => navigate("new")}>
                <Icon name="record" size={14} /> Nova reunião
              </button>
              <button className="small" onClick={() => navigate("import")}>
                <Icon name="upload" size={14} /> Importar arquivo
              </button>
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState icon="search" title="Nada encontrado" text="Ajuste a pesquisa ou o período." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {header("title", "Nome")}
                  {header("createdAt", "Data", "col-date")}
                  {header("durationMs", "Duração", "col-num")}
                  {header("participants", "Participantes", "col-num")}
                  <th className="col-type">Tipo</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id ?? "atual"}>
                    <td>
                      <button className="row-title" onClick={() => openReport(r.id)} title="Abrir relatório">
                        <Icon name={r.origin === "live" ? "record" : "upload"} size={14} className="muted-icon" />
                        <span className="ellipsis">{r.title}</span>
                      </button>
                    </td>
                    <td className="col-date">{formatWhen(r.createdAt)}</td>
                    <td className="col-num">{formatLength(r.durationMs)}</td>
                    <td className="col-num">{r.participants || "—"}</td>
                    <td className="col-type">{contextLabel(r.context)}</td>
                    <td className="col-status">
                      {r.id === null ? (
                        <StatusBadge tone="accent" icon="edit">
                          Sessão atual
                        </StatusBadge>
                      ) : r.exported.length ? (
                        <StatusBadge tone="ok" icon="check">
                          Exportado ({r.exported.map((f) => f.toUpperCase()).join(", ")})
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="warn" icon="alert">
                          Não exportado
                        </StatusBadge>
                      )}
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          className="small icon-only ghost"
                          aria-label={`Abrir ${r.title}`}
                          title="Abrir e editar"
                          onClick={() => openReport(r.id)}
                        >
                          <Icon name="eye" size={15} />
                        </button>
                        <ExportMenu row={r} />
                        <button
                          className="small icon-only ghost danger"
                          aria-label={`Excluir ${r.title}`}
                          title="Excluir"
                          onClick={() => void remove(r)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pages > 1 && (
          <nav className="pager" aria-label="Páginas">
            <button className="small" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <Icon name="chevronLeft" size={14} /> Anterior
            </button>
            <span className="muted small-text">
              Página {current + 1} de {pages}
            </span>
            <button className="small" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Próxima <Icon name="chevron" size={14} />
            </button>
          </nav>
        )}
      </div>
    </Page>
  );
}
