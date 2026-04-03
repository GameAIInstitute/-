const dbManager = require("../db/database");
const { DEFAULT_SETTINGS } = require("./constants");

class SettingsService {
  constructor() {
    this.db = dbManager.db;
    this.ensureDefaults();
  }

  ensureDefaults() {
    const now = Date.now();
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)"
    );

    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
      insert.run(key, JSON.stringify(value), now);
    });
  }

  getAllSettings() {
    const rows = this.db.prepare("SELECT key, value FROM app_settings").all();
    const map = { ...DEFAULT_SETTINGS };
    rows.forEach((row) => {
      map[row.key] = JSON.parse(row.value);
    });
    return map;
  }

  updateSettings(partialSettings) {
    const now = Date.now();
    const upsert = this.db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );

    const tx = this.db.transaction((input) => {
      Object.entries(input).forEach(([key, value]) => {
        upsert.run(key, JSON.stringify(value), now);
      });
    });

    tx(partialSettings);
    return this.getAllSettings();
  }
}

module.exports = new SettingsService();
