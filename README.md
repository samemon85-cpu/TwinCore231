# TwinCore — Backend Scaffolding

Full-stack backend for the TwinCore Digital Twin Platform.

## Stack

| Layer | Technology |
|---|---|
| API Server | Node.js 20 + Express 4 |
| ML Service | Python 3.12 + FastAPI |
| Primary DB | PostgreSQL 16 + PostGIS |
| Time-Series | InfluxDB 2.7 |
| Cache / Pub-Sub | Redis 7.2 |
| IoT Broker | Eclipse Mosquitto 2.0 (MQTT) |
| Reverse Proxy | Nginx 1.25 |
| Containers | Docker + Docker Compose |

## Project Structure

```
twincore/
├── docker-compose.yml          # Full stack orchestration
├── .env.example                # Environment variable template
│
├── api/                        # Node.js REST + WebSocket API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # Entry point
│       ├── app.js              # Express app + middleware
│       ├── config/
│       │   ├── database.js     # PostgreSQL pool
│       │   ├── redis.js        # Redis client + cache helper
│       │   ├── influxdb.js     # InfluxDB write/query
│       │   └── logger.js       # Pino structured logger
│       ├── middleware/
│       │   ├── auth.middleware.js      # JWT + token revocation
│       │   ├── error.middleware.js     # Global error handler
│       │   └── validate.middleware.js  # Zod schema validation
│       ├── routes/
│       │   ├── auth.routes.js          # Login / logout / refresh / me
│       │   ├── assets.routes.js        # Asset CRUD + BIM metadata
│       │   ├── sensors.routes.js       # InfluxDB sensor history
│       │   ├── workorders.routes.js    # Work order lifecycle
│       │   ├── alerts.routes.js        # Alert rules + event history
│       │   ├── analytics.routes.js     # Energy + asset summaries
│       │   ├── bim.routes.js           # BIM model + APS sync
│       │   ├── users.routes.js         # User management + RBAC
│       │   └── ml.routes.js            # ML inference proxy
│       └── services/
│           ├── websocket.service.js    # WS server + Redis pub/sub
│           └── mqtt.service.js         # MQTT bridge + alert engine
│
├── ml-service/                 # Python FastAPI ML service
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI app + lifespan
│       ├── routers/
│       │   ├── health.py       # Health check
│       │   ├── predict.py      # Single + batch inference
│       │   └── retrain.py      # Background model retraining
│       └── services/
│           └── model_manager.py # sklearn GBR + IsolationForest
│
├── migrations/
│   └── sql/
│       ├── 001_schema.sql      # Full PostgreSQL schema
│       └── 002_seed.sql        # Reference data + demo records
│
└── infra/
    ├── nginx/nginx.conf        # Reverse proxy config
    └── mosquitto/mosquitto.conf # MQTT broker config
```

## Quick Start

```bash
# 1. Copy and fill environment variables
cp .env.example .env
# Edit .env with strong passwords and API keys

# 2. Start all services
docker-compose up -d

# 3. Run migrations + seed data (auto-runs via migrate/seed containers)
# Or manually:
docker-compose run --rm migrate
docker-compose run --rm seed

# 4. Verify
curl http://localhost/health
curl http://localhost/ml/health
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/v1/auth/login | Authenticate, receive JWT |
| POST | /api/v1/auth/logout | Revoke token |
| GET  | /api/v1/auth/me | Current user profile |
| GET  | /api/v1/assets | List assets (filter by floor/status/type) |
| GET  | /api/v1/assets/:id | Asset detail + BIM metadata |
| PATCH| /api/v1/assets/:id | Update asset status/health |
| GET  | /api/v1/sensors/:assetId/:metric | 24h sensor history (InfluxDB) |
| POST | /api/v1/sensors/ingest | HTTP sensor ingestion (MQTT fallback) |
| GET  | /api/v1/work-orders | List work orders |
| POST | /api/v1/work-orders | Create work order |
| PATCH| /api/v1/work-orders/:id | Update WO status |
| GET  | /api/v1/alerts/rules | Alert rules |
| POST | /api/v1/alerts/rules | Create alert rule |
| GET  | /api/v1/alerts/events | Triggered alert history |
| GET  | /api/v1/analytics/energy | Energy time-series |
| GET  | /api/v1/analytics/assets/summary | Asset health KPIs |
| GET  | /api/v1/bim/model | BIM model metadata |
| POST | /api/v1/bim/sync | Trigger APS model sync |
| GET  | /api/v1/users | User list (manager only) |
| POST | /api/v1/users | Invite user |
| POST | /api/v1/ml/predict | Run RUL + risk inference |
| GET  | /api/v1/ml/predictions/:assetId | Prediction history |

## WebSocket

Connect to `ws://localhost/ws?token=<JWT>` for live events:

- `telemetry` — sensor readings from IoT devices
- `alert` — triggered alert rule
- `status_change` — asset status updated
- `asset_update` — asset edited via API
- `work_order_created` / `work_order_updated`

## MQTT Topics

IoT devices publish to:
- `twincore/{assetId}/telemetry` — sensor metrics JSON
- `twincore/{assetId}/status` — device status change
- `twincore/{assetId}/alert` — device-side alert

## ML Service Endpoints

| Method | Path | Description |
|---|---|---|
| GET  | /health | Service health + model status |
| POST | /predict | Single asset RUL + risk inference |
| POST | /predict/batch | Batch inference |
| POST | /retrain | Queue model retraining job |

## Default Credentials (seed data)

| Email | Password | Role |
|---|---|---|
| m.santos@twincore.io | Admin1234! | Manager |
| t.reyes@twincore.io | Admin1234! | Technician |
| l.tan@twincore.io | Admin1234! | IoT Engineer |
| d.kim@twincore.io | Admin1234! | Executive |
| j.wu@twincore.io | Admin1234! | Tenant |

**Change all passwords immediately in production.**
