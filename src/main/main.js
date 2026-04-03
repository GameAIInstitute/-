const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fileSystemService = require("./services/file-system-service");
const indexService = require("./services/index-service");
const detectionService = require("./services/detection-service");
const settingsService = require("./services/settings-service");
const historyService = require("./services/history-service");
const decisionService = require("./services/decision-service");

let mainWindow;
let currentDirectory = "";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function sendStatus(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function runIndexing(directoryPath) {
  const settings = settingsService.getAllSettings();
  const scanJobId = indexService.startScanJob(directoryPath);
  let files = [];

  try {
    files = await fileSystemService.scanDirectory(
      directoryPath,
      settings.includeSubdirectories,
      (progress) => sendStatus("scan:progress", progress)
    );

    const result = await indexService.buildIndex(directoryPath, files, (progress) =>
      sendStatus("index:progress", progress)
    );

    indexService.finishScanJob(scanJobId, {
      status: "SUCCESS",
      scannedCount: files.length,
      indexedCount: result.indexedCount,
      skippedCount: result.skippedCount,
      removedCount: result.removedCount
    });

    return {
      ok: true,
      filesCount: files.length,
      ...result,
      summary: indexService.getDirectorySummary(directoryPath)
    };
  } catch (error) {
    indexService.finishScanJob(scanJobId, {
      status: "FAILED",
      scannedCount: files.length,
      indexedCount: 0,
      skippedCount: 0,
      removedCount: 0,
      errorMessage: error.message
    });
    return { ok: false, error: error.message };
  }
}

async function detectAndNotify(imagePath, triggerType = "MANUAL_UPLOAD") {
  try {
    const settings = settingsService.getAllSettings();
    const result = await detectionService.detectNewImage({
      newImagePath: imagePath,
      detectionDirectory: currentDirectory,
      triggerType,
      settings
    });

    sendStatus("detection:result", result);
    return { ok: true, result };
  } catch (error) {
    const recordId = historyService.createDetectionRecord({
      triggerType,
      newImagePath: imagePath,
      detectionDirectory: currentDirectory,
      hitCount: 0,
      topSimilarityScore: 0,
      finalLevel: "NOT_SIMILAR",
      recommendedAction: "IGNORE_ONCE",
      ignored: true,
      errorMessage: error.message
    });

    const payload = { ok: false, recordId, error: error.message };
    sendStatus("detection:error", payload);
    return payload;
  }
}

function setupIpc() {
  ipcMain.handle("directory:pick", async () => {
    const selection = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (selection.canceled || selection.filePaths.length === 0) return { canceled: true };
    currentDirectory = selection.filePaths[0];
    settingsService.updateSettings({ lastDirectoryPath: currentDirectory });
    return { canceled: false, directoryPath: currentDirectory };
  });

  ipcMain.handle("index:build", async (_event, directoryPath) => {
    currentDirectory = directoryPath;
    return runIndexing(directoryPath);
  });

  ipcMain.handle("directory:summary", async (_event, directoryPath) => {
    return indexService.getDirectorySummary(directoryPath);
  });

  ipcMain.handle("settings:get", async () => settingsService.getAllSettings());

  ipcMain.handle("settings:update", async (_event, partialSettings) =>
    settingsService.updateSettings(partialSettings)
  );

  ipcMain.handle("detect:file", async (_event, { imagePath, triggerType }) => {
    if (!currentDirectory) {
      return { ok: false, error: "请先在首页选择并索引目录" };
    }
    return detectAndNotify(imagePath, triggerType || "MANUAL_UPLOAD");
  });

  ipcMain.handle("detect:files", async (_event, { imagePaths, triggerType }) => {
    const results = [];
    for (const filePath of imagePaths) {
      // eslint-disable-next-line no-await-in-loop
      const result = await detectAndNotify(filePath, triggerType || "DRAG_DROP");
      results.push(result);
    }
    return results;
  });

  ipcMain.handle("history:query", async (_event, filters) => historyService.queryHistory(filters));

  ipcMain.handle("decision:apply", async (_event, payload) => {
    const settings = settingsService.getAllSettings();
    const actionResult = decisionService.applyUserAction(payload.action, {
      newImagePath: payload.newImagePath,
      topMatchPath: payload.topMatchPath,
      pendingReviewDirectory: settings.pendingReviewDirectory
    });

    historyService.updateRecordAction(payload.recordId, payload.action, payload.action === "IGNORE_ONCE");

    if (payload.action === "KEEP_NEW" && fs.existsSync(payload.newImagePath)) {
      await indexService.indexSingleFile(payload.newImagePath);
    }

    if (payload.action === "REPLACE_OLD" && payload.topMatchPath) {
      await indexService.indexSingleFile(payload.topMatchPath);
    }

    return actionResult;
  });

  ipcMain.handle("fs:open-path", async (_event, targetPath) => {
    if (!targetPath) return { ok: false };
    await shell.showItemInFolder(targetPath);
    return { ok: true };
  });

  ipcMain.handle("watch:start", async (_event, directoryPath) => {
    const settings = settingsService.getAllSettings();
    currentDirectory = directoryPath;
    fileSystemService.watchDirectory(
      directoryPath,
      settings,
      async (filePath) => {
        await detectAndNotify(filePath, "WATCHER");
      },
      (error) => sendStatus("watch:error", { error: error.message })
    );
    return { ok: true };
  });

  ipcMain.handle("watch:stop", async (_event, directoryPath) => {
    fileSystemService.stopWatching(directoryPath);
    return { ok: true };
  });
}

app.whenReady().then(async () => {
  createWindow();
  setupIpc();

  const settings = settingsService.getAllSettings();
  if (settings.autoLoadLastDirectory && settings.lastDirectoryPath) {
    currentDirectory = settings.lastDirectoryPath;
    sendStatus("directory:auto-loaded", { directoryPath: currentDirectory });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
