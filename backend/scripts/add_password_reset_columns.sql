-- Run once if users table already exists without reset columns:
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_users_password_reset_token ON users (password_reset_token);
