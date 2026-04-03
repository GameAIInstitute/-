const fs = require("fs");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");

class DatabaseManager {
  constructor() {
    const appDir = path.join(os.homedir(), ".image-similarity-checker");
    fs.mkdirSync(appDir, { recursive: true });
    this.dbPath = path.join(appDir, "app.db");
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        directory_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        image_format TEXT,
        modified_time INTEGER NOT NULL,
        created_time INTEGER,
        file_hash TEXT NOT NULL,
        pixel_hash TEXT,
        ahash TEXT,
        dhash TEXT,
        phash TEXT,
        feature_vector_ref TEXT,
        feature_vector_blob BLOB,
        last_indexed_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        is_ignored INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_images_directory_path ON images(directory_path);
      CREATE INDEX IF NOT EXISTS idx_images_hash ON images(file_hash);
      CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash);

      CREATE TABLE IF NOT EXISTS scan_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        directory_path TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        scanned_count INTEGER NOT NULL DEFAULT 0,
        indexed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        removed_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS detection_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        detected_at INTEGER NOT NULL,
        trigger_type TEXT NOT NULL,
        new_image_path TEXT NOT NULL,
        detection_directory TEXT NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        top_similarity_score REAL NOT NULL DEFAULT 0,
        final_level TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        user_action TEXT,
        ignored INTEGER NOT NULL DEFAULT 0,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_detection_records_detected_at ON detection_records(detected_at);
      CREATE INDEX IF NOT EXISTS idx_detection_records_detection_directory ON detection_records(detection_directory);
      CREATE INDEX IF NOT EXISTS idx_detection_records_level ON detection_records(final_level);
      CREATE INDEX IF NOT EXISTS idx_detection_records_action ON detection_records(user_action);

      CREATE TABLE IF NOT EXISTS detection_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        detection_record_id INTEGER NOT NULL,
        image_id INTEGER,
        match_file_path TEXT NOT NULL,
        score REAL NOT NULL,
        level TEXT NOT NULL,
        match_reason TEXT NOT NULL,
        rank_index INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (detection_record_id) REFERENCES detection_records(id)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }
}

module.exports = new DatabaseManager();
