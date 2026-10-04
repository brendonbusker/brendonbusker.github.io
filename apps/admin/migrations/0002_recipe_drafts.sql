-- SQLite requires rebuilding the table to expand a CHECK constraint.
-- Preserve every existing draft, its identity and its save timestamps.
CREATE TABLE drafts_next (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'post','recipe','project','homepage','resume','settings',
    'appearance','projectsPage','blogPage'
  )),
  content_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(content_type, content_key)
);

INSERT INTO drafts_next (id,content_type,content_key,payload_json,created_at,updated_at)
SELECT id,content_type,content_key,payload_json,created_at,updated_at FROM drafts;

DROP TABLE drafts;
ALTER TABLE drafts_next RENAME TO drafts;
CREATE INDEX idx_drafts_type_updated ON drafts(content_type, updated_at DESC);
