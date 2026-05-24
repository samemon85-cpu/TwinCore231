import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#070B14",
  surface: "#0D1424",
  surfaceAlt: "#111827",
  border: "#1E2D45",
  borderBright: "#2A4A6B",
  accent: "#00D4FF",
  accentGlow: "#00D4FF33",
  accentWarm: "#FF6B2B",
  accentGreen: "#00FF88",
  accentYellow: "#FFD93D",
  accentRed: "#FF4757",
  text: "#E8F4FD",
  textMuted: "#6B8CAE",
  textDim: "#3A5A7A",
};

const FLOORS = [
  { id: "B1", label: "Basement" },
  { id: "G", label: "Ground" },
  { id: "L1", label: "Level 1" },
  { id: "L2", label: "Level 2" },
  { id: "L3", label: "Level 3" },
  { id: "RF", label: "Roof" },
];

const ASSETS = [
  { id: "A001", name: "AHU-01", type: "HVAC", floor: "L1", x: 18, y: 22, status: "operational", health: 94, temp: 18.2, lastMaintained: "2026-04-12", nextMaintained: "2026-07-12", brand: "Carrier", model: "39HQ", installYear: 2020 },
  { id: "A002", name: "ELEV-01", type: "Elevator", floor: "G", x: 48, y: 55, status: "warning", health: 67, temp: null, lastMaintained: "2026-02-01", nextMaintained: "2026-05-01", brand: "Otis", model: "Gen2", installYear: 2018 },
  { id: "A003", name: "CHILLER-01", type: "Cooling", floor: "B1", x: 30, y: 40, status: "operational", health: 88, temp: 6.5, lastMaintained: "2026-03-20", nextMaintained: "2026-06-20", brand: "Trane", model: "CGAX", installYear: 2019 },
  { id: "A004", name: "PUMP-02", type: "Plumbing", floor: "B1", x: 62, y: 38, status: "critical", health: 31, temp: null, lastMaintained: "2025-11-10", nextMaintained: "2026-02-10", brand: "Grundfos", model: "CM5", installYear: 2017 },
  { id: "A005", name: "FCU-L2-04", type: "HVAC", floor: "L2", x: 72, y: 28, status: "operational", health: 99, temp: 21.0, lastMaintained: "2026-05-01", nextMaintained: "2026-08-01", brand: "Daikin", model: "FWB", installYear: 2023 },
  { id: "A006", name: "GEN-01", type: "Power", floor: "B1", x: 80, y: 65, status: "standby", health: 100, temp: null, lastMaintained: "2026-01-15", nextMaintained: "2026-07-15", brand: "Cummins", model: "C150", installYear: 2021 },
  { id: "A007", name: "FIRE-SYS", type: "Safety", floor: "L1", x: 55, y: 18, status: "operational", health: 100, temp: null, lastMaintained: "2026-04-30", nextMaintained: "2026-10-30", brand: "Notifier", model: "NFS2-640", installYear: 2020 },
  { id: "A008", name: "BMS-CTRL", type: "Controls", floor: "L3", x: 35, y: 70, status: "operational", health: 82, temp: null, lastMaintained: "2026-03-01", nextMaintained: "2026-09-01", brand: "Siemens", model: "Desigo CC", installYear: 2022 },
];

const WORK_ORDERS = [
  { id: "WO-2847", asset: "PUMP-02", title: "Bearing replacement", priority: "urgent", status: "open", assigned: "J. Santos", created: "2026-05-20", due: "2026-05-24" },
  { id: "WO-2831", asset: "ELEV-01", title: "Annual safety inspection", priority: "high", status: "in-progress", assigned: "T. Reyes", created: "2026-05-18", due: "2026-05-30" },
  { id: "WO-2819", asset: "AHU-01", title: "Filter replacement", priority: "normal", status: "scheduled", assigned: "M. Cruz", created: "2026-05-15", due: "2026-06-10" },
  { id: "WO-2801", asset: "BMS-CTRL", title: "Firmware update v4.2", priority: "low", status: "scheduled", assigned: "L. Tan", created: "2026-05-10", due: "2026-06-15" },
  { id: "WO-2798", asset: "CHILLER-01", title: "Refrigerant check", priority: "normal", status: "completed", assigned: "J. Santos", created: "2026-05-05", due: "2026-05-20" },
];

const SENSOR_HISTORY = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  temp: 20 + Math.sin(i * 0.4) * 3 + Math.random() * 0.5,
  energy: 45 + Math.sin(i * 0.3 + 1) * 20 + (i > 8 && i < 18 ? 30 : 0) + Math.random() * 5,
  occupancy: i >= 8 && i <= 19 ? Math.round(40 + Math.sin((i - 8) * 0.5) * 35) : Math.round(Math.random() * 5),
}));

const ARCH_LAYERS = [
  { id: "presentation", label: "Presentation Layer", color: "#00D4FF", items: ["Web App (React/Next.js)", "Mobile App (React Native)", "AR/VR Interface", "Admin Portal"] },
  { id: "api", label: "API Gateway & Services", color: "#00FF88", items: ["REST / GraphQL API", "WebSocket (live data)", "Auth & RBAC", "Rate Limiting"] },
  { id: "core", label: "Core Services", color: "#FF6B2B", items: ["BIM Engine (IFC.js / APS)", "Digital Twin Sync", "Asset Registry", "Work Order Engine", "Analytics Service"] },
  { id: "integration", label: "Integration Layer", color: "#FFD93D", items: ["IoT Hub (MQTT/AMQP)", "BACnet / Modbus Gateway", "ERP Connector", "GIS / Mapping API"] },
  { id: "data", label: "Data Layer", color: "#A78BFA", items: ["Time-Series DB (InfluxDB)", "Asset DB (PostgreSQL)", "BIM Storage (IFC/RVT)", "Document Store (S3)", "Cache (Redis)"] },
];

function StatusDot({ status, size = 8 }) {
  const colors = { operational: COLORS.accentGreen, warning: COLORS.accentYellow, critical: COLORS.accentRed, standby: COLORS.textMuted };
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: colors[status] || COLORS.textMuted,
      boxShadow: status === "critical" ? `0 0 8px ${COLORS.accentRed}` : status === "operational" ? `0 0 6px ${colors[status]}55` : "none",
      flexShrink: 0,
    }} />
  );
}

function HealthBar({ value }) {
  const color = value > 75 ? COLORS.accentGreen : value > 40 ? COLORS.accentYellow : COLORS.accentRed;
  return (
    <div style={{ width: "100%", height: 4, background: COLORS.border, borderRadius: 2 }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease", boxShadow: `0 0 8px ${color}88` }} />
    </div>
  );
}

function MiniChart({ data, color, height = 40 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(" ");
  return (
    <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      <defs>
        <linearGradient id={`g${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#g${color.replace("#", "")})`} />
    </svg>
  );
}

function BIMFloorPlan({ assets, selectedFloor, onSelectAsset, selectedAsset }) {
  const floorAssets = assets.filter(a => a.floor === selectedFloor);
  const typeIcons = { HVAC: "◈", Elevator: "⊡", Cooling: "❄", Plumbing: "⌀", Power: "⚡", Safety: "⊛", Controls: "⬡" };
  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "56%", background: COLORS.bg, borderRadius: 8, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
      {/* Grid lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke={COLORS.border} strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        {/* Floor outline */}
        <rect x="8" y="8" width="84" height="84" fill="none" stroke={COLORS.borderBright} strokeWidth="0.5" strokeDasharray="2,1" />
        {/* Rooms */}
        <rect x="10" y="10" width="35" height="40" fill={`${COLORS.accent}05`} stroke={COLORS.borderBright} strokeWidth="0.4" />
        <rect x="47" y="10" width="43" height="25" fill={`${COLORS.accentWarm}05`} stroke={COLORS.borderBright} strokeWidth="0.4" />
        <rect x="10" y="52" width="25" height="38" fill={`${COLORS.accentGreen}05`} stroke={COLORS.borderBright} strokeWidth="0.4" />
        <rect x="37" y="37" width="53" height="53" fill={`${COLORS.accent}03`} stroke={COLORS.borderBright} strokeWidth="0.4" />
        {/* Labels */}
        <text x="20" y="20" fontSize="3" fill={COLORS.textDim} fontFamily="monospace">MECHANICAL</text>
        <text x="53" y="20" fontSize="3" fill={COLORS.textDim} fontFamily="monospace">OFFICE A</text>
        <text x="14" y="60" fontSize="3" fill={COLORS.textDim} fontFamily="monospace">LOBBY</text>
        <text x="50" y="47" fontSize="3" fill={COLORS.textDim} fontFamily="monospace">OFFICE B</text>
        {/* Compass */}
        <text x="90" y="14" fontSize="4" fill={COLORS.textMuted} fontFamily="monospace" textAnchor="middle">N</text>
        <line x1="90" y1="16" x2="90" y2="20" stroke={COLORS.textMuted} strokeWidth="0.5" />
      </svg>

      {/* Asset hotspots */}
      {floorAssets.map(asset => {
        const isSelected = selectedAsset?.id === asset.id;
        const statusColors = { operational: COLORS.accentGreen, warning: COLORS.accentYellow, critical: COLORS.accentRed, standby: COLORS.textMuted };
        const color = statusColors[asset.status];
        return (
          <button key={asset.id} onClick={() => onSelectAsset(asset)}
            style={{
              position: "absolute", left: `${asset.x}%`, top: `${asset.y}%`,
              transform: "translate(-50%,-50%)",
              background: isSelected ? color : `${color}22`,
              border: `1.5px solid ${color}`,
              borderRadius: 4, padding: "3px 6px", cursor: "pointer",
              color: isSelected ? COLORS.bg : color,
              fontSize: 10, fontFamily: "monospace", fontWeight: 700,
              boxShadow: `0 0 ${isSelected ? 20 : 8}px ${color}${isSelected ? "99" : "44"}`,
              transition: "all 0.2s", zIndex: 2, whiteSpace: "nowrap",
              animation: asset.status === "critical" ? "pulse 1.5s infinite" : "none",
            }}>
            {typeIcons[asset.type] || "●"} {asset.name}
          </button>
        );
      })}

      {floorAssets.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim, fontFamily: "monospace", fontSize: 12 }}>
          No assets on this floor
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

function AssetPanel({ asset, onClose }) {
  if (!asset) return null;
  const statusLabel = { operational: "Operational", warning: "Warning", critical: "Critical", standby: "Standby" };
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.borderBright}`, borderRadius: 10, padding: 20, position: "relative" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: COLORS.textMuted, fontSize: 18, cursor: "pointer" }}>✕</button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <StatusDot status={asset.status} size={10} />
        <div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 16 }}>{asset.name}</div>
          <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{asset.type} · {asset.id} · Floor {asset.floor}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          ["Brand", asset.brand], ["Model", asset.model],
          ["Installed", asset.installYear], ["Status", statusLabel[asset.status]],
          ["Last Service", asset.lastMaintained], ["Next Service", asset.nextMaintained],
        ].map(([k, v]) => (
          <div key={k} style={{ background: COLORS.bg, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
            <div style={{ color: COLORS.text, fontSize: 12, fontFamily: "monospace" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: COLORS.textMuted, fontSize: 11 }}>Health Score</span>
          <span style={{ color: asset.health > 75 ? COLORS.accentGreen : asset.health > 40 ? COLORS.accentYellow : COLORS.accentRed, fontFamily: "monospace", fontWeight: 700 }}>{asset.health}%</span>
        </div>
        <HealthBar value={asset.health} />
      </div>

      {asset.temp !== null && (
        <div style={{ background: COLORS.bg, borderRadius: 6, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: COLORS.textMuted, fontSize: 11 }}>Live Temperature</span>
          <span style={{ color: COLORS.accent, fontFamily: "monospace", fontWeight: 700, fontSize: 16 }}>{asset.temp}°C</span>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, unit, sub, color, sparkData }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.7 }} />
      <div style={{ color: COLORS.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
        <span style={{ color: COLORS.text, fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{value}</span>
        <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{unit}</span>
      </div>
      {sub && <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 8 }}>{sub}</div>}
      {sparkData && <MiniChart data={sparkData} color={color} height={36} />}
    </div>
  );
}

function ArchitectureView() {
  return (
    <div style={{ padding: "0 0 16px" }}>
      <div style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 20, lineHeight: 1.7 }}>
        Reference architecture for the BIM-based Digital Twin platform — spanning from IoT edge devices through data pipelines to the presentation layer.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ARCH_LAYERS.map((layer, i) => (
          <div key={layer.id} style={{ background: COLORS.surface, border: `1px solid ${layer.color}33`, borderLeft: `3px solid ${layer.color}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: layer.color, boxShadow: `0 0 8px ${layer.color}` }} />
              <span style={{ color: layer.color, fontFamily: "monospace", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>L{ARCH_LAYERS.length - i} · {layer.label}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {layer.items.map(item => (
                <span key={item} style={{ background: `${layer.color}11`, border: `1px solid ${layer.color}33`, color: COLORS.text, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontFamily: "monospace" }}>{item}</span>
              ))}
            </div>
            {i < ARCH_LAYERS.length - 1 && (
              <div style={{ textAlign: "center", marginTop: 8, color: COLORS.textDim, fontSize: 10 }}>↓ API / Events / Streams ↓</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ color: COLORS.accentWarm, fontFamily: "monospace", fontWeight: 700, fontSize: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Tech Stack Recommendations</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["BIM Engine", "Autodesk APS / IFC.js / xeokit"],
            ["Frontend", "Next.js 15 + React Native"],
            ["3D Viewer", "Three.js / Babylon.js"],
            ["IoT", "AWS IoT Core / Azure IoT Hub"],
            ["Time-Series", "InfluxDB / TimescaleDB"],
            ["Asset DB", "PostgreSQL + PostGIS"],
            ["Messaging", "MQTT 5 / RabbitMQ"],
            ["Auth", "Auth0 / Keycloak (RBAC)"],
            ["CI/CD", "GitHub Actions + Docker"],
            ["Monitoring", "Grafana + Prometheus"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: COLORS.bg, borderRadius: 6, padding: "8px 10px" }}>
              <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 2 }}>{k}</div>
              <div style={{ color: COLORS.accent, fontSize: 11, fontFamily: "monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkOrdersView() {
  const priorityColor = { urgent: COLORS.accentRed, high: COLORS.accentYellow, normal: COLORS.accent, low: COLORS.textMuted };
  const statusColor = { open: COLORS.accentRed, "in-progress": COLORS.accentYellow, scheduled: COLORS.accent, completed: COLORS.accentGreen };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {WORK_ORDERS.map(wo => (
        <div key={wo.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: COLORS.textDim, fontFamily: "monospace", fontSize: 10 }}>{wo.id}</span>
              <span style={{ background: `${priorityColor[wo.priority]}22`, color: priorityColor[wo.priority], borderRadius: 3, padding: "1px 6px", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>{wo.priority}</span>
            </div>
            <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{wo.title}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 11 }}>Asset: {wo.asset} · Assigned: {wo.assigned} · Due: {wo.due}</div>
          </div>
          <span style={{ background: `${statusColor[wo.status]}22`, color: statusColor[wo.status], borderRadius: 4, padding: "3px 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{wo.status}</span>
        </div>
      ))}
    </div>
  );
}

function EnergyView() {
  const maxEnergy = Math.max(...SENSOR_HISTORY.map(d => d.energy));
  const totalToday = Math.round(SENSOR_HISTORY.reduce((s, d) => s + d.energy, 0) / 10);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          ["Today", `${totalToday}`, "kWh", COLORS.accent],
          ["Peak Demand", "87.3", "kW", COLORS.accentYellow],
          ["Carbon", "42.1", "kg CO₂", COLORS.accentGreen],
        ].map(([l, v, u, c]) => (
          <div key={l} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ color: COLORS.textMuted, fontSize: 10, marginBottom: 4 }}>{l}</div>
            <div style={{ color: c, fontFamily: "monospace", fontWeight: 700, fontSize: 20 }}>{v}</div>
            <div style={{ color: COLORS.textDim, fontSize: 10 }}>{u}</div>
          </div>
        ))}
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 12 }}>24-Hour Energy Consumption (kW)</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
          {SENSOR_HISTORY.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                flex: 1, width: "100%", background: d.energy > 70 ? `${COLORS.accentYellow}88` : `${COLORS.accent}55`,
                borderRadius: "2px 2px 0 0",
                height: `${(d.energy / maxEnergy) * 100}%`,
                minHeight: 2,
                border: `1px solid ${d.energy > 70 ? COLORS.accentYellow : COLORS.accent}44`,
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {["00:00", "06:00", "12:00", "18:00", "23:00"].map(t => (
            <span key={t} style={{ color: COLORS.textDim, fontSize: 9, fontFamily: "monospace" }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 12 }}>Occupancy vs Temperature (24h)</div>
        <div style={{ position: "relative", height: 80 }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <MiniChart data={SENSOR_HISTORY.map(d => d.occupancy)} color={COLORS.accentWarm} height={80} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: 0.7 }}>
            <MiniChart data={SENSOR_HISTORY.map(d => d.temp)} color={COLORS.accent} height={80} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <span style={{ color: COLORS.accentWarm, fontSize: 10 }}>● Occupancy (%)</span>
          <span style={{ color: COLORS.accent, fontSize: 10 }}>● Temperature (°C)</span>
        </div>
      </div>
    </div>
  );
}

export default function DigitalTwinDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedFloor, setSelectedFloor] = useState("L1");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [time, setTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const criticalCount = ASSETS.filter(a => a.status === "critical").length;
  const warningCount = ASSETS.filter(a => a.status === "warning").length;
  const operationalCount = ASSETS.filter(a => a.status === "operational").length;
  const openWOs = WORK_ORDERS.filter(w => w.status === "open" || w.status === "in-progress").length;

  const tabs = [
    { id: "dashboard", label: "BIM Viewer", icon: "⬡" },
    { id: "energy", label: "Energy", icon: "⚡" },
    { id: "workorders", label: "Work Orders", icon: "⊡" },
    { id: "architecture", label: "Architecture", icon: "◈" },
  ];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: COLORS.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${COLORS.bg}; } ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>

      {/* Header */}
      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentWarm})`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 14, letterSpacing: 0.5 }}>TWINCORE</div>
            <div style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Digital Twin Platform</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {criticalCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${COLORS.accentRed}22`, border: `1px solid ${COLORS.accentRed}44`, borderRadius: 6, padding: "4px 10px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accentRed, display: "inline-block", animation: "pulse 1s infinite" }} />
              <span style={{ color: COLORS.accentRed, fontSize: 11, fontFamily: "monospace" }}>{criticalCount} CRITICAL</span>
            </div>
          )}
          <div style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
            {time.toLocaleTimeString()}
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 20px", display: "flex", gap: 4 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: "none", border: "none", color: activeTab === tab.id ? COLORS.accent : COLORS.textMuted,
            borderBottom: `2px solid ${activeTab === tab.id ? COLORS.accent : "transparent"}`,
            padding: "12px 16px", fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 500,
            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="fade-in">
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              <KPICard label="Operational" value={operationalCount} unit="assets" color={COLORS.accentGreen} sparkData={[5,6,5,6,6,5,6,6]} />
              <KPICard label="Warnings" value={warningCount} unit="assets" color={COLORS.accentYellow} sparkData={[1,2,1,1,2,2,1,1]} />
              <KPICard label="Critical" value={criticalCount} unit="assets" color={COLORS.accentRed} sparkData={[0,1,1,0,1,1,1,1]} />
              <KPICard label="Open WOs" value={openWOs} unit="orders" color={COLORS.accentWarm} sparkData={[2,3,4,3,4,3,4,2]} />
            </div>

            {/* Floor selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {FLOORS.map(f => (
                <button key={f.id} onClick={() => { setSelectedFloor(f.id); setSelectedAsset(null); }} style={{
                  background: selectedFloor === f.id ? COLORS.accent : COLORS.surface,
                  border: `1px solid ${selectedFloor === f.id ? COLORS.accent : COLORS.border}`,
                  color: selectedFloor === f.id ? COLORS.bg : COLORS.textMuted,
                  borderRadius: 6, padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                  transition: "all 0.15s",
                }}>
                  {f.id} <span style={{ fontWeight: 400, opacity: 0.7 }}>{f.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selectedAsset ? "1fr 320px" : "1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
              <BIMFloorPlan assets={ASSETS} selectedFloor={selectedFloor} onSelectAsset={setSelectedAsset} selectedAsset={selectedAsset} />
              {selectedAsset && <AssetPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
            </div>

            {/* Asset list */}
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 13 }}>Asset Registry</span>
                <span style={{ color: COLORS.textDim, fontSize: 11 }}>{ASSETS.length} total assets</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: COLORS.bg }}>
                      {["ID", "Name", "Type", "Floor", "Status", "Health", "Next Service"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: COLORS.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ASSETS.map((asset, i) => (
                      <tr key={asset.id} onClick={() => { setSelectedFloor(asset.floor); setSelectedAsset(asset); setActiveTab("dashboard"); }}
                        style={{ borderTop: `1px solid ${COLORS.border}`, cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 12px", color: COLORS.textDim, fontFamily: "monospace", fontSize: 11 }}>{asset.id}</td>
                        <td style={{ padding: "10px 12px", color: COLORS.text, fontWeight: 600, fontSize: 12 }}>{asset.name}</td>
                        <td style={{ padding: "10px 12px", color: COLORS.textMuted, fontSize: 11 }}>{asset.type}</td>
                        <td style={{ padding: "10px 12px", color: COLORS.textMuted, fontFamily: "monospace", fontSize: 11 }}>{asset.floor}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <StatusDot status={asset.status} />
                            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "capitalize" }}>{asset.status}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", minWidth: 80 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1 }}><HealthBar value={asset.health} /></div>
                            <span style={{ color: COLORS.textMuted, fontSize: 10, fontFamily: "monospace" }}>{asset.health}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", color: COLORS.textMuted, fontSize: 11, fontFamily: "monospace" }}>{asset.nextMaintained}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "energy" && <div className="fade-in"><EnergyView /></div>}
        {activeTab === "workorders" && <div className="fade-in"><WorkOrdersView /></div>}
        {activeTab === "architecture" && <div className="fade-in"><ArchitectureView /></div>}
      </main>
    </div>
  );
}
