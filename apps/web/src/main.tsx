import React from "react";
import ReactDOM from "react-dom/client";
import { createWebBridge } from "./web-bridge";
import App from "../../desktop/src/renderer/src/App";
import "../../desktop/src/renderer/src/styles.css";

/** Abre o seletor de arquivos do navegador; resolve null se o usuário cancelar. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.mkv,.webm";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

function download(fileName: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

window.ouve = createWebBridge({
  storage: window.localStorage,
  fetch: (input, init) => window.fetch(input, init),
  pickFile,
  download,
  setTitle: (title) => (document.title = title)
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
