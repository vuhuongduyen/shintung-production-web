CREATE TABLE IF NOT EXISTS sku_data_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  report TEXT NOT NULL
);
