import { useState } from "react";
import { BrandMark, Icon, type IconName } from "@ouve/ui";
import type { Screen } from "./hooks";

const STEPS: Array<{ icon: IconName; title: string; text: string; action?: { label: string; screen: Screen } }> = [
  {
    icon: "wave",
    title: "Conheça o Ouve",
    text: "O Ouve acompanha reuniões, audiências, entrevistas e aulas: transcreve o áudio, separa os participantes, mede a participação e organiza um relatório que você pode editar e exportar. Só áudio — sem gravação de tela."
  },
  {
    icon: "record",
    title: "Ao vivo ou por arquivo",
    text: "Em “Nova sessão”, escolha o microfone, uma tela, janela ou aba — mesmo que a reunião esteja em outro programa ou monitor. Ou importe uma gravação de áudio ou vídeo em “Importar arquivo”."
  },
  {
    icon: "providers",
    title: "Escolha uma inteligência artificial",
    text: "O jeito mais rápido é colar uma chave (a do Google Gemini tem cota gratuita). Se preferir que nada saia do computador, use uma IA local, como o Ollama. Dá para configurar depois.",
    action: { label: "Configurar agora", screen: "providers" }
  },
  {
    icon: "flag",
    title: "Marque o que importa",
    text: "Durante a sessão, os botões “Marcar” (ou Alt+1 a Alt+6) registram decisões, perguntas pendentes e pontos a revisar com o minuto exato. Depois, um clique leva ao trecho."
  },
  {
    icon: "report",
    title: "Revise e exporte",
    text: "Renomeie os participantes, corrija trechos e gere a análise. Exporte em PDF, DOCX, TXT, Markdown ou CSV, escolhendo o que entra no documento. Dúvidas? Abra “Ajuda” no menu."
  }
];

export function Onboarding({ onClose, onNavigate }: { onClose: () => void; onNavigate: (s: Screen) => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="modal onboarding">
        <div className="onb-head">
          <BrandMark />
          <span className="muted small-text">
            {i + 1} de {STEPS.length}
          </span>
          <button className="small icon-only" aria-label="Pular apresentação" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <span className="empty-icon">
          <Icon name={step.icon} size={28} />
        </span>
        <h2 id="onb-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="onb-dots" aria-hidden>
          {STEPS.map((_, n) => (
            <span key={n} className={n === i ? "on" : ""} />
          ))}
        </div>
        <div className="row between">
          <button onClick={onClose}>Pular</button>
          <div className="row">
            {i > 0 && <button onClick={() => setI(i - 1)}>Voltar</button>}
            {step.action && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate(step.action!.screen);
                }}
              >
                {step.action.label}
              </button>
            )}
            <button className="primary" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Começar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
