import { OUVE_CREDIT } from "@ouve/shared";
import { BrandMark, Icon } from "./icons";

/**
 * Termo de uso aceito uma única vez, no primeiro uso após a instalação (D-063).
 * Ao mudar o conteúdo de forma relevante, incremente TERMS_VERSION para pedir novo aceite.
 */
export { TERMS_VERSION } from "./terms-version";

export const TERMS_ITEMS: string[] = [
  "Vou usar o Ouve apenas para reuniões, audiências, entrevistas ou aulas em que eu tenha autorização para captar e transcrever o áudio.",
  "Sou responsável por informar os participantes sobre a gravação e a transcrição, conforme as regras do meu órgão ou instituição.",
  "Entendo que o Ouve usa somente o áudio — não grava a tela nem imagens — e que o áudio é enviado em blocos ao provedor de IA que eu configurar, sob os termos desse provedor.",
  "Entendo que o Ouve não guarda histórico em disco: o áudio é descartado ao encerrar a sessão, os relatórios ficam só na memória até eu fechar o aplicativo (posso desligar isso nas configurações) e só ficam salvos os relatórios que eu exportar.",
  "Sei que o conteúdo gerado por IA pode conter erros e que devo revisá-lo antes de usar."
];

export function TermsGate({ onAccept, busy = false }: { onAccept: () => void; busy?: boolean }) {
  return (
    <main className="terms-gate">
      <div className="terms-card" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <div className="terms-head">
          <BrandMark size={44} />
          <div>
            <h1 id="terms-title">Bem-vindo ao Ouve</h1>
            <p>Antes do primeiro uso, confirme os termos abaixo. Isso só é pedido uma vez.</p>
          </div>
        </div>
        <ul className="terms-list">
          {TERMS_ITEMS.map((item) => (
            <li key={item}>
              <Icon name="check" size={16} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="terms-note">
          <Icon name="shield" size={14} /> Durante qualquer captura, o Ouve mostra um aviso fixo de “Capturando áudio”, com opções de pausar
          e encerrar.
        </p>
        <button className="primary large" disabled={busy} onClick={onAccept}>
          Aceitar e começar
        </button>
        <p className="terms-credit">{OUVE_CREDIT}</p>
      </div>
    </main>
  );
}
