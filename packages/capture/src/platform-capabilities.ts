/**
 * Matriz de capacidades declaradas por plataforma. Baseada na documentação das
 * APIs (Electron desktopCapturer/setDisplayMediaRequestHandler, Chrome tabCapture,
 * getDisplayMedia). NADA aqui foi validado em hardware real — ver docs/06.
 */
export type CapturePlatform = "electron-windows" | "electron-other" | "chrome-extension" | "firefox-extension";

export type CaptureFeature =
  "screen-selection" | "window-selection" | "tab-selection" | "source-audio" | "system-audio" | "microphone" | "mix";

export interface FeatureSupport {
  supported: boolean;
  note: string;
}

export type CapabilityMatrix = Record<CaptureFeature, FeatureSupport>;

const yes = (note: string): FeatureSupport => ({ supported: true, note });
const no = (note: string): FeatureSupport => ({ supported: false, note });

export const PLATFORM_CAPABILITIES: Record<CapturePlatform, CapabilityMatrix> = {
  "electron-windows": {
    "screen-selection": yes("Seletor próprio do Ouve lista monitores (sem miniaturas)."),
    "window-selection": yes("Seletor próprio lista janelas abertas (sem miniaturas)."),
    "tab-selection": no("Abas são capturadas pela extensão do navegador."),
    "source-audio": yes(
      "No Windows o Electron fornece áudio por loopback do SISTEMA inteiro, não isolado da janela escolhida. Áudio por processo exige módulo nativo (pendente)."
    ),
    "system-audio": yes("Loopback do sistema via Electron (audio: 'loopback')."),
    microphone: yes("Microfone opcional por getUserMedia."),
    mix: yes("Fonte + microfone mixados no Web Audio com volumes independentes.")
  },
  "electron-other": {
    "screen-selection": yes("Seletor próprio lista monitores."),
    "window-selection": yes("Seletor próprio lista janelas."),
    "tab-selection": no("Use a extensão do navegador."),
    "source-audio": no(
      "Loopback de áudio do sistema não é suportado pelo Electron fora do Windows (macOS requer APIs recentes; Linux não validado)."
    ),
    "system-audio": no("Não suportado nesta versão."),
    microphone: yes("Microfone opcional."),
    mix: yes("Mixagem no Web Audio.")
  },
  "chrome-extension": {
    "screen-selection": yes("Seletor nativo do Chrome (getDisplayMedia)."),
    "window-selection": yes("Seletor nativo do Chrome."),
    "tab-selection": yes("chrome.tabCapture fornece somente áudio da aba atual, sem trilha de vídeo."),
    "source-audio": yes("Aba: sim. Tela inteira: áudio do sistema só no Windows/ChromeOS. Janela: o Chrome não fornece áudio."),
    "system-audio": yes("Somente ao compartilhar tela inteira no Windows/ChromeOS, com a opção marcada pelo usuário."),
    microphone: yes("Requer permissão do usuário na página da extensão."),
    mix: yes("Mixagem no Web Audio.")
  },
  "firefox-extension": {
    "screen-selection": yes("Seletor nativo do Firefox."),
    "window-selection": yes("Seletor nativo do Firefox."),
    "tab-selection": no("Firefox não possui API equivalente a tabCapture."),
    "source-audio": no("getDisplayMedia do Firefox não fornece áudio da fonte compartilhada."),
    "system-audio": no("Não disponível no Firefox."),
    microphone: yes("Microfone por getUserMedia na página da extensão."),
    mix: no("Sem áudio de fonte, apenas microfone.")
  }
};

export function capabilitiesFor(platform: CapturePlatform): CapabilityMatrix {
  return PLATFORM_CAPABILITIES[platform];
}

export function detectPlatform(env: { isElectron: boolean; os?: string; userAgent?: string }): CapturePlatform {
  if (env.isElectron) return env.os === "win32" ? "electron-windows" : "electron-other";
  return env.userAgent?.includes("Firefox/") ? "firefox-extension" : "chrome-extension";
}
