const state = {
  currentDirectory: "",
  isWatching: false,
  lastDetection: null,
  settings: {}
};

const el = {
  globalStatus: document.getElementById("globalStatus"),
  currentDirectory: document.getElementById("currentDirectory"),
  indexedCount: document.getElementById("indexedCount"),
  lastIndexedAt: document.getElementById("lastIndexedAt"),
  watchStatus: document.getElementById("watchStatus"),
  scanProgress: document.getElementById("scanProgress"),
  indexProgress: document.getElementById("indexProgress"),
  pickDirectoryBtn: document.getElementById("pickDirectoryBtn"),
  reindexBtn: document.getElementById("reindexBtn"),
  toggleWatchBtn: document.getElementById("toggleWatchBtn"),
  uploadInput: document.getElementById("uploadInput"),
  dropZone: document.getElementById("dropZone"),
  detectError: document.getElementById("detectError"),
  resultContainer: document.getElementById("resultContainer"),
  historyList: document.getElementById("historyList"),
  refreshHistoryBtn: document.getElementById("refreshHistoryBtn"),
  filterDirectory: document.getElementById("filterDirectory"),
  filterLevel: document.getElementById("filterLevel"),
  filterAction: document.getElementById("filterAction"),
  exactThreshold: document.getElementById("exactThreshold"),
  highThreshold: document.getElementById("highThreshold"),
  mediumThreshold: document.getElementById("mediumThreshold"),
  topN: document.getElementById("topN"),
  pendingDirectory: document.getElementById("pendingDirectory"),
  logPath: document.getElementById("logPath"),
  enableWatch: document.getElementById("enableWatch"),
  includeSubdirectories: document.getElementById("includeSubdirectories"),
  autoLoadLastDirectory: document.getElementById("autoLoadLastDirectory"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn")
};

function formatTime(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function setStatus(msg) {
  el.globalStatus.textContent = msg;
}

function updateDirectoryUI() {
  el.currentDirectory.textContent = state.currentDirectory || "未选择";
  el.watchStatus.textContent = state.isWatching ? "监听中" : "未启动";
  el.toggleWatchBtn.textContent = state.isWatching ? "停止监听" : "启动监听";
}

async function refreshSummary() {
  if (!state.currentDirectory) return;
  const summary = await window.api.getDirectorySummary(state.currentDirectory);
  el.indexedCount.textContent = summary.imageCount || 0;
  el.lastIndexedAt.textContent = formatTime(summary.lastIndexedAt);
}

function renderSettings(settings) {
  el.exactThreshold.value = settings.exactDuplicateThreshold;
  el.highThreshold.value = settings.highSimilarityThreshold;
  el.mediumThreshold.value = settings.mediumSimilarityThreshold;
  el.topN.value = settings.topNMatches;
  el.pendingDirectory.value = settings.pendingReviewDirectory || "";
  el.logPath.value = settings.logPath || "";
  el.enableWatch.checked = !!settings.enableDirectoryWatch;
  el.includeSubdirectories.checked = !!settings.includeSubdirectories;
  el.autoLoadLastDirectory.checked = !!settings.autoLoadLastDirectory;
}

function levelName(level) {
  if (level === "EXACT_DUPLICATE") return "完全重复";
  if (level === "HIGH_SIMILARITY") return "高度相似";
  if (level === "MEDIUM_SIMILARITY") return "中度相似";
  return "无明显重复";
}

function actionName(action) {
  const map = {
    KEEP_NEW: "保留新图",
    SKIP_SAVE: "跳过保存",
    REPLACE_OLD: "替换旧图",
    MOVE_TO_PENDING: "移动到待确认目录",
    IGNORE_ONCE: "忽略本次"
  };
  return map[action] || action;
}

function renderDetection(result) {
  state.lastDetection = result;
  const matchHtml = (result.matches || [])
    .map(
      (m, idx) => `<div class="match-item">
      <div>#${idx + 1} ${m.matchFilePath}</div>
      <div>相似度: ${m.score.toFixed(2)}% | 判定: ${levelName(m.level)} | 类型: ${m.matchReason}</div>
    </div>`
    )
    .join("");

  el.resultContainer.innerHTML = `<div class="result-card">
    <h3>检测结果：${levelName(result.finalLevel)}</h3>
    <p>新图：${result.newImage.path}</p>
    <p>分辨率：${result.newImage.width}x${result.newImage.height}，大小：${result.newImage.fileSize} bytes</p>
    <p>最高相似度：${result.topSimilarityScore.toFixed(2)}%</p>
    <p>推荐动作：${actionName(result.recommendedAction)}</p>
    <div>${matchHtml || "未命中候选"}</div>
    <div class="actions">
      <button data-action="KEEP_NEW">保留新图</button>
      <button data-action="SKIP_SAVE">跳过保存</button>
      <button data-action="REPLACE_OLD">替换旧图</button>
      <button data-action="MOVE_TO_PENDING">移动到待确认</button>
      <button data-action="IGNORE_ONCE">忽略本次</button>
      <button data-open-new="1">打开新图所在目录</button>
    </div>
  </div>`;

  el.resultContainer.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const topMatch = result.matches && result.matches[0] ? result.matches[0].matchFilePath : null;
      const actionResult = await window.api.applyDecision({
        recordId: result.recordId,
        action,
        newImagePath: result.newImage.path,
        topMatchPath: topMatch
      });
      setStatus(actionResult.message || "操作完成");
      await refreshSummary();
      await loadHistory();
    });
  });

  const openBtn = el.resultContainer.querySelector("button[data-open-new]");
  openBtn.addEventListener("click", () => window.api.openPath(result.newImage.path));
}

async function loadHistory() {
  const filters = {
    detectionDirectory: el.filterDirectory.value || undefined,
    finalLevel: el.filterLevel.value || undefined,
    userAction: el.filterAction.value || undefined
  };
  const rows = await window.api.queryHistory(filters);
  el.historyList.innerHTML = rows
    .map(
      (row) => `<div class="history-card">
      <p><strong>${formatTime(row.detected_at)}</strong> [${row.trigger_type}] ${levelName(row.final_level)}</p>
      <p>新图：${row.new_image_path}</p>
      <p>目录：${row.detection_directory}</p>
      <p>命中数：${row.hit_count}，最高相似度：${row.top_similarity_score}%</p>
      <p>推荐动作：${actionName(row.recommended_action)}，用户动作：${actionName(row.user_action || "-")}</p>
      <p>错误：${row.error_message || "-"}</p>
      ${(row.matches || [])
        .map(
          (m) => `<div class="match-item">${m.rank_index}. ${m.match_file_path} | ${m.score.toFixed(
            2
          )}% | ${levelName(m.level)}</div>`
        )
        .join("")}
    </div>`
    )
    .join("");
}

function initNavigation() {
  const buttons = document.querySelectorAll(".sidebar nav button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    });
  });
}

function bindEvents() {
  el.pickDirectoryBtn.addEventListener("click", async () => {
    const result = await window.api.pickDirectory();
    if (result.canceled) return;
    state.currentDirectory = result.directoryPath;
    updateDirectoryUI();
    setStatus("已选择目录，开始构建索引...");
    const indexResult = await window.api.buildIndex(state.currentDirectory);
    if (!indexResult.ok) {
      setStatus(`索引失败: ${indexResult.error}`);
      return;
    }
    setStatus(`索引完成，新增 ${indexResult.indexedCount} 张，跳过 ${indexResult.skippedCount} 张`);
    await refreshSummary();
  });

  el.reindexBtn.addEventListener("click", async () => {
    if (!state.currentDirectory) return;
    const result = await window.api.buildIndex(state.currentDirectory);
    setStatus(result.ok ? "重建索引完成" : `重建失败: ${result.error}`);
    await refreshSummary();
  });

  el.toggleWatchBtn.addEventListener("click", async () => {
    if (!state.currentDirectory) {
      setStatus("请先选择目录");
      return;
    }
    if (!state.isWatching) {
      await window.api.startWatch(state.currentDirectory);
      state.isWatching = true;
    } else {
      await window.api.stopWatch(state.currentDirectory);
      state.isWatching = false;
    }
    updateDirectoryUI();
  });

  el.uploadInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const result = await window.api.detectFile({ imagePath: file.path, triggerType: "MANUAL_UPLOAD" });
    if (!result.ok) {
      el.detectError.textContent = result.error;
    }
  });

  ["dragenter", "dragover"].forEach((name) => {
    el.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      el.dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    el.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      el.dropZone.classList.remove("dragover");
    });
  });

  el.dropZone.addEventListener("drop", async (event) => {
    const files = Array.from(event.dataTransfer.files || []).map((f) => f.path);
    if (!files.length) return;
    await window.api.detectFiles({ imagePaths: files, triggerType: "DRAG_DROP" });
  });

  el.refreshHistoryBtn.addEventListener("click", loadHistory);

  el.saveSettingsBtn.addEventListener("click", async () => {
    state.settings = await window.api.updateSettings({
      exactDuplicateThreshold: Number(el.exactThreshold.value),
      highSimilarityThreshold: Number(el.highThreshold.value),
      mediumSimilarityThreshold: Number(el.mediumThreshold.value),
      topNMatches: Number(el.topN.value),
      pendingReviewDirectory: el.pendingDirectory.value,
      logPath: el.logPath.value,
      enableDirectoryWatch: el.enableWatch.checked,
      includeSubdirectories: el.includeSubdirectories.checked,
      autoLoadLastDirectory: el.autoLoadLastDirectory.checked
    });
    setStatus("设置已保存");
    renderSettings(state.settings);
  });
}

function subscribeBackendEvents() {
  window.api.onScanProgress((p) => {
    el.scanProgress.textContent = `已扫描: ${p.scannedCount}, 当前: ${p.currentFile}`;
  });
  window.api.onIndexProgress((p) => {
    el.indexProgress.textContent = `已索引: ${p.indexedCount}, 跳过: ${p.skippedCount}, 当前: ${p.currentFile}`;
  });
  window.api.onDetectionResult(async (result) => {
    el.detectError.textContent = "";
    renderDetection(result);
    await loadHistory();
    setStatus(`检测完成：${levelName(result.finalLevel)} (${result.topSimilarityScore.toFixed(2)}%)`);
  });
  window.api.onDetectionError((payload) => {
    el.detectError.textContent = payload.error;
    setStatus(`检测失败: ${payload.error}`);
  });
  window.api.onWatchError((payload) => {
    setStatus(`监听异常: ${payload.error}`);
  });
  window.api.onAutoLoadedDirectory(async (payload) => {
    state.currentDirectory = payload.directoryPath;
    updateDirectoryUI();
    await refreshSummary();
    setStatus("已自动加载上次目录");
  });
}

async function bootstrap() {
  initNavigation();
  bindEvents();
  subscribeBackendEvents();
  state.settings = await window.api.getSettings();
  renderSettings(state.settings);

  if (state.settings.autoLoadLastDirectory && state.settings.lastDirectoryPath) {
    state.currentDirectory = state.settings.lastDirectoryPath;
    updateDirectoryUI();
    await refreshSummary();
  }

  await loadHistory();
}

bootstrap();
