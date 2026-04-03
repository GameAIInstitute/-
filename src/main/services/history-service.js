const dbManager = require("../db/database");

class HistoryService {
  constructor() {
    this.db = dbManager.db;
  }

  createDetectionRecord(payload) {
    const result = this.db
      .prepare(
        `INSERT INTO detection_records (
          detected_at, trigger_type, new_image_path, detection_directory,
          hit_count, top_similarity_score, final_level, recommended_action,
          user_action, ignored, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Date.now(),
        payload.triggerType,
        payload.newImagePath,
        payload.detectionDirectory,
        payload.hitCount,
        payload.topSimilarityScore,
        payload.finalLevel,
        payload.recommendedAction,
        payload.userAction || null,
        payload.ignored ? 1 : 0,
        payload.errorMessage || null
      );
    return result.lastInsertRowid;
  }

  saveMatches(recordId, matches) {
    const stmt = this.db.prepare(
      `INSERT INTO detection_matches (
        detection_record_id, image_id, match_file_path, score, level, match_reason, rank_index, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = this.db.transaction((list) => {
      list.forEach((m, index) => {
        stmt.run(
          recordId,
          m.imageId || null,
          m.matchFilePath,
          m.score,
          m.level,
          m.matchReason,
          index + 1,
          Date.now()
        );
      });
    });

    tx(matches);
  }

  updateRecordAction(recordId, action, ignored = false) {
    this.db
      .prepare("UPDATE detection_records SET user_action = ?, ignored = ? WHERE id = ?")
      .run(action, ignored ? 1 : 0, recordId);
  }

  queryHistory(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.detectionDirectory) {
      conditions.push("detection_directory = ?");
      params.push(filters.detectionDirectory);
    }
    if (filters.finalLevel) {
      conditions.push("final_level = ?");
      params.push(filters.finalLevel);
    }
    if (filters.userAction) {
      conditions.push("user_action = ?");
      params.push(filters.userAction);
    }
    if (filters.fromTime) {
      conditions.push("detected_at >= ?");
      params.push(filters.fromTime);
    }
    if (filters.toTime) {
      conditions.push("detected_at <= ?");
      params.push(filters.toTime);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM detection_records ${where} ORDER BY detected_at DESC LIMIT 200`)
      .all(...params);

    const matchStmt = this.db.prepare(
      "SELECT * FROM detection_matches WHERE detection_record_id = ? ORDER BY rank_index ASC"
    );

    return rows.map((row) => ({
      ...row,
      matches: matchStmt.all(row.id)
    }));
  }
}

module.exports = new HistoryService();
