import React from "react";
import ReactDOM from "react-dom/client";
import { App, type PendingTab } from "./App";
import "./app.css";

async function readPending(): Promise<PendingTab | undefined> {
  const area = chrome.storage?.session;
  if (!area) return undefined;
  const { pendingTab } = (await area.get("pendingTab")) as { pendingTab?: PendingTab };
  await area.remove("pendingTab");
  // O id de stream do tabCapture expira rapidamente; ignora pendências antigas.
  return pendingTab && Date.now() - pendingTab.at < 15_000 ? pendingTab : undefined;
}

void readPending().then((pending) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App {...(pending ? { pending } : {})} />
    </React.StrictMode>
  );
});
