-- Esquema actual de la base D1 "control-estaciones-auth" (sacado de sqlite_master).
-- Es documentacion / punto de partida para un entorno nuevo; la base de produccion ya lo tiene.
-- Nota: station_notes.covered, locked_by, locked_at y candidate_provider son columnas de
-- versiones anteriores que el Worker ya no usa (salvo covered, que se mantiene en sintonia con stage).

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  salt          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER,
  show_data_badge INTEGER NOT NULL DEFAULT 0,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  password_changed_at INTEGER NOT NULL DEFAULT 0,
  role          TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE user_audit (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_email  TEXT NOT NULL,
  action        TEXT NOT NULL,
  detail        TEXT DEFAULT '',
  changed_by    TEXT NOT NULL,
  changed_at    INTEGER NOT NULL
);
CREATE INDEX idx_user_audit_target ON user_audit (target_email);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE password_resets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_resets_email ON password_resets (email);
CREATE INDEX idx_resets_token_hash ON password_resets (token_hash);

CREATE TABLE station_full (
  code       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE alt_station_full (
  code       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL
);

CREATE TABLE fcamo_checklists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  station_code  TEXT NOT NULL,
  reason        TEXT NOT NULL,
  station_types TEXT NOT NULL DEFAULT '[]',
  company_name  TEXT DEFAULT '',
  easa_ref      TEXT DEFAULT '',
  easa_date     TEXT DEFAULT '',
  fleet_scope   TEXT DEFAULT '[]',
  items_state   TEXT NOT NULL DEFAULT '{}',
  approved_by   TEXT DEFAULT '',
  approved_date TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending',
  created_by    TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER,
  deleted       INTEGER NOT NULL DEFAULT 0,
  deleted_by    TEXT DEFAULT '',
  deleted_at    INTEGER
);
CREATE INDEX idx_fcamo_station ON fcamo_checklists (station_code);

CREATE TABLE fcamo_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fcamo_id     INTEGER NOT NULL,
  station_code TEXT NOT NULL,
  action       TEXT NOT NULL,
  changed_by   TEXT NOT NULL,
  changed_at   INTEGER NOT NULL
);
CREATE INDEX idx_fcamo_history_fcamo ON fcamo_history (fcamo_id);

CREATE TABLE station_notes (
  station_code TEXT PRIMARY KEY,
  note         TEXT NOT NULL DEFAULT '',
  covered      INTEGER NOT NULL DEFAULT 0,
  updated_by   TEXT DEFAULT '',
  updated_at   INTEGER,
  locked_by    TEXT DEFAULT '',
  locked_at    INTEGER,
  stage        TEXT NOT NULL DEFAULT 'none',
  candidate_provider TEXT DEFAULT ''
);

CREATE TABLE station_note_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  station_code TEXT NOT NULL,
  action       TEXT NOT NULL,
  value        TEXT NOT NULL,
  changed_by   TEXT NOT NULL,
  changed_at   INTEGER NOT NULL
);
CREATE INDEX idx_note_history_station ON station_note_history (station_code);

CREATE TABLE station_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_code TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'identified',
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_station_candidates_station ON station_candidates (station_code);
