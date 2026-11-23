import "./popup.css";
import { TERMS_VERSION } from "@ouve/ui/terms-version";
/**
 * Popup: inicia a captura de áudio da aba ativa via chrome.tabCapture (somente áudio).
 * O id do stream é gerado aqui (gesto do usuário) para consumo pela página do Ouve.
 */
const mic = document.querySelector<HTMLInputElement>("#mic");
const capture = document.querySelector<HTMLButtonElement>("#capture");
const open = document.querySelector<HTMLButtonElement>("#open");
const status = document.querySelector<HTMLElement>("#status");
const tabSection = document.querySelector<HTMLElement>("#tab-section");

const appUrl = chrome.runtime.getURL("app.html");
const supportsTabCapture = typeof chrome.tabCapture?.getMediaStreamId === "function";

if (!supportsTabCapture && tabSection) {
  tabSection.innerHTML =
    "<p>Este navegador não permite capturar o áudio de abas. Abra o Ouve para usar o microfone ou importar um arquivo.</p>";
}

// O termo de uso é aceito uma única vez, no primeiro uso da página do Ouve (D-063).
void chrome.storage.local.get("settings").then(({ settings }) => {
  const accepted = ((settings as { termsAcceptedVersion?: number } | undefined)?.termsAcceptedVersion ?? 0) >= TERMS_VERSION;
  if (!accepted && capture) {
    capture.disabled = true;
    if (status) status.textContent = "Abra o Ouve uma vez para aceitar os termos de uso antes de capturar.";
  }
});

open?.addEventListener("click", () => {
  void chrome.tabs.create({ url: appUrl });
  window.close();
});

capture?.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith(appUrl)) throw new Error("Abra a aba que deseja capturar e tente novamente.");
    // Cria a página do Ouve em segundo plano para que o popup não feche antes de obter o stream.
    const appTab = await chrome.tabs.create({ url: appUrl, active: false });
    const streamId = await new Promise<string>((resolve, reject) =>
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id!, consumerTabId: appTab.id! }, (id) => {
        const error = chrome.runtime.lastError;
        if (error || !id) reject(new Error(error?.message ?? "O navegador recusou a captura desta aba."));
        else resolve(id);
      })
    );
    await chrome.storage.session.set({
      pendingTab: { streamId, label: tab.title || "Aba do navegador", includeMic: !!mic?.checked, at: Date.now() }
    });
    await chrome.tabs.update(appTab.id!, { active: true });
    window.close();
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : "Não foi possível capturar esta aba.";
  }
});

export {};
