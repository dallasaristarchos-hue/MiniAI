CREATE TABLE IF NOT EXISTS content_reports (id TEXT PRIMARY KEY, category TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', message_excerpt TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON content_reports(created_at);
