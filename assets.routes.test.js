"use strict";
/**
 * Integration tests — /api/v1/assets
 *
 * Uses supertest against the real Express app with mocked database + redis.
 * Requires: jest, supertest, @jest/globals
 *
 * Run: jest tests/integration/assets.routes.test.js
 */

import request from "supertest";
import jwt     from "jsonwebtoken";
import { jest } from "@jest/globals";

const SECRET = "test-secret-minimum-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.JWT_SECRET    = SECRET;
process.env.NODE_ENV      = "test";
process.env.DATABASE_URL  = "postgresql://test:test@localhost/test";
process.env.REDIS_URL     = "redis://localhost:6379";
process.env.INFLUXDB_URL  = "http://localhost:8086";
process.env.INFLUXDB_TOKEN = "test-token";
process.env.INFLUXDB_ORG  = "twincore";
process.env.INFLUXDB_BUCKET = "sensors";
process.env.MQTT_BROKER_URL = "mqtt://localhost:1883";
process.env.ML_SERVICE_URL  = "http://localhost:8000";

// ── Mock all external dependencies ────────────────────────────────────────────
const MOCK_ASSETS = [
  { id: "a-001", name: "AHU-01",  type: "HVAC",    floor_code: "L1", status: "operational", health_score: 94, rul_hours: 2847, next_pm_date: "2026-07-12", brand: "Carrier", model: "39HQ", install_year: 2020 },
  { id: "a-002", name: "PUMP-02", type: "Plumbing", floor_code: "B1", status: "critical",    health_score: 31, rul_hours: 124,  next_pm_date: null,         brand: "Grundfos", model: "CM5", install_year: 2017 },
];

const mockQuery = jest.fn();
const mockConnect = jest.fn().mockReturnValue({ query: jest.fn().mockResolvedValue({}), release: jest.fn() });

jest.mock("../../src/config/database.js", () => ({
  connectDB:       jest.fn().mockResolvedValue({}),
  getDB:           () => ({ query: mockQuery, connect: mockConnect }),
  withTransaction: jest.fn(async (fn) => fn({ query: mockQuery })),
}));

jest.mock("../../src/config/redis.js", () => ({
  connectRedis: jest.fn().mockResolvedValue({}),
  getRedis:     () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn(), publish: jest.fn(), ping: jest.fn().mockResolvedValue("PONG"), duplicate: jest.fn().mockReturnValue({ subscribe: jest.fn(), on: jest.fn() }) }),
  cacheGet:     jest.fn(async (key, fallback) => fallback()),
}));

jest.mock("../../src/config/influxdb.js", () => ({
  connectInflux:    jest.fn(),
  writeSensorPoint: jest.fn(),
  queryAssetSensors:jest.fn().mockResolvedValue([]),
}));

jest.mock("../../src/services/mqtt.service.js", () => ({
  connectMQTT: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../src/services/websocket.service.js", () => ({
  initWebSocketServer: jest.fn(),
  broadcast:           jest.fn().mockResolvedValue({}),
  getConnectedCount:   jest.fn().mockReturnValue(0),
}));

const app = (await import("../../src/app.js")).default;

// ── Token helpers ─────────────────────────────────────────────────────────────
const token = (role = "manager") =>
  jwt.sign({ sub: "u-001", email: "test@tc.io", role }, SECRET, { expiresIn: "1h" });

const AUTH   = (role) => ({ Authorization: `Bearer ${token(role)}` });

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("GET /api/v1/assets", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns paginated asset list for authenticated user", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: MOCK_ASSETS })
      .mockResolvedValueOnce({ rows: [{ total: "2" }] });

    const res = await request(app)
      .get("/api/v1/assets")
      .set(AUTH());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.assets).toHaveLength(2);
    expect(res.body.assets[0].name).toBe("AHU-01");
  });

  test("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/v1/assets");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  test("filters by status=critical", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [MOCK_ASSETS[1]] })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] });

    const res = await request(app)
      .get("/api/v1/assets?status=critical")
      .set(AUTH());

    expect(res.status).toBe(200);
    expect(res.body.assets[0].status).toBe("critical");
  });

  test("rejects invalid status enum value with 422", async () => {
    const res = await request(app)
      .get("/api/v1/assets?status=unknown")
      .set(AUTH());

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Validation failed");
  });
});

describe("GET /api/v1/assets/:id", () => {
  test("returns asset detail for valid id", async () => {
    mockQuery.mockResolvedValue({ rows: [MOCK_ASSETS[0]] });

    const res = await request(app)
      .get("/api/v1/assets/a-001")
      .set(AUTH());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("a-001");
    expect(res.body.name).toBe("AHU-01");
  });

  test("returns 404 when asset not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get("/api/v1/assets/nonexistent")
      .set(AUTH());

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/assets/:id", () => {
  test("updates asset status for manager role", async () => {
    const updated = { ...MOCK_ASSETS[0], status: "warning" };
    mockQuery.mockResolvedValue({ rows: [updated], rowCount: 1 });

    const res = await request(app)
      .patch("/api/v1/assets/a-001")
      .set(AUTH("manager"))
      .send({ status: "warning" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("warning");
  });

  test("returns 403 for tenant role", async () => {
    const res = await request(app)
      .patch("/api/v1/assets/a-001")
      .set(AUTH("tenant"))
      .send({ status: "warning" });

    expect(res.status).toBe(403);
  });

  test("returns 422 for invalid health_score", async () => {
    const res = await request(app)
      .patch("/api/v1/assets/a-001")
      .set(AUTH("manager"))
      .send({ health_score: 150 }); // > 100

    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/v1/assets/:id", () => {
  test("soft-deletes asset for manager", async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 });

    const res = await request(app)
      .delete("/api/v1/assets/a-001")
      .set(AUTH("manager"));

    expect(res.status).toBe(204);
  });

  test("returns 403 for technician role", async () => {
    const res = await request(app)
      .delete("/api/v1/assets/a-001")
      .set(AUTH("technician"));

    expect(res.status).toBe(403);
  });
});
