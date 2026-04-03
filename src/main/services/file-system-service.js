const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { SUPPORTED_EXTENSIONS } = require("./constants");

class FileSystemService {
  constructor() {
    this.watchers = new Map();
    this.triggerMap = new Map();
  }

  isSupportedImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath);
    return (
      SUPPORTED_EXTENSIONS.has(ext) &&
      !base.startsWith(".") &&
      !base.endsWith(".tmp") &&
      !base.endsWith(".part")
    );
  }

  validateDirectory(directoryPath) {
    if (!directoryPath || !fs.existsSync(directoryPath)) {
      throw new Error("目录不存在");
    }
    const stat = fs.statSync(directoryPath);
    if (!stat.isDirectory()) {
      throw new Error("所选路径不是目录");
    }
  }

  async scanDirectory(directoryPath, includeSubdirectories = false, onProgress = () => {}) {
    this.validateDirectory(directoryPath);
    const files = [];
    const stack = [directoryPath];

    while (stack.length > 0) {
      const current = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (error) {
        throw new Error(`目录读取失败: ${error.message}`);
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (includeSubdirectories) {
            stack.push(fullPath);
          }
        } else if (entry.isFile() && this.isSupportedImage(fullPath)) {
          files.push(fullPath);
          onProgress({ scannedCount: files.length, currentFile: fullPath });
        }
      }
    }

    return files;
  }

  async waitForStableFile(filePath, stableChecks, retryDelayMs) {
    let lastSize = -1;
    let stableCount = 0;

    while (stableCount < stableChecks) {
      if (!fs.existsSync(filePath)) return false;
      const stat = fs.statSync(filePath);
      if (stat.size === lastSize && stat.size > 0) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastSize = stat.size;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    return true;
  }

  watchDirectory(directoryPath, options, onFileReady, onError) {
    this.stopWatching(directoryPath);

    const watcher = chokidar.watch(directoryPath, {
      ignoreInitial: true,
      depth: options.includeSubdirectories ? undefined : 0,
      awaitWriteFinish: {
        stabilityThreshold: Math.max(options.watcherDebounceMs, 800),
        pollInterval: 250
      }
    });

    watcher.on("add", async (filePath) => {
      if (!this.isSupportedImage(filePath)) return;

      const key = `${filePath}:${Math.floor(Date.now() / options.watcherDebounceMs)}`;
      if (this.triggerMap.has(key)) return;
      this.triggerMap.set(key, true);

      for (let i = 0; i < options.watcherRetryCount; i += 1) {
        try {
          const stable = await this.waitForStableFile(
            filePath,
            options.watcherStableChecks,
            options.watcherRetryDelayMs
          );
          if (!stable) continue;

          await onFileReady(filePath);
          return;
        } catch (error) {
          if (i === options.watcherRetryCount - 1) {
            onError(new Error(`监听文件处理失败: ${filePath}, ${error.message}`));
          }
          await new Promise((resolve) => setTimeout(resolve, options.watcherRetryDelayMs));
        }
      }
    });

    watcher.on("error", (error) => onError(new Error(`监听路径失效: ${error.message}`)));
    this.watchers.set(directoryPath, watcher);
  }

  stopWatching(directoryPath) {
    const watcher = this.watchers.get(directoryPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(directoryPath);
    }
  }
}

module.exports = new FileSystemService();
