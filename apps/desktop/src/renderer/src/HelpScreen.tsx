import { Icon } from "@ouve/ui";
import { MARKER_KINDS } from "@ouve/core";
import { Page } from "./components";
import { useApp } from "./hooks";

/** Onde conseguir uma chave em cada provedor (páginas oficiais). */
export const KEY_PAGES: Array<{ name: string; url: string; free: string; steps: string }> = [
  {
    name: "Google Gemini",
    url: "https://aistudio.google.com/apikey",
    free: "Tem cota gratuita (com limites por minuto e por dia).",
    steps: "Entre com sua conta Google, clique em “Criar chave de API” e copie a chave."
  },
  {
    name: "OpenAI (GPT)",
    url: "https://platform.openai.com/api-keys",
    free: "Pago por uso; exige crédito na conta.",
    steps: "Entre na plataforma da OpenAI, clique em “Create new secret key” e copie a chave."
  },
  {
    name: "Anthropic (Claude)",
    url: "https://console.anthropic.com/settings/keys",
    free: "Pago por uso; exige crédito na conta. Não transcreve áudio (só análise).",
    steps: "Entre no Console da Anthropic, crie uma chave em “API Keys” e copie."
  },
  {
    name: "xAI (Grok)",
    url: "https://console.x.ai",
    free: "Pago por uso; consulte as condições na página da xAI.",
    steps: "Entre no console da xAI, crie uma chave de API e copie."
  }
];

const TRANSPARENCY: Array<{ what: string; cost: string; data: string }> = [
  {
    what: "O próprio Ouve (captura, métricas, marcadores, edição, exportação)",
    cost: "Gratuito, sem mensalidade",
    data: "Fica no seu computador"
  },
  { what: "IA local (Ollama, whisper.cpp)", cost: "Gratuito; usa o seu computador", data: "Fica no seu computador" },
  {
    what: "Provedor externo com cota gratuita (ex.: Gemini)",
    cost: "Gratuito dentro dos limites do provedor; pode mudar",
    data: "Sai do computador e vai ao provedor; planos gratuitos podem usar dados para melhorar serviços — confira a política"
  },
  {
    what: "Provedor externo pago (OpenAI, Claude, Grok)",
    cost: "Cobrança do provedor, na sua conta",
    data: "Sai do computador e vai ao provedor"
  }
];

export function HelpScreen() {
  const { navigate } = useApp();
  return (
    <Page title="Ajuda" subtitle="Como usar o Ouve, o que é gratuito e quando seus dados saem do computador">
      <section className="panel">
        <h2>Como usar em 4 passos</h2>
        <ol className="help-steps">
          <li>
            <b>Escolha uma IA</b> — em{" "}
            <button className="link" onClick={() => navigate("providers")}>
              Provedores de IA
            </button>
            , cole uma chave (o jeito mais rápido) ou use uma IA no seu computador. Você pode fazer isso depois.
          </li>
          <li>
            <b>Comece</b> —{" "}
            <button className="link" onClick={() => navigate("new")}>
              Nova sessão
            </button>{" "}
            para acompanhar ao vivo (microfone, tela, janela ou aba) ou{" "}
            <button className="link" onClick={() => navigate("import")}>
              Importar arquivo
            </button>{" "}
            para uma gravação de áudio ou vídeo.
          </li>
          <li>
            <b>Acompanhe e marque</b> — a transcrição aparece em blocos. Use os botões “Marcar” (ou Alt+1 a Alt+6) para registrar momentos:{" "}
            {MARKER_KINDS.map((m) => m.label.toLowerCase()).join(", ")}.
          </li>
          <li>
            <b>Revise e exporte</b> — renomeie os participantes, corrija trechos, gere a análise e exporte em PDF, DOCX, TXT, Markdown ou
            CSV.
          </li>
        </ol>
      </section>

      <section className="panel">
        <h2>O que é gratuito e para onde vão os dados</h2>
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Custo</th>
              <th>Seus dados</th>
            </tr>
          </thead>
          <tbody>
            {TRANSPARENCY.map((t) => (
              <tr key={t.what}>
                <td>{t.what}</td>
                <td>{t.cost}</td>
                <td>{t.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small-text">
          <Icon name="shield" size={13} /> O Ouve não tem servidor próprio, não cria conta e não guarda histórico. Áudio e transcrição ficam
          só na memória até você descartar a sessão ou fechar o programa. O processamento externo não oferece a mesma privacidade do
          processamento local.
        </p>
      </section>

      <section className="panel">
        <h2>Onde conseguir uma chave de IA</h2>
        <p className="muted">
          Uma <b>chave de API</b> é como uma senha que permite ao Ouve usar a inteligência artificial de uma empresa em seu nome. Ela é sua:
          o uso (e qualquer cobrança) fica na sua conta do provedor. No aplicativo desktop, a chave é guardada com a criptografia do
          Windows.
        </p>
        <ul className="key-pages">
          {KEY_PAGES.map((k) => (
            <li key={k.name}>
              <a href={k.url} target="_blank" rel="noreferrer">
                <b>{k.name}</b>
              </a>
              <span className="small-text">{k.steps}</span>
              <span className="small-text muted">{k.free}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Palavras que podem aparecer</h2>
        <dl className="kv glossary">
          <dt>Provedor</dt>
          <dd>A empresa ou programa que faz a inteligência artificial (Google, OpenAI, Ollama…).</dd>
          <dt>Modelo</dt>
          <dd>A “versão” da IA usada pelo provedor. O Ouve sugere um modelo adequado; você só troca se quiser.</dd>
          <dt>Endpoint</dt>
          <dd>O endereço de internet (ou do seu computador) onde a IA atende. Só é preciso informar em configurações avançadas.</dd>
          <dt>Transcrição</dt>
          <dd>Transformar o áudio em texto, com horário de cada fala.</dd>
          <dt>Separação de vozes (diarização)</dt>
          <dd>Distinguir quem falou cada trecho: Participante 1, 2… O Ouve não sabe quem é a pessoa; você dá os nomes.</dd>
          <dt>Cota</dt>
          <dd>Limite de uso gratuito ou contratado. Quando acaba, o provedor pede para esperar ou cobrar.</dd>
        </dl>
      </section>

      <section className="panel">
        <h2>Limitações conhecidas</h2>
        <ul className="plain-list">
          <li>
            No Windows, o áudio de uma janela específica não pode ser isolado: ao escolher uma janela, entra o som do sistema inteiro.
          </li>
          <li>No Firefox não é possível capturar o áudio de uma aba; use microfone ou importação.</li>
          <li>Métricas e horários dependem da qualidade da transcrição e da separação de vozes feita pela IA.</li>
          <li>A IA pode errar: revise o relatório antes de usá-lo. Itens marcados como “inferência” não foram ditos explicitamente.</li>
        </ul>
      </section>
    </Page>
  );
}
