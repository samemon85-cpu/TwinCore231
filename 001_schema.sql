-- ── TWINCORE Database Schema ────────────────────────────────────────────────────
-- Migration 001: Initial schema  |  PostgreSQL 16 + uuid-ossp + postgis

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ── Enums ──────────────────────────────────────────────────────────────────────
CREATE TYPE asset_status   AS ENUM ('operational','warning','critical','standby');
CREATE TYPE asset_type_e   AS ENUM ('HVAC','Elevator','Cooling','Plumbing','Power','Safety','Controls','Lighting','Other');
CREATE TYPE wo_status_e    AS ENUM ('open','in-progress','scheduled','completed','cancelled');
CREATE TYPE wo_priority_e  AS ENUM ('urgent','high','normal','low');
CREATE TYPE alert_sev_e    AS ENUM ('urgent','high','normal','low');
CREATE TYPE alert_op_e     AS ENUM ('<','>','<=','>=','==');
CREATE TYPE user_role_e    AS ENUM ('manager','technician','iot','executive','tenant');

-- ── Floors ─────────────────────────────────────────────────────────────────────
CREATE TABLE floors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         VARCHAR(4)  NOT NULL UNIQUE,
  label        VARCHAR(60) NOT NULL,
  elevation_m  NUMERIC(8,3),
  area_m2      NUMERIC(10,2),
  bim_level_id VARCHAR(120),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Assets ─────────────────────────────────────────────────────────────────────
CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100)  NOT NULL,
  type            asset_type_e  NOT NULL,
  floor_id        UUID          NOT NULL REFERENCES floors(id),
  bim_element_id  VARCHAR(120),
  status          asset_status  NOT NULL DEFAULT 'operational',
  health_score    SMALLINT      NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  rul_hours       INTEGER       CHECK (rul_hours >= 0),
  brand           VARCHAR(80),
  model           VARCHAR(80),
  serial_number   VARCHAR(80),
  install_year    SMALLINT,
  warranty_expiry DATE,
  last_pm_date    DATE,
  next_pm_date    DATE,
  location_x      NUMERIC(10,4),
  location_y      NUMERIC(10,4),
  location_z      NUMERIC(10,4),
  specs           JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_assets_floor  ON assets(floor_id);
CREATE INDEX idx_assets_status ON assets(status)         WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_type   ON assets(type);
CREATE INDEX idx_assets_bim    ON assets(bim_element_id);

-- ── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(200)  NOT NULL UNIQUE,
  name          VARCHAR(120)  NOT NULL,
  role          user_role_e   NOT NULL DEFAULT 'tenant',
  password_hash VARCHAR(255)  NOT NULL,
  active        BOOLEAN       NOT NULL DEFAULT TRUE,
  floor_access  VARCHAR(4)[]  NOT NULL DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role  ON users(role)  WHERE deleted_at IS NULL;

-- ── Work Orders ────────────────────────────────────────────────────────────────
CREATE TABLE work_orders (
  id           VARCHAR(16)   PRIMARY KEY,
  asset_id     UUID          NOT NULL REFERENCES assets(id),
  title        VARCHAR(200)  NOT NULL,
  description  TEXT,
  priority     wo_priority_e NOT NULL DEFAULT 'normal',
  status       wo_status_e   NOT NULL DEFAULT 'open',
  assigned_to  UUID          REFERENCES users(id),
  created_by   UUID          NOT NULL REFERENCES users(id),
  est_hours    SMALLINT,
  actual_hours SMALLINT,
  due_at       TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX idx_wo_asset    ON work_orders(asset_id);
CREATE INDEX idx_wo_status   ON work_orders(status)      WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_priority ON work_orders(priority)    WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_assigned ON work_orders(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_due      ON work_orders(due_at)      WHERE deleted_at IS NULL;

-- ── Alert Rules ────────────────────────────────────────────────────────────────
CREATE TABLE alert_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(100)    NOT NULL,
  asset_id       VARCHAR(120)    NOT NULL,
  metric         VARCHAR(40)     NOT NULL,
  operator       alert_op_e      NOT NULL,
  threshold      DOUBLE PRECISION NOT NULL,
  severity       alert_sev_e     NOT NULL DEFAULT 'normal',
  active         BOOLEAN         NOT NULL DEFAULT TRUE,
  notify_emails  TEXT[]          NOT NULL DEFAULT '{}',
  created_by     UUID            REFERENCES users(id),
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

-- ── Alert Events ───────────────────────────────────────────────────────────────
CREATE TABLE alert_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id      UUID             NOT NULL REFERENCES alert_rules(id),
  asset_id     VARCHAR(120)     NOT NULL,
  metric       VARCHAR(40)      NOT NULL,
  value        DOUBLE PRECISION NOT NULL,
  threshold    DOUBLE PRECISION NOT NULL,
  severity     alert_sev_e      NOT NULL,
  acknowledged BOOLEAN          NOT NULL DEFAULT FALSE,
  ack_by       UUID             REFERENCES users(id),
  ack_at       TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (rule_id, asset_id, DATE_TRUNC('hour', triggered_at))
);

CREATE INDEX idx_alert_events_asset ON alert_events(asset_id);
CREATE INDEX idx_alert_events_ts    ON alert_events(triggered_at DESC);

-- ── ML Predictions ─────────────────────────────────────────────────────────────
CREATE TABLE ml_predictions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id       UUID             NOT NULL REFERENCES assets(id),
  rul_hours      INTEGER,
  risk_score     NUMERIC(4,3)     CHECK (risk_score BETWEEN 0 AND 1),
  model_version  VARCHAR(20),
  recommendation TEXT,
  features       JSONB            NOT NULL,
  confidence     NUMERIC(4,3),
  predicted_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ml_pred_asset ON ml_predictions(asset_id);
CREATE INDEX idx_ml_pred_ts    ON ml_predictions(predicted_at DESC);

-- ── BIM Sync Log ───────────────────────────────────────────────────────────────
CREATE TABLE bim_sync_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          VARCHAR(40)  NOT NULL UNIQUE,
  source          VARCHAR(20)  NOT NULL DEFAULT 'aps',
  urn             TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'queued',
  elements_synced INTEGER,
  error_msg       TEXT,
  triggered_by    UUID         REFERENCES users(id),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $do$ DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['assets','users','work_orders','alert_rules','floors']) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_ts BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $do$;

COMMIT;
