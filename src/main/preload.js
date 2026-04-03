const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  pickDirectory: () => ipcRenderer.invoke("directory:pick"),
  buildIndex: (directoryPath) => ipcRenderer.invoke("index:build", directoryPath),
  getDirectorySummary: (directoryPath) => ipcRenderer.invoke("directory:summary", directoryPath),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => ipcRenderer.invoke("settings:update", settings),
  detectFile: (payload) => ipcRenderer.invoke("detect:file", payload),
  detectFiles: (payload) => ipcRenderer.invoke("detect:files", payload),
  queryHistory: (filters) => ipcRenderer.invoke("history:query", filters),
  applyDecision: (payload) => ipcRenderer.invoke("decision:apply", payload),
  openPath: (targetPath) => ipcRenderer.invoke("fs:open-path", targetPath),
  startWatch: (directoryPath) => ipcRenderer.invoke("watch:start", directoryPath),
  stopWatch: (directoryPath) => ipcRenderer.invoke("watch:stop", directoryPath),
  onScanProgress: (listener) => ipcRenderer.on("scan:progress", (_e, p) => listener(p)),
  onIndexProgress: (listener) => ipcRenderer.on("index:progress", (_e, p) => listener(p)),
  onDetectionResult: (listener) => ipcRenderer.on("detection:result", (_e, p) => listener(p)),
  onDetectionError: (listener) => ipcRenderer.on("detection:error", (_e, p) => listener(p)),
  onWatchError: (listener) => ipcRenderer.on("watch:error", (_e, p) => listener(p)),
  onAutoLoadedDirectory: (listener) =>
    ipcRenderer.on("directory:auto-loaded", (_e, p) => listener(p))
});
