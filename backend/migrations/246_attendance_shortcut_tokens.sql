-- Registro de tokens de Shortcut (Siri) emitidos por TI, para permitir
-- revocacion individual sin tener que rotar SECRET_KEY globalmente.
CREATE TABLE IF NOT EXISTS attendance_shortcut_tokens (
  id            SERIAL PRIMARY KEY,
  jti           UUID NOT NULL UNIQUE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  issued_by     INTEGER REFERENCES users(id),
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  revoked_by    INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_shortcut_tokens_user
  ON attendance_shortcut_tokens (user_id);
