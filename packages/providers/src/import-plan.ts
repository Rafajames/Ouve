import type { ProviderConfig } from "@ouve/core";

/**
 * Plano de importação rápida (D-068): tamanho dos pedaços, formato e paralelismo
 * escolhidos pela IA configurada. Pedaços maiores = menos pedidos (bom para
 * planos gratuitos, que limitam pedidos por minuto); MP3 mantém cada pedido
 * abaixo dos limites de tamanho (Gemini ~20 MB inline, OpenAI 25 MB).
 */
export interface ImportPlan {
  segmentSeconds: number;
  format: "mp3" | "wav";
  concurrency: number;
  reason: string;
}

export function planImport(config: ProviderConfig | undefined): ImportPlan {
  const model = (config?.transcriptionModel || config?.model || "").toLowerCase();
  switch (config?.protocol) {
    case "gemini":
      return model.includes("transcribe")
        ? { segmentSeconds: 600, format: "mp3", concurrency: 3, reason: "Gemini Transcribe aceita pedaços longos com tempo por palavra." }
        : { segmentSeconds: 300, format: "mp3", concurrency: 3, reason: "Gemini generativo: pedaços de 5 minutos." };
    case "openai":
      // Só modelos que devolvem tempo por trecho aproveitam pedaços longos sem perder a marcação de tempo.
      return model.includes("diarize") || model.startsWith("whisper")
        ? { segmentSeconds: 600, format: "mp3", concurrency: 4, reason: "OpenAI com tempo por trecho: pedaços de 10 minutos." }
        : {
            segmentSeconds: 120,
            format: "mp3",
            concurrency: 4,
            reason: "Modelo sem tempo por trecho: pedaços curtos preservam a marcação de tempo."
          };
    default:
      // Servidores compatíveis/personalizados: formato e tamanho mais seguros.
      return { segmentSeconds: 120, format: "wav", concurrency: 2, reason: "Provedor genérico: WAV em pedaços de 2 minutos." };
  }
}
