const fs = require('fs');
const path = require('path');

// In the packaged desktop app, Electron points this at userData (writable,
// survives reinstalls/updates). Falls back to a local folder for dev/manual runs.
const DATA_DIR = process.env.ECHOTRON_DATA_DIR || path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${file}, using fallback:`, e.message);
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function getHistory() {
  return readJson(HISTORY_FILE, []);
}

function addHistoryRecord(record) {
  const history = getHistory();
  // Upsert by (originalFilename, date) so re-saving after editing speaker
  // names updates the existing entry instead of duplicating it. Keep the
  // existing id stable across re-saves so History UI references don't go stale.
  const idx = history.findIndex(
    (r) => r.originalFilename === record.originalFilename && r.date === record.date
  );
  if (idx >= 0) {
    record.id = history[idx].id;
    history[idx] = record;
  } else {
    history.unshift(record);
  }
  writeJson(HISTORY_FILE, history);
  return record;
}

function deleteHistoryRecord(id) {
  const history = getHistory().filter((r) => r.id !== id);
  writeJson(HISTORY_FILE, history);
}

function getSettings() {
  return readJson(SETTINGS_FILE, { outputFolder: null });
}

function updateSettings(patch) {
  const settings = { ...getSettings(), ...patch };
  writeJson(SETTINGS_FILE, settings);
  return settings;
}

module.exports = {
  getHistory,
  addHistoryRecord,
  deleteHistoryRecord,
  getSettings,
  updateSettings,
};
