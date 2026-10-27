CREATE TABLE IF NOT EXISTS auth_accounts (
 login TEXT PRIMARY KEY, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 iterations INTEGER NOT NULL, credential_version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY, login TEXT NOT NULL,
 credential_version INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 revoked_at INTEGER, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_sessions_login ON auth_sessions(login);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_login_limits (
 bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
