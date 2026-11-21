import { Page } from "../components";
import { Icon } from "@ouve/ui";
import { useApp, useSession, type AppData } from "../hooks";

export function HomeScreen({ data }: { data: AppData }) {
  const { navigate } = useApp();
  const session = useSession();
  const providerName = (id?: string) => data.providers.find((p) => p.config.id === id)?.config.displayName;
  const transcription = providerName(data.settings?.transcriptionProviderId);
  const analysis = providerName(data.settings?.analysisProviderId);
  const ready = !!transcription;

  return (
    <Page
      title="Transforme conversas em informação"
      subtitle="Transcreva e organize reuniões, audiências, entrevistas e aulas. O Ouve usa somente o áudio — nunca grava a tela."
    >
      {!ready && (
        <div className="callout">
          <strong>Primeiro passo:</strong> configure um provedor de IA com sua própria chave de API.
          <button className="primary small" onClick={() => navigate("providers")}>
            Configurar provedor
          </button>
        </div>
      )}

      <div className="cards">
        <button className="card action" onClick={() => navigate("new")}>
          <span className="card-icon">
            <Icon name="record" size={22} />
          </span>
          <strong>Nova sessão ao vivo</strong>
          <span className="muted">Escolha uma tela ou janela como fonte de áudio, com microfone opcional.</span>
        </button>
        <button className="card action" onClick={() => navigate("import")}>
          <span className="card-icon">
            <Icon name="upload" size={22} />
          </span>
          <strong>Importar gravação</strong>
          <span className="muted">MP3, WAV, M4A, AAC, OGG, FLAC, MP4, MOV, MKV ou WebM (somente o áudio é usado).</span>
        </button>
      </div>

      {session.mode !== "none" && (
        <div className="panel">
          <h2>Sessão atual</h2>
          <p>
            {session.title} — {session.stats.done} blocos transcritos{session.report ? " · relatório gerado" : ""}
          </p>
          <div className="row">
            <button onClick={() => navigate("session")}>Abrir sessão</button>
            {session.report && <button onClick={() => navigate("report")}>Abrir relatório</button>}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <h2>
            <Icon name="providers" /> Provedores
          </h2>
          <dl className="kv">
            <dt>Transcrição</dt>
            <dd>{transcription ?? "não configurado"}</dd>
            <dt>Análise</dt>
            <dd>{analysis ?? "não configurado"}</dd>
            <dt>Proteção das chaves</dt>
            <dd>
              {data.protection === "os-encrypted"
                ? "criptografia do sistema operacional"
                : data.protection === "memory-only"
                  ? "somente memória (sem criptografia do SO)"
                  : "—"}
            </dd>
          </dl>
        </div>
        <div className="panel">
          <h2>
            <Icon name="shield" /> Privacidade
          </h2>
          <ul className="plain">
            <li>Sem conta, sem servidor do Ouve e sem histórico permanente.</li>
            <li>O áudio é enviado somente ao provedor de IA que você configurou.</li>
            <li>Ao descartar a sessão ou fechar o app, áudio e transcrição são apagados da memória e dos temporários.</li>
            <li>Você decide se e onde salvar o relatório.</li>
          </ul>
        </div>
      </div>
    </Page>
  );
}
