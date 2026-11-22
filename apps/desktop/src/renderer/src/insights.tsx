import { useEffect, useMemo, useState } from "react";
import {
  MARKER_KINDS,
  METRICS_LIMITATIONS,
  REPORT_CONTEXTS,
  STAGE_LABELS,
  computeMetrics,
  formatDuration,
  markerLabel,
  segmentForMarker,
  type MarkerKind,
  type ReportContext
} from "@ouve/core";
import { formatTimestamp } from "@ouve/shared";
import { Icon } from "@ouve/ui";
import { useApp, useSession } from "./hooks";

/** Rola a transcrição até o trecho e o destaca por alguns segundos. */
export function jumpToSegment(segmentId: string | undefined): void {
  if (!segmentId) return;
  const el = document.querySelector<HTMLElement>(`[data-seg-id="${CSS.escape(segmentId)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 2400);
}

const KIND_TONE: Record<MarkerKind, string> = {
  decision: "verde",
  question: "laranja",
  relevant: "azul",
  divergence: "rosa",
  followup: "roxo",
  review: "amarelo"
};

/** Botões de marcador com atalhos Alt+1…6. */
export function MarkerBar({ compact = false }: { compact?: boolean }) {
  const { controller, notify } = useApp();
  const s = useSession();
  const enabled = s.mode !== "none";

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const def = MARKER_KINDS.find((m) => m.shortcut === e.key);
      if (!def) return;
      e.preventDefault();
      controller.addMarker(def.kind);
      notify(`Marcador “${def.label}” em ${formatTimestamp(controller.sessionDurationMs())}.`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controller, enabled, notify]);

  if (!enabled) return null;
  return (
    <div className={compact ? "marker-bar compact" : "marker-bar"} role="group" aria-label="Marcar momento">
      <span className="marker-bar-label">
        <Icon name="flag" size={14} /> Marcar:
      </span>
      {MARKER_KINDS.map((m) => (
        <button
          key={m.kind}
          className={`chip tone-${KIND_TONE[m.kind]}`}
          title={`${m.label} (Alt+${m.shortcut})`}
          onClick={() => {
            controller.addMarker(m.kind);
            notify(`Marcador “${m.label}” em ${formatTimestamp(controller.sessionDurationMs())}.`);
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function MarkerList({ onJump }: { onJump?: () => void }) {
  const { controller } = useApp();
  useSession();
  const markers = controller.markers.list();
  const segments = controller.store.segments();
  if (markers.length === 0)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Icon name="flag" size={26} />
        </span>
        <strong>Nenhum marcador</strong>
        <span>
          Durante a captura ou a revisão, use os botões “Marcar” (ou Alt+1 a Alt+6) para registrar decisões, perguntas e pontos a revisar.
        </span>
      </div>
    );
  return (
    <ul className="marker-list">
      {markers.map((m) => {
        const seg = segmentForMarker(segments, m.atMs);
        return (
          <li key={m.id}>
            <button
              className="marker-jump"
              onClick={() => {
                onJump?.();
                setTimeout(() => jumpToSegment(seg?.id), 50);
              }}
              title="Ir para o trecho"
            >
              <span className="time">{formatTimestamp(m.atMs)}</span>
              <span className={`chip tone-${KIND_TONE[m.kind]}`}>{markerLabel(m.kind)}</span>
              {m.origin === "suggested" && <span className="badge">sugerido</span>}
            </button>
            <select
              aria-label="Tipo do marcador"
              value={m.kind}
              onChange={(e) => controller.markers.update(m.id, { kind: e.target.value as MarkerKind })}
            >
              {MARKER_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Observação do marcador"
              placeholder="Observação (opcional)"
              defaultValue={m.note ?? ""}
              maxLength={300}
              onBlur={(e) => controller.markers.update(m.id, { note: e.target.value.trim() })}
            />
            <button className="small icon-only" aria-label="Remover marcador" onClick={() => controller.markers.remove(m.id)}>
              <Icon name="trash" size={14} />
            </button>
            {seg && (
              <p className="muted small-text marker-seg">
                {controller.store.speakerLabel(seg.speakerId)}: {seg.text.slice(0, 140)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Aviso discreto (um por vez, com intervalo mínimo) vindo das regras locais. */
export function HintBanner() {
  const { controller } = useApp();
  const s = useSession();
  const hint = s.hint;
  if (!hint) return null;
  return (
    <div className="hint" role="status">
      <Icon name="sparkles" size={15} />
      <span>
        <strong>{hint.text}</strong> em {formatTimestamp(hint.atMs)}
      </span>
      <button className="small link" onClick={() => jumpToSegment(hint.segmentId)}>
        Ver trecho
      </button>
      {hint.suggestedMarker && (
        <button className="small" onClick={() => controller.acceptHint()}>
          <Icon name="flag" size={13} /> Marcar como {markerLabel(hint.suggestedMarker).toLowerCase()}
        </button>
      )}
      <button className="small icon-only" aria-label="Dispensar aviso" onClick={() => controller.dismissHint()}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

const TONE_VARS = ["azul", "verde", "laranja", "roxo", "rosa", "ciano", "amarelo", "cinza"];

/** Painel de métricas locais: calculadas da transcrição, sem IA. */
export function MetricsPanel() {
  const { controller } = useApp();
  const s = useSession();
  const segments = controller.store.segments();
  const speakers = controller.store.speakerList();
  // Recalcula quando a sessão muda (nova fala, renomear, reatribuir).
  const m = useMemo(() => computeMetrics(segments, speakers), [s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showRanges, setShowRanges] = useState<string | null>(null);
  if (segments.length === 0)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Icon name="chart" size={26} />
        </span>
        <strong>Sem dados ainda</strong>
        <span>As métricas aparecem quando houver transcrição.</span>
      </div>
    );
  const tone = (id: string) => speakers.find((sp) => sp.id === id)?.colorToken ?? TONE_VARS[7];
  const span = Math.max(1, m.spanMs);
  const origin = m.buckets[0]?.startMs ?? 0;
  return (
    <div className="metrics">
      <div className="stats">
        <div className="stat">
          <b>{formatDuration(m.totalTalkMs)}</b>
          <span>tempo de fala</span>
        </div>
        <div className="stat">
          <b>{m.turns}</b>
          <span>intervenções</span>
        </div>
        <div className="stat">
          <b>{m.speakerChanges}</b>
          <span>alternâncias</span>
        </div>
        <div className="stat">
          <b>{m.questions}</b>
          <span>perguntas</span>
        </div>
      </div>

      <h4>Participação por pessoa</h4>
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Participante</th>
            <th>Tempo de fala</th>
            <th>Intervenções</th>
            <th>Perguntas</th>
            <th title="Palavras por minuto falado">Palavras/min</th>
            <th>Maior fala</th>
          </tr>
        </thead>
        <tbody>
          {m.speakers.map((sp) => (
            <tr key={sp.speakerId}>
              <td>
                <span className={`dot tone-${tone(sp.speakerId)}`} aria-hidden /> {sp.label}
              </td>
              <td>
                <div className="share">
                  <div className={`share-bar tone-${tone(sp.speakerId)}`} style={{ width: `${Math.round(sp.share * 100)}%` }} />
                  <span>
                    {formatDuration(sp.talkMs)} · {Math.round(sp.share * 100)}%
                  </span>
                </div>
              </td>
              <td>{sp.turns}</td>
              <td>{sp.questions}</td>
              <td>{sp.wordsPerMinute ?? "—"}</td>
              <td>{formatDuration(sp.longestTurnMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Linha do tempo — quem falou e quando</h4>
      <div className="timeline" aria-label="Linha do tempo das falas">
        {m.speakers.map((sp) => (
          <div key={sp.speakerId} className="timeline-row">
            <button
              className="timeline-label link"
              onClick={() => setShowRanges(showRanges === sp.speakerId ? null : sp.speakerId)}
              title="Mostrar de que minuto a que minuto"
            >
              {sp.label}
            </button>
            <div className="timeline-track">
              {sp.intervals.map((iv) => (
                <span
                  key={iv.startMs}
                  className={`timeline-seg tone-${tone(sp.speakerId)}`}
                  style={{
                    left: `${((iv.startMs - origin) / span) * 100}%`,
                    width: `${Math.max(0.3, ((iv.endMs - iv.startMs) / span) * 100)}%`
                  }}
                  title={`${formatTimestamp(iv.startMs)}–${formatTimestamp(iv.endMs)}`}
                />
              ))}
            </div>
            {showRanges === sp.speakerId && (
              <p className="timeline-ranges small-text">
                {sp.intervals.map((iv) => `${formatTimestamp(iv.startMs)}–${formatTimestamp(iv.endMs)}`).join(" · ")}
              </p>
            )}
          </div>
        ))}
        <div className="timeline-axis small-text muted">
          <span>{formatTimestamp(origin)}</span>
          <span>{formatTimestamp(origin + m.spanMs)}</span>
        </div>
      </div>

      {(m.monologues.length > 0 || m.silences.length > 0) && (
        <>
          <h4>Observações</h4>
          <ul className="plain-list small-text">
            {m.monologues.map((x) => (
              <li key={`${x.speakerId}-${x.startMs}`}>
                Fala contínua de {controller.store.speakerLabel(x.speakerId)}: {formatTimestamp(x.startMs)}–{formatTimestamp(x.endMs)} (
                {formatDuration(x.endMs - x.startMs)})
              </li>
            ))}
            {m.silences.length > 0 && (
              <li>
                {m.silences.length} intervalo(s) sem fala acima de 10 s (somam{" "}
                {formatDuration(m.silences.reduce((n, g) => n + g.endMs - g.startMs, 0))}).
              </li>
            )}
          </ul>
        </>
      )}
      <p className="muted small-text">
        <Icon name="info" size={13} /> {METRICS_LIMITATIONS}
      </p>
    </div>
  );
}

/** Tempo gasto em cada etapa: mostra o que está acontecendo e onde está a demora. */
export function StagesPanel() {
  const { controller } = useApp();
  const s = useSession();
  const stages = controller.stages.list();
  const [, tick] = useState(0);
  const running = stages.some((st) => st.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  if (stages.length === 0 || s.mode === "none") return null;
  return (
    <div className="panel">
      <h3 className="side-title">Tempo por etapa</h3>
      <ul className="stage-list">
        {stages.map((st) => (
          <li key={st.stage} className={st.status} title={st.detail}>
            <span className="stage-icon">
              {st.status === "running" ? (
                <span className="spinner" aria-hidden />
              ) : (
                <Icon name={st.status === "done" ? "check" : st.status === "canceled" ? "x" : "alert"} size={13} />
              )}
            </span>
            <span>{STAGE_LABELS[st.stage]}</span>
            <span className="mono">{formatDuration(controller.stages.elapsed(st))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContextSelect({ id = "ctx" }: { id?: string }) {
  const { controller } = useApp();
  const s = useSession();
  return (
    <label className="field inline" htmlFor={id}>
      <span>Tipo de sessão</span>
      <select
        id={id}
        value={s.context}
        onChange={(e) => controller.setContext(e.target.value as ReportContext)}
        title={REPORT_CONTEXTS.find((c) => c.value === s.context)?.hint}
      >
        {REPORT_CONTEXTS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
