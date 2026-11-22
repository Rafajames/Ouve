import { contextBridge, ipcRenderer } from "electron";
import { IPC, type OuveBridge } from "../shared/ipc";

/** API mínima e tipada; nenhum acesso genérico a IPC, filesystem ou segredos. */
const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const bridge: OuveBridge = {
  platform: process.platform,
  version: "0.2.0",
  e2e: process.env.OUVE_E2E === "1",
  capture: {
    listSources: () => invoke(IPC.listSources),
    selectSource: (id) => invoke(IPC.selectSource, id),
    setActive: (active) => invoke(IPC.setCaptureActive, active)
  },
  settings: {
    get: () => invoke(IPC.getSettings),
    save: (settings) => invoke(IPC.saveSettings, settings)
  },
  providers: {
    list: () => invoke(IPC.listProviders),
    save: (input) => invoke(IPC.saveProvider, input),
    remove: (id) => invoke(IPC.removeProvider, id),
    test: (id) => invoke(IPC.testProvider, id),
    protection: () => invoke(IPC.secretProtection),
    quickSetup: (apiKey) => invoke(IPC.quickSetup, apiKey)
  },
  ai: {
    transcribe: (input) => invoke(IPC.transcribe, input),
    complete: (input) => invoke(IPC.complete, input),
    cancel: (id) => invoke(IPC.cancel, id)
  },
  media: {
    open: () => invoke(IPC.openMedia),
    extract: (token, seconds, format) => invoke(IPC.extractMedia, token, seconds, format),
    readSegment: (token, index) => invoke(IPC.readSegment, token, index),
    release: (token) => invoke(IPC.releaseMedia, token),
    onProgress: (listener) => {
      const wrapped = (_: unknown, token: string, ms: number) => listener(token, ms);
      ipcRenderer.on(IPC.mediaProgress, wrapped);
      return () => ipcRenderer.removeListener(IPC.mediaProgress, wrapped);
    }
  },
  files: {
    save: (name, bytes) => invoke(IPC.saveFile, name, bytes)
  },
  local: {
    probe: () => invoke(IPC.probeLocal),
    pullModel: (model) => invoke(IPC.pullLocalModel, model)
  },
  updates: {
    check: () => invoke(IPC.checkUpdates),
    install: () => invoke(IPC.installUpdate),
    onProgress: (listener) => {
      const wrapped = (_: unknown, percent: number) => listener(percent);
      ipcRenderer.on(IPC.updateProgress, wrapped);
      return () => ipcRenderer.removeListener(IPC.updateProgress, wrapped);
    }
  }
};

contextBridge.exposeInMainWorld("ouve", bridge);
