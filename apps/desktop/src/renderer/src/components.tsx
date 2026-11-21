import { useState, type ReactNode } from "react";
import { Icon } from "@ouve/ui";
import { formatTimestamp } from "@ouve/shared";
import { useApp, useSession } from "./hooks";

export function Page({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
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

  if (segments.length === 0)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Icon name="wave" size={28} />
        </span>
        <strong>Aguardando a transcrição</strong>
        <span>Os trechos aparecem aqui conforme cada bloco de áudio é processado pelo provedor.</span>
      </div>
    );

  return (
    <ol className="transcript" aria-label="Transcrição">
      {segments.map((s) => {
        const low = controller.store.isLowConfidence(s);
        return (
          <li key={s.id} className={low ? "segment low" : "segment"}>
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
