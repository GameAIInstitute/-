const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);

const DEFAULT_SETTINGS = {
  exactDuplicateThreshold: 100,
  highSimilarityThreshold: 95,
  mediumSimilarityThreshold: 85,
  enableDirectoryWatch: true,
  includeSubdirectories: false,
  pendingReviewDirectory: "",
  logPath: "",
  indexCacheEnabled: true,
  autoLoadLastDirectory: true,
  topNMatches: 3,
  watcherDebounceMs: 1200,
  watcherStableChecks: 3,
  watcherRetryCount: 3,
  watcherRetryDelayMs: 800
};

const DETECTION_LEVEL = {
  EXACT_DUPLICATE: "EXACT_DUPLICATE",
  HIGH_SIMILARITY: "HIGH_SIMILARITY",
  MEDIUM_SIMILARITY: "MEDIUM_SIMILARITY",
  NOT_SIMILAR: "NOT_SIMILAR"
};

const RECOMMENDED_ACTION = {
  KEEP_NEW: "KEEP_NEW",
  SKIP_SAVE: "SKIP_SAVE",
  REPLACE_OLD: "REPLACE_OLD",
  MOVE_TO_PENDING: "MOVE_TO_PENDING",
  IGNORE_ONCE: "IGNORE_ONCE"
};

module.exports = {
  SUPPORTED_EXTENSIONS,
  DEFAULT_SETTINGS,
  DETECTION_LEVEL,
  RECOMMENDED_ACTION
};
