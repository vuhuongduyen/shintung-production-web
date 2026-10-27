CREATE TABLE IF NOT EXISTS file_objects (
 file_id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
 content_type TEXT NOT NULL, size INTEGER NOT NULL, module TEXT NOT NULL, record_id TEXT NOT NULL,
 uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL, checksum TEXT NOT NULL, status TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS backup_exports (
 id TEXT PRIMARY KEY, created_at TEXT NOT NULL, created_by TEXT NOT NULL, kind TEXT NOT NULL,
 status TEXT NOT NULL, object_key TEXT, filename TEXT, size INTEGER, checksum TEXT, error TEXT
);
