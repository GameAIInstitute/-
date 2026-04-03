const fs = require("fs");
const dbManager = require("../db/database");
const imageFeatureService = require("./image-feature-service");

class IndexService {
  constructor() {
    this.db = dbManager.db;
  }

  startScanJob(directoryPath) {
    const info = this.db
      .prepare(
        "INSERT INTO scan_jobs (directory_path, status, started_at) VALUES (?, 'RUNNING', ?)"
      )
      .run(directoryPath, Date.now());
    return info.lastInsertRowid;
  }

  finishScanJob(scanJobId, payload) {
    this.db
      .prepare(
        `UPDATE scan_jobs
         SET status = ?, finished_at = ?, scanned_count = ?, indexed_count = ?, skipped_count = ?, removed_count = ?, error_message = ?
         WHERE id = ?`
      )
      .run(
        payload.status,
        Date.now(),
        payload.scannedCount,
        payload.indexedCount,
        payload.skippedCount,
        payload.removedCount,
        payload.errorMessage || null,
        scanJobId
      );
  }

  getIndexedImagesByDirectory(directoryPath) {
    return this.db
      .prepare("SELECT * FROM images WHERE directory_path = ? AND status = 'ACTIVE' AND is_ignored = 0")
      .all(directoryPath);
  }

  getDirectorySummary(directoryPath) {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS imageCount, MAX(last_indexed_at) AS lastIndexedAt
         FROM images
         WHERE directory_path = ? AND status = 'ACTIVE'`
      )
      .get(directoryPath);
    return row || { imageCount: 0, lastIndexedAt: null };
  }

  upsertImage(feature) {
    this.db
      .prepare(
        `INSERT INTO images (
          file_path, file_name, directory_path, file_size, width, height, image_format,
          modified_time, created_time, file_hash, pixel_hash, ahash, dhash, phash,
          feature_vector_ref, feature_vector_blob, last_indexed_at, status, is_ignored
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)
        ON CONFLICT(file_path) DO UPDATE SET
          file_name = excluded.file_name,
          directory_path = excluded.directory_path,
          file_size = excluded.file_size,
          width = excluded.width,
          height = excluded.height,
          image_format = excluded.image_format,
          modified_time = excluded.modified_time,
          created_time = excluded.created_time,
          file_hash = excluded.file_hash,
          pixel_hash = excluded.pixel_hash,
          ahash = excluded.ahash,
          dhash = excluded.dhash,
          phash = excluded.phash,
          feature_vector_ref = excluded.feature_vector_ref,
          feature_vector_blob = excluded.feature_vector_blob,
          last_indexed_at = excluded.last_indexed_at,
          status = 'ACTIVE'`
      )
      .run(
        feature.filePath,
        feature.fileName,
        feature.directoryPath,
        feature.fileSize,
        feature.width,
        feature.height,
        feature.imageFormat,
        feature.modifiedTime,
        feature.createdTime,
        feature.fileHash,
        feature.pixelHash,
        feature.ahash,
        feature.dhash,
        feature.phash,
        feature.featureVectorRef,
        feature.featureVectorBlob,
        Date.now()
      );
  }

  markDeletedFiles(directoryPath, existingPaths) {
    const active = this.db
      .prepare("SELECT file_path FROM images WHERE directory_path = ? AND status = 'ACTIVE'")
      .all(directoryPath)
      .map((r) => r.file_path);
    const deleted = active.filter((p) => !existingPaths.has(p) || !fs.existsSync(p));

    const mark = this.db.prepare("UPDATE images SET status = 'DELETED', last_indexed_at = ? WHERE file_path = ?");
    const now = Date.now();
    const tx = this.db.transaction((paths) => {
      paths.forEach((p) => mark.run(now, p));
    });
    tx(deleted);
    return deleted.length;
  }

  async indexSingleFile(filePath) {
    const feature = await imageFeatureService.extractFeatures(filePath);
    this.upsertImage(feature);
    return feature;
  }

  async buildIndex(directoryPath, files, onProgress = () => {}) {
    let indexedCount = 0;
    let skippedCount = 0;

    for (const filePath of files) {
      try {
        const existing = this.db
          .prepare("SELECT modified_time, file_size FROM images WHERE file_path = ? AND status = 'ACTIVE'")
          .get(filePath);
        const stat = fs.statSync(filePath);

        if (existing && existing.modified_time === stat.mtimeMs && existing.file_size === stat.size) {
          skippedCount += 1;
          onProgress({ indexedCount, skippedCount, currentFile: filePath });
          continue;
        }

        await this.indexSingleFile(filePath);
        indexedCount += 1;
        onProgress({ indexedCount, skippedCount, currentFile: filePath });
      } catch (_error) {
        skippedCount += 1;
      }
    }

    const removedCount = this.markDeletedFiles(directoryPath, new Set(files));
    return { indexedCount, skippedCount, removedCount };
  }
}

module.exports = new IndexService();
