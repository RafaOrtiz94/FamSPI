-- Migration: 182_kickoff_2026.sql
-- Module: Kick Off 2026 — Internal event with live Q&A, interactive blocks, and QR-based question rooms

-- ─── kickoff_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kickoff_events (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(200)  NOT NULL,
    description   TEXT,
    event_date    DATE          NOT NULL,
    status        VARCHAR(30)   NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','scheduled','active','paused','finished','cancelled')),
    moderation_active BOOLEAN   NOT NULL DEFAULT TRUE,
    created_by    INTEGER       REFERENCES users(id),
    updated_by    INTEGER       REFERENCES users(id),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── kickoff_presentations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kickoff_presentations (
    id                  SERIAL PRIMARY KEY,
    event_id            INTEGER       NOT NULL REFERENCES kickoff_events(id) ON DELETE CASCADE,
    presenter_user_id   INTEGER       REFERENCES users(id),
    title               VARCHAR(200)  NOT NULL,
    description         TEXT,
    scheduled_start     TIMESTAMPTZ,
    scheduled_end       TIMESTAMPTZ,
    canva_url           TEXT,
    canva_embed_url     TEXT,
    fallback_url        TEXT,
    status              VARCHAR(30)   NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','ready','active','questions_open','questions_closed','finished','skipped')),
    current_block_order INTEGER       NOT NULL DEFAULT 0,
    sort_order          INTEGER       NOT NULL DEFAULT 0,
    created_by          INTEGER       REFERENCES users(id),
    updated_by          INTEGER       REFERENCES users(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── kickoff_presentation_blocks ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kickoff_presentation_blocks (
    id              SERIAL PRIMARY KEY,
    presentation_id INTEGER       NOT NULL REFERENCES kickoff_presentations(id) ON DELETE CASCADE,
    title           VARCHAR(200),
    content         TEXT,
    image_url       TEXT,
    block_type      VARCHAR(50)   NOT NULL DEFAULT 'info'
                      CHECK (block_type IN ('info','question','poll','image','video','text','custom')),
    sort_order      INTEGER       NOT NULL DEFAULT 0,
    is_active       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_by      INTEGER       REFERENCES users(id),
    updated_by      INTEGER       REFERENCES users(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── kickoff_questions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kickoff_questions (
    id              SERIAL PRIMARY KEY,
    presentation_id INTEGER       NOT NULL REFERENCES kickoff_presentations(id) ON DELETE CASCADE,
    user_id         INTEGER       REFERENCES users(id),
    display_name    VARCHAR(100),
    question_text   VARCHAR(1000) NOT NULL,
    status          VARCHAR(30)   NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','under_review','approved','highlighted','answered','hidden','rejected')),
    is_anonymous    BOOLEAN       NOT NULL DEFAULT FALSE,
    is_highlighted  BOOLEAN       NOT NULL DEFAULT FALSE,
    answered_at     TIMESTAMPTZ,
    answered_by     INTEGER       REFERENCES users(id),
    answer_text     TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── kickoff_qr_tokens ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kickoff_qr_tokens (
    id              SERIAL PRIMARY KEY,
    presentation_id INTEGER       NOT NULL REFERENCES kickoff_presentations(id) ON DELETE CASCADE,
    token           VARCHAR(128)  NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by      INTEGER       REFERENCES users(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kickoff_presentations_event_id   ON kickoff_presentations(event_id);
CREATE INDEX IF NOT EXISTS idx_kickoff_presentations_status     ON kickoff_presentations(status);
CREATE INDEX IF NOT EXISTS idx_kickoff_blocks_presentation_id   ON kickoff_presentation_blocks(presentation_id);
CREATE INDEX IF NOT EXISTS idx_kickoff_blocks_sort              ON kickoff_presentation_blocks(presentation_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_kickoff_questions_presentation   ON kickoff_questions(presentation_id);
CREATE INDEX IF NOT EXISTS idx_kickoff_questions_status         ON kickoff_questions(status);
CREATE INDEX IF NOT EXISTS idx_kickoff_qr_token                 ON kickoff_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_kickoff_qr_presentation_id       ON kickoff_qr_tokens(presentation_id);
