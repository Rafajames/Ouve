import { useState } from "react";
import { Icon } from "@ouve/ui";
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from "@ouve/core";
import { Page } from "../components";
import { errorMessage, useApp, useSession, type AppData } from "../hooks";

export function ImportScreen({ data }: { data: AppData }) {
  const { controller, navigate, notify } = useApp();
  const session = useSession();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const providerName = data.providers.find((p) => p.config.id === data.settings?.transcriptionProviderId)?.config.displayName;
  const capturing = session.mode === "live" && (session.status === "capturing" || session.status === "paused");

  const choose = async () => {
    if (
      controller.hasContent &&
      !window.confirm("Importar um arquivo descarta a sessão atual (transcrição e relatório não exportados). Continuar?")
    )
      return;
    setBusy(true);
    try {
      await controller.discard();
      const promise = controller.startImport();
      // Navega assim que o arquivo for aceito; o processamento segue em segundo plano.
      const unsubscribe = controller.subscribe(() => {
        if (controller.getSnapshot().mode === "import") {
          unsubscribe();
          navigate("session");
        }
      });
      const opened = await promise;
      unsubscribe();
      if (!opened) setBusy(false);
    } catch (error) {
      notify(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <Page
      title="Importar gravação"
      subtitle="Analise gravações anteriores. Em arquivos de vídeo, somente a faixa de áudio é extraída; nenhuma imagem é processada."
    >
      <div className="panel">
        <h2>Formatos aceitos</h2>
        <p>
          <strong>Áudio:</strong> {AUDIO_EXTENSIONS.join(", ").toUpperCase()}
          <br />
          <strong>Vídeo (como contêiner de áudio):</strong> {VIDEO_EXTENSIONS.join(", ").toUpperCase()}
        </p>
        <p className="muted">
          Limites configurados: até {data.settings?.maxFileGb ?? 2} GB e {data.settings?.maxHours ?? 4} h (ajustáveis em Configurações;
          valores de referência ainda não validados com arquivos reais). O áudio é convertido em segmentos temporários de{" "}
          {data.settings?.importSegmentSeconds ?? 120} s, apagados ao final.
        </p>
      </div>
      <div className="panel">
        {!providerName && (
          <p className="warn-text">
            Nenhum provedor de transcrição selecionado. <button onClick={() => navigate("providers")}>Configurar</button>
          </p>
        )}
        <label className="check consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Confirmo que tenho autorização para transcrever esta gravação e que o áudio será enviado para{" "}
            <strong>{providerName ?? "o provedor configurado"}</strong>.
          </span>
        </label>
        <button className="primary large" disabled={!consent || !providerName || busy || capturing} onClick={() => void choose()}>
          <Icon name="upload" /> {busy ? "Abrindo…" : "Escolher arquivo"}
        </button>
        {capturing && <p className="muted">Encerre a captura ao vivo antes de importar.</p>}
      </div>
    </Page>
  );
}
