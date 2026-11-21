import { useState } from "react";

type CaptureChoice = "screen" | "window" | "tab";

export default function App() {
  const [choice, setChoice] = useState<CaptureChoice>("screen");

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">O</div>
        <div>
          <strong>Ouve</strong>
          <span>Assistente de reuniões e audiências</span>
        </div>
        <div className="status">Pronto para começar</div>
      </header>

      <section className="welcome">
        <p className="eyebrow">SEU ASSISTENTE DE ÁUDIO</p>
        <h1>Transforme conversas em informação.</h1>
        <p className="intro">
          Selecione uma fonte para capturar o áudio. O Ouve não grava nem analisa
          imagens da tela.
        </p>

        <div className="panel">
          <h2>Como deseja começar?</h2>
          <div className="choices">
            <button className={choice === "screen" ? "choice selected" : "choice"} onClick={() => setChoice("screen")}>
              <span className="choice-icon">▣</span>
              <strong>Tela inteira</strong>
              <small>Escolha um monitor</small>
            </button>
            <button className={choice === "window" ? "choice selected" : "choice"} onClick={() => setChoice("window")}>
              <span className="choice-icon">▢</span>
              <strong>Janela</strong>
              <small>Escolha um aplicativo</small>
            </button>
            <button className={choice === "tab" ? "choice selected" : "choice"} onClick={() => setChoice("tab")}>
              <span className="choice-icon">▤</span>
              <strong>Aba do navegador</strong>
              <small>Escolha uma aba compatível</small>
            </button>
          </div>
          <button className="primary" disabled>
            Iniciar captura de áudio
          </button>
          <p className="hint">
            Captura ainda em implementação. A seleção acima é apenas a prévia da experiência.
          </p>
        </div>
      </section>

      <footer>Privacidade em primeiro lugar · O áudio só é processado com sua autorização.</footer>
    </main>
  );
}
