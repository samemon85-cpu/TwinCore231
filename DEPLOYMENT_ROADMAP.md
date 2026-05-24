# TwinCore — Go-Live Roadmap & Next Steps

Complete guide to taking TwinCore from this scaffold to a live, production web system.

---

## Phase 1 — Domain & Cloud Foundation (Week 1–2)

### 1.1 Register Your Domain
- Buy `twincore.io` (or your brand domain) via Namecheap, Cloudflare Registrar, or AWS Route 53
- Point DNS to Cloudflare for DDoS protection, CDN, and WAF — free tier covers you initially
- Target records:
  - `app.twincore.io`     → production Kubernetes ingress IP
  - `staging.twincore.io` → staging cluster ingress IP
  - `api.twincore.io`     → alias for app (handled by Nginx ingress)

### 1.2 Choose a Cloud Provider

| Provider | Best for | Managed K8s | Notes |
|---|---|---|---|
| **AWS** (recommended) | Enterprise scale | EKS | Best IoT (AWS IoT Core), most integrations |
| **GCP** | ML-heavy workloads | GKE | Best managed K8s experience |
| **Azure** | Microsoft/BIM shops | AKS | Native APS/Forge integration |
| **DigitalOcean** | Startups/cost-sensitive | DOKS | Cheapest managed K8s (~$48/mo for 3 nodes) |

**Recommended for TwinCore: AWS** — EKS + AWS IoT Core + RDS + ElastiCache replaces
self-managed Postgres/Redis and gives you production SLAs.

### 1.3 Estimated Monthly Infrastructure Cost

| Component | Service | Est. Cost/month |
|---|---|---|
| Kubernetes (3 nodes, 4 vCPU/8GB) | EKS + EC2 t3.xlarge | ~$280 |
| PostgreSQL | RDS PostgreSQL 16 db.t3.medium | ~$60 |
| Redis | ElastiCache t3.micro cluster | ~$25 |
| InfluxDB | Self-hosted on K8s (EBS 100GB) | ~$12 |
| Load Balancer | AWS ALB | ~$20 |
| Domain + SSL | Cloudflare free + ACM | ~$15 |
| Container Registry | GHCR (GitHub) | Free |
| **Total** | | **~$412/month** |

DigitalOcean alternative: ~$180/month total for staging.

---

## Phase 2 — Kubernetes Cluster Setup (Week 2–3)

### 2.1 Create the Cluster

```bash
# AWS EKS (via eksctl)
eksctl create cluster \
  --name twincore-prod \
  --region ap-southeast-2 \
  --nodegroup-name standard \
  --node-type t3.xlarge \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 8 \
  --managed

# OR DigitalOcean
doctl kubernetes cluster create twincore-prod \
  --region syd1 \
  --size s-4vcpu-8gb \
  --count 3
```

### 2.2 Install Cluster Essentials

```bash
# 1. Nginx ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 2. cert-manager (auto SSL via Let's Encrypt)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 3. Apply ClusterIssuer for Let's Encrypt
kubectl apply -f k8s/base/cluster-issuer.yaml

# 4. External Secrets Operator (pull secrets from AWS Secrets Manager)
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace
```

### 2.3 Create Kubernetes Secrets

```bash
# Store in AWS Secrets Manager or GitHub Actions secrets, then sync via ESO
# OR create manually for initial setup:

kubectl create namespace twincore-prod

kubectl create secret generic twincore-secrets \
  --namespace twincore-prod \
  --from-literal=JWT_SECRET="$(openssl rand -base64 64)" \
  --from-literal=DATABASE_URL="postgresql://twincore:PASS@rds-host:5432/twincore" \
  --from-literal=REDIS_URL="redis://:PASS@elasticache-host:6379" \
  --from-literal=INFLUXDB_TOKEN="your-influxdb-token" \
  --from-literal=APS_CLIENT_ID="your-autodesk-client-id" \
  --from-literal=APS_CLIENT_SECRET="your-autodesk-client-secret"
```

---

## Phase 3 — CI/CD Pipeline Activation (Week 3)

### 3.1 GitHub Repository Setup

```
Repository → Settings → Environments:
  Create: staging    (no approval required)
  Create: production (require 1 reviewer approval)

Repository → Settings → Secrets:
  STAGING_KUBECONFIG  → base64 of staging kubeconfig
  PROD_KUBECONFIG     → base64 of production kubeconfig
  SLACK_WEBHOOK_URL   → Slack incoming webhook
  CODECOV_TOKEN       → from codecov.io
```

### 3.2 First Deploy

```bash
# 1. Push to main branch → triggers CI → triggers staging deploy
git push origin main

# 2. Tag for production release
git tag v2.1.0
git push origin v2.1.0
# → triggers production deploy (with required review approval)
```

### 3.3 Deploy Flow

```
Developer pushes code
       ↓
CI: lint + unit tests + integration tests + security scan
       ↓ (all pass)
Build & push Docker images to GHCR
       ↓
Auto-deploy to STAGING via Helm
       ↓
Smoke tests pass
       ↓
Tag v*.*.* → manual approval → PRODUCTION deploy
       ↓
Slack notification → GitHub Release created
```

---

## Phase 4 — Frontend Deployment (Week 3–4)

### 4.1 Deploy the React Frontend

The TwinCore React app (from your prototype files) needs a build step:

```bash
# In your frontend repo:
npm run build        # outputs to /dist
# Deploy to:
```

**Option A — Vercel (recommended, zero-config):**
```bash
npx vercel --prod
# Set env vars in Vercel dashboard:
# NEXT_PUBLIC_API_URL = https://api.twincore.io
# NEXT_PUBLIC_WS_URL  = wss://api.twincore.io/ws
```

**Option B — Cloudflare Pages:**
```bash
# Connect GitHub repo → Cloudflare Pages
# Build command: npm run build
# Output dir: dist
# Auto-deploys on every push to main
```

**Option C — Self-hosted on K8s:**
```bash
# Build as nginx:alpine Docker image serving static files
# Add to Helm chart as a new frontend deployment
```

### 4.2 Connect Frontend to Backend

```javascript
// src/config/api.js
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://app.twincore.io";
export const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  || "wss://app.twincore.io/ws";
```

---

## Phase 5 — Autodesk Platform Services (BIM) Integration (Week 4–6)

### 5.1 Set Up APS Account
1. Go to https://aps.autodesk.com → Create app
2. Copy Client ID + Secret → add to Kubernetes secrets
3. Enable APIs: Data Management, Model Derivative, Viewer

### 5.2 Upload Your BIM Model
```bash
# Use APS CLI or the /api/v1/bim/sync endpoint
curl -X POST https://app.twincore.io/api/v1/bim/sync \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"source":"aps","urn":"your-model-urn"}'
```

### 5.3 Embed Viewer
```html
<!-- In your React app -->
<script src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"></script>
```
Use `xeokit-sdk` (open source, no vendor lock-in) as a free alternative.

---

## Phase 6 — IoT Device Onboarding (Week 5–8)

### 6.1 Connect Real Sensors

Devices publish to MQTT over TLS:
```python
# Python device SDK example
import paho.mqtt.client as mqtt

client = mqtt.Client("sensor-AHU-01")
client.username_pw_set("device-user", "device-pass")
client.tls_set()  # TLS cert from your Mosquitto setup
client.connect("mqtt.twincore.io", 8883)

# Publish telemetry every 60s
client.publish("twincore/A001/telemetry", json.dumps({
    "metrics": {"temp": 18.2, "energy": 52.1, "vibration": 0.8},
    "units":   {"temp": "°C", "energy": "kW", "vibration": "g"}
}))
```

### 6.2 Supported IoT Protocols
- **MQTT** (primary) — port 1883 (plain), 8883 (TLS), 9001 (WebSocket)
- **BACnet/IP** — via BACnet-to-MQTT gateway (Node-RED or Scada-LTS)
- **Modbus TCP** — via Modbus-to-MQTT bridge
- **REST HTTP** — POST to `/api/v1/sensors/ingest` as fallback

---

## Phase 7 — Observability (Week 6)

### 7.1 Install Monitoring Stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set grafana.adminPassword=your-grafana-pass
```

Access Grafana at `http://grafana.twincore.io` — import dashboards:
- **15661** — Node.js API metrics
- **12708** — PostgreSQL metrics
- **763**   — Redis metrics
- **1860**  — Node Exporter (system)

### 7.2 Add API Metrics
```javascript
// In api/src/app.js — add Prometheus metrics endpoint
import { collectDefaultMetrics, Registry, Counter, Histogram } from "prom-client";
const registry = new Registry();
collectDefaultMetrics({ register: registry });
app.get("/metrics", async (_, res) => res.send(await registry.metrics()));
```

### 7.3 Set Up Alerts
Configure PagerDuty/OpsGenie for:
- Pod crashlooping → page on-call
- API error rate > 1% → Slack alert
- PostgreSQL disk > 80% → urgent alert
- ML model prediction errors → engineering alert

---

## Phase 8 — Security Hardening (Ongoing)

### Checklist before go-live:

```
Auth & Access
□ All default passwords changed (Postgres, Redis, InfluxDB, Mosquitto)
□ JWT secret is ≥ 64 random chars (openssl rand -base64 64)
□ Rate limiting on /api/v1/auth/login (already implemented)
□ HTTPS enforced — HTTP redirects to HTTPS at ingress level
□ CORS origin whitelist set (not *)

Network
□ Postgres / Redis / InfluxDB NOT exposed on public internet
□ Mosquitto requires TLS (port 8883) for device connections
□ Kubernetes NetworkPolicies — services only talk to what they need
□ Secrets stored in AWS Secrets Manager / HashiCorp Vault

Code
□ npm audit clean (no HIGH or CRITICAL vulnerabilities)
□ Docker images run as non-root (already implemented)
□ readOnlyRootFilesystem: true on containers (already implemented)
□ Trivy scan passes in CI (already wired)
□ OWASP ZAP scan before each major release

Data
□ Postgres backups — daily automated snapshots (RDS) or pg_dump cron
□ InfluxDB backups — influxd backup cron job
□ GDPR/Privacy policy if collecting tenant personal data
```

---

## Phase 9 — Go-Live Checklist

```
Infrastructure
□ DNS records pointing to load balancer IPs
□ SSL certificates issued and auto-renewing (cert-manager)
□ All health checks passing: /health, /ml/health
□ Grafana dashboards showing green

Application
□ Database migrations run successfully (001, 002)
□ Seed data loaded — test login with each role
□ BIM model synced and visible in viewer
□ WebSocket connection stable from browser
□ At least one IoT device sending telemetry
□ One alert rule triggering and sending to Slack/email

Team
□ Runbook written — what to do if API goes down
□ On-call rotation set up
□ Slack #alerts channel receiving Grafana alerts
□ Staging environment used for all pre-release testing
```

---

## Summary — Timeline

| Week | Milestone |
|---|---|
| 1–2  | Domain, cloud account, K8s cluster created |
| 2–3  | Cluster essentials (ingress, cert-manager, secrets) |
| 3    | CI/CD pipeline active, first staging deploy |
| 3–4  | Frontend live on Vercel/Cloudflare Pages |
| 4–6  | APS BIM integration, 3D viewer working |
| 5–8  | First real IoT devices sending data |
| 6    | Grafana monitoring + alerting live |
| 8    | Security audit complete, production go-live |
| 9+   | Feature iterations, ML model retraining on real data |

**Shortest path to something live: Weeks 1–3.**
Deploy the frontend to Vercel (free, 5 minutes), point it at the Docker Compose backend
running on a $20/month DigitalOcean droplet, and you have a real working URL to demo.
Scale to Kubernetes when you hit real traffic or need SLA guarantees.
