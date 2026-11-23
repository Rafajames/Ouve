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
      <header className="panel-head">
        <h2>
          <Icon name="key" size={15} /> Cole sua chave de IA e pronto
        </h2>
      </header>
      {!compact && (
        <p className="muted small-text">
          O Ouve reconhece a IA pela chave (Google Gemini, OpenAI, Claude ou Grok), testa a conexão e escolhe os modelos sozinho.
        </p>
      )}
      <form
        className="row nowrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim() && !busy) void connect();
        }}
      >
        <input
          type="password"
          autoComplete="off"
          aria-label="Chave de API"
          placeholder="Cole aqui a chave (ex.: AIza… do Gemini)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="grow"
        />
        <button className="primary" type="submit" disabled={!key.trim() || busy}>
          {busy ? "Conectando…" : "Conectar"}
        </button>
      </form>
      <p className="muted small-text">
        Não tem chave? Gere uma grátis no{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio <Icon name="external" size={11} />
        </a>
        .{" "}
        {isWeb()
          ? "A chave fica só nesta aba (apagada ao fechar), a menos que você escolha lembrar neste navegador,"
          : "A chave fica cifrada neste computador"}{" "}
        e só é enviada para a própria IA.
      </p>
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
              <p key={n} className="muted small-text">
                {n}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
