const fs = require("fs");
const path = require("path");
const { DETECTION_LEVEL, RECOMMENDED_ACTION } = require("./constants");

class DecisionService {
  recommendAction(level, settings) {
    switch (level) {
      case DETECTION_LEVEL.EXACT_DUPLICATE:
        return RECOMMENDED_ACTION.SKIP_SAVE;
      case DETECTION_LEVEL.HIGH_SIMILARITY:
        return settings.pendingReviewDirectory
          ? RECOMMENDED_ACTION.MOVE_TO_PENDING
          : RECOMMENDED_ACTION.IGNORE_ONCE;
      case DETECTION_LEVEL.MEDIUM_SIMILARITY:
        return RECOMMENDED_ACTION.IGNORE_ONCE;
      default:
        return RECOMMENDED_ACTION.KEEP_NEW;
    }
  }

  applyUserAction(action, context) {
    const { newImagePath, topMatchPath, pendingReviewDirectory } = context;

    switch (action) {
      case RECOMMENDED_ACTION.REPLACE_OLD:
        if (!topMatchPath) return { success: false, message: "没有可替换的旧图" };
        fs.copyFileSync(newImagePath, topMatchPath);
        return { success: true, message: "已替换旧图" };
      case RECOMMENDED_ACTION.MOVE_TO_PENDING:
        if (!pendingReviewDirectory) {
          return { success: false, message: "未配置待确认目录" };
        }
        fs.mkdirSync(pendingReviewDirectory, { recursive: true });
        const destination = path.join(pendingReviewDirectory, path.basename(newImagePath));
        fs.copyFileSync(newImagePath, destination);
        return { success: true, message: `已移动到待确认目录: ${destination}` };
      case RECOMMENDED_ACTION.SKIP_SAVE:
      case RECOMMENDED_ACTION.IGNORE_ONCE:
      case RECOMMENDED_ACTION.KEEP_NEW:
      default:
        return { success: true, message: "操作已记录" };
    }
  }
}

module.exports = new DecisionService();
