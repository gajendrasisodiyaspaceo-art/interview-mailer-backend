const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const RESUME_DIR = path.join(DATA_DIR, 'resumes');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(RESUME_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'mailer.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    sender_name TEXT DEFAULT '',
    send_time TEXT DEFAULT '09:00',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    last_run_date TEXT DEFAULT '',
    google_access_token TEXT DEFAULT '',
    google_refresh_token TEXT DEFAULT '',
    google_email TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS template (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    resume_path TEXT DEFAULT '',
    resume_original_name TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    company TEXT DEFAULT '',
    role TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER,
    email TEXT NOT NULL,
    company TEXT DEFAULT '',
    role TEXT DEFAULT '',
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    error_message TEXT DEFAULT '',
    sent_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// migrate: add google columns if missing
const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
if (!cols.includes('google_access_token')) {
  db.exec(`ALTER TABLE settings ADD COLUMN google_access_token TEXT DEFAULT ''`);
  db.exec(`ALTER TABLE settings ADD COLUMN google_refresh_token TEXT DEFAULT ''`);
  db.exec(`ALTER TABLE settings ADD COLUMN google_email TEXT DEFAULT ''`);
}

const settingsRow = db.prepare('SELECT id FROM settings WHERE id = 1').get();
if (!settingsRow) {
  db.prepare('INSERT INTO settings (id) VALUES (1)').run();
}

const templateRow = db.prepare('SELECT id FROM template WHERE id = 1').get();
if (!templateRow) {
  db.prepare('INSERT INTO template (id) VALUES (1)').run();
}

module.exports = { db, DATA_DIR, RESUME_DIR };
