const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PDF_DIR = path.join(DATA_DIR, 'pdfs');
for (const d of [DATA_DIR, UPLOAD_DIR, PDF_DIR]) fs.mkdirSync(d, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'jashne.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  zone TEXT NOT NULL CHECK (zone IN ('Ground Zone','Zero Zone','High Zone','General')),
  gender TEXT NOT NULL CHECK (gender IN ('Boys','Girls')),
  chest_no TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participants_team ON participants(team_id);
CREATE INDEX IF NOT EXISTS idx_participants_zone ON participants(zone);
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Boys','Girls')),
  zone TEXT NOT NULL CHECK (zone IN ('Ground Zone','Zero Zone','High Zone','General')),
  announced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participations (
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  PRIMARY KEY (participant_id, program_id)
);
CREATE TABLE IF NOT EXISTS results (
  program_id INTEGER PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE,
  first_chest TEXT,
  second_chest TEXT,
  third_chest TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS judge_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  judge_no INTEGER NOT NULL CHECK (judge_no IN (1,2,3)),
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  components TEXT NOT NULL DEFAULT '[]',
  total REAL NOT NULL DEFAULT 0,
  UNIQUE (program_id, judge_no, participant_id)
);
CREATE TABLE IF NOT EXISTS pdfs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('team','participants','judges')),
  title TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stars (
  kind TEXT NOT NULL CHECK (kind IN ('star','pen')),
  zone TEXT NOT NULL,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (kind, zone)
);
`);

// ---- settings helpers ----
const DEFAULTS = {
  event_name: 'Jashne Rabeeh',
  logo_path: '',
  jr_locked: '0',
  position_marks: JSON.stringify({ first: 10, second: 8, third: 5 }),
  marking_scheme: JSON.stringify({ components: [{ label: 'Content', max: 8 }, { label: 'Presentation', max: 2 }] }),
};
const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
function getSetting(key) {
  const row = getSettingStmt.get(key);
  if (row) return row.value;
  if (key in DEFAULTS) return DEFAULTS[key];
  return null;
}
function setSetting(key, value) { setSettingStmt.run(key, String(value)); }
function getJSON(key) { try { return JSON.parse(getSetting(key)); } catch { return JSON.parse(DEFAULTS[key]); } }

// ---- seed ----
const seed = db.transaction(() => {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0) {
    const hash = bcrypt.hashSync(process.env.OWNER_PASSWORD || 'owner123', 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'owner')").run('owner', hash);
  }
  if (db.prepare('SELECT COUNT(*) AS c FROM teams').get().c === 0) {
    db.prepare('INSERT INTO teams (name) VALUES (\'\')').run();
    db.prepare('INSERT INTO teams (name) VALUES (\'\')').run();
  }
});
seed();

module.exports = { db, DATA_DIR, UPLOAD_DIR, PDF_DIR, getSetting, setSetting, getJSON };
