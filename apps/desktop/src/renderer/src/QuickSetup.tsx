import { useState } from "react";
import { Icon } from "@ouve/ui";
import type { QuickSetupOutcome } from "../../shared/ipc";
import { bridge, isWeb, unwrap } from "./bridge";
import { errorMessage } from "./hooks";

/** Configuração rápida: colar a chave e pronto (D-065). */
export function QuickSetup({ onDone, compact = false }: { onDone: () => void | Promise<void>; compact?: boolean }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuickSetupOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await unwrap(bridge().providers.quickSetup(key));
      setResult(outcome);
      if (outcome.ok) {
        setKey("");
        await onDone();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel quick-setup">
      <h2>
        <Icon name="sparkles" /> {compact ? "Configuração rápida" : "Cole sua chave de IA e pronto"}
      </h2>
      <p className="muted">
        O Ouve reconhece a IA pela chave, testa a conexão e escolhe os modelos sozinho. Funciona com Google Gemini (tem plano gratuito),
        OpenAI, Claude e Grok.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim() && !busy) void connect();
        }}
      >
        <input
          type="password"
          autoComplete="off"
          aria-label="Chave de API"
          placeholder="Cole aqui a chave (ex.: AQ.… ou AIza… do Gemini)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="primary" type="submit" disabled={!key.trim() || busy}>
          <Icon name="check" /> {busy ? "Conectando…" : "Conectar"}
        </button>
      </form>
      {!compact && (
        <p className="muted small-text">
          Não tem chave? Gere uma grátis no{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          . {isWeb() ? "A chave fica salva só neste navegador" : "A chave fica cifrada neste computador"} e só é enviada para a própria IA.
        </p>
      )}
      {error && (
        <p className="warn-text" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
      {result && (
        <div role="status" className={result.ok ? "callout" : "callout warn"}>
          <Icon name={result.ok ? "check" : "alert"} size={16} />
          <div>
            <strong>{result.message}</strong>
            {result.notes.map((n) => (
              <p key={n} className="muted small-text" style={{ margin: "4px 0 0" }}>
                {n}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
