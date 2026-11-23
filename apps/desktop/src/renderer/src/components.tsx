import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@ouve/ui";
import { formatTimestamp } from "@ouve/shared";
import { markerLabel, segmentForMarker } from "@ouve/core";
import { useApp, useSession } from "./hooks";

export function Page({
  title,
  subtitle,
  actions,
  children,
  scroll = false,
  className
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Corpo com rolagem própria (textos longos). Por padrão a página ocupa a janela e só áreas internas rolam. */
  scroll?: boolean;
  className?: string;
}) {
  return (
    <section className={`page${className ? ` ${className}` : ""}`} aria-labelledby="page-title">
      <header className="page-head">
        <div className="page-title">
          <h1 id="page-title">{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="page-actions">
          <SessionChip />
          {actions}
        </div>
      </header>
      <div className={scroll ? "page-body scroll main-scroll" : "page-body main-scroll"}>{children}</div>
    </section>
  );
}

/** Indicador global de captura/processamento no cabeçalho de qualquer página. */
function SessionChip() {
  const { navigate } = useApp();
  const s = useSession();
  const live = s.mode === "live" && (s.status === "capturing" || s.status === "paused");
  const processing = s.mode === "import" && s.status === "processing";
  const analyzing = s.analysisStatus === "running";
  if (!live && !processing && !analyzing) return null;
  const label = live
    ? `${s.status === "capturing" ? "Gravando" : "Pausado"} · ${formatTimestamp(s.capturedMs)}`
    : processing
      ? "Processando arquivo"
      : "Gerando relatório";
  return (
    <button
      className={`session-chip ${live ? s.status : "busy"}`}
      onClick={() => navigate(analyzing && !live && !processing ? "report" : "session")}
      title="Abrir a sessão atual"
    >
      {live ? <span className="rec-dot" aria-hidden /> : <span className="spinner" aria-hidden />}
      <span aria-live="polite">{label}</span>
    </button>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  count?: number;
}

/** Abas acessíveis (setas do teclado alternam). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  vertical = false,
  idPrefix = "tab"
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  vertical?: boolean;
  idPrefix?: string;
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = items.findIndex((t) => t.id === value);
    const next = items[(i + (e.key === keys[1] ? 1 : items.length - 1)) % items.length]!;
    onChange(next.id);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-${next.id}`)?.focus());
  };
  return (
    <div
      className={vertical ? "tabs vertical" : "tabs"}
      role="tablist"
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onKeyDown={onKey}
    >
      {items.map((t) => (
        <button
          key={t.id}
          id={`${idPrefix}-${t.id}`}
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          className={value === t.id ? "tab active" : "tab"}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <Icon name={t.icon} size={15} />}
          <span>{t.label}</span>
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Painel lateral modal (configurações secundárias). Esc ou clique fora fecham. */
export function Drawer({
  title,
  onClose,
  children,
  footer
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.drawer-close)")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={ref}>
        <header className="drawer-head">
          <h2 id="drawer-title">{title}</h2>
          <button className="icon-only ghost drawer-close" aria-label="Fechar" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      {text && <span>{text}</span>}
      {children && <div className="row center">{children}</div>}
    </div>
  );
}

export type Tone = "ok" | "warn" | "danger" | "accent" | "neutral";

/** Estado com ícone + texto (nunca só cor). */
export function StatusBadge({ tone, icon, children }: { tone: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/** Cartão compacto com título opcional. */
export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  flush = false
}: {
  title?: string;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel${flush ? " flush" : ""}${className ? ` ${className}` : ""}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && (
            <h2>
              {icon && <Icon name={icon} size={15} />}
              {title}
            </h2>
          )}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function LevelMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(Math.sqrt(level) * 220));
  return (
    <div className="meter" role="meter" aria-label="Nível de áudio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Messages() {
  const { controller } = useApp();
  const s = useSession();
  if (s.messages.length === 0) return null;
  return (
    <div className="messages">
      {s.messages.map((m) => (
        <div key={m.id} className={`message ${m.kind}`} role={m.kind === "error" ? "alert" : "status"}>
          <span>{m.text}</span>
          <button aria-label="Dispensar" onClick={() => controller.dismissMessage(m.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function TranscriptView({ editable = true }: { editable?: boolean }) {
  const { controller } = useApp();
  useSession();
  const segments = controller.store.segments();
  const speakers = controller.store.speakerList();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const markersBySeg = new Map<string, string[]>();
  for (const m of controller.markers.list()) {
    const seg = segmentForMarker(segments, m.atMs);
    if (seg) markersBySeg.set(seg.id, [...(markersBySeg.get(seg.id) ?? []), markerLabel(m.kind)]);
  }

  if (segments.length === 0)
    return (
      <EmptyState icon="wave" title="Aguardando a transcrição" text="Os trechos aparecem aqui conforme cada bloco de áudio é processado." />
    );

  return (
    <ol className="transcript" aria-label="Transcrição">
      {segments.map((s) => {
        const low = controller.store.isLowConfidence(s);
        return (
          <li key={s.id} data-seg-id={s.id} className={low ? "segment low" : "segment"}>
            <div className="segment-meta">
              <span className="time">{formatTimestamp(s.startMs)}</span>
              {editable && speakers.length > 0 ? (
                <select
                  aria-label="Falante do trecho"
                  className={`speaker-select tone-${speakers.find((sp) => sp.id === s.speakerId)?.colorToken ?? "cinza"}`}
                  value={s.speakerId ?? ""}
                  onChange={(e) => controller.assignSpeaker(s.id, e.target.value as string)}
                >
                  {!s.speakerId && <option value="">Não identificado</option>}
                  {speakers.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="speaker">{controller.store.speakerLabel(s.speakerId)}</span>
              )}
              {low && (
                <span className="badge warn" title="O provedor indicou baixa confiança neste trecho">
                  baixa confiança
                </span>
              )}
              {s.edited && <span className="badge">editado</span>}
              {markersBySeg.get(s.id)?.map((label, i) => (
                <span key={i} className="badge flag">
                  <Icon name="flag" size={11} /> {label}
                </span>
              ))}
            </div>
            {editing === s.id ? (
              <div className="segment-edit">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Editar trecho" rows={3} />
                <div className="row">
                  <button
                    className="small primary"
                    onClick={() => {
                      controller.editSegment(s.id, draft);
                      setEditing(null);
                    }}
                  >
                    Salvar
                  </button>
                  <button className="small" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="segment-text"
                onDoubleClick={() => {
                  if (!editable) return;
                  setEditing(s.id);
                  setDraft(s.text);
                }}
                title={editable ? "Clique duas vezes para corrigir" : undefined}
              >
                {s.text}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function SpeakersPanel() {
  const { controller, notify } = useApp();
  useSession();
  const speakers = controller.store.speakerList();
  const segments = controller.store.segments();
  return (
    <div className="speakers">
      <p className="muted">
        Os falantes recebem nomes neutros. O Ouve não identifica pessoas pela voz; renomeie apenas quando tiver certeza. Rótulos vêm da
        diarização do provedor e podem variar entre blocos de áudio.
      </p>
      {speakers.length === 0 && <p className="empty">Nenhum falante identificado. O provedor configurado pode não oferecer diarização.</p>}
      {speakers.map((sp) => (
        <form
          key={sp.id}
          className="speaker-row"
          onSubmit={(e) => {
            e.preventDefault();
            const input = new FormData(e.currentTarget).get("label");
            try {
              controller.renameSpeaker(sp.id, String(input ?? ""));
              notify("Nome atualizado.");
            } catch (error) {
              notify((error as Error).message, "error");
            }
          }}
        >
          <span className={`dot tone-${sp.colorToken ?? "cinza"}`} aria-hidden />
          <input name="label" defaultValue={sp.label} aria-label={`Nome de ${sp.label}`} maxLength={80} />
          <span className="muted small-text">{segments.filter((s) => s.speakerId === sp.id).length} trechos</span>
          <button className="small" type="submit">
            Renomear
          </button>
        </form>
      ))}
    </div>
  );
}
