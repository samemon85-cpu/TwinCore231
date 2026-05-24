import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: "#06090F", surface: "#0B1120", surfaceAlt: "#0F1929",
  border: "#162030", borderBright: "#1E3550", borderAccent: "#1E4A6E",
  accent: "#00C8F0", accentDim: "#00C8F022", accentGlow: "#00C8F044",
  warm: "#FF5C35", warmDim: "#FF5C3522",
  green: "#00E87A", greenDim: "#00E87A22",
  yellow: "#FFB830", yellowDim: "#FFB83022",
  red: "#FF3B55", redDim: "#FF3B5522",
  purple: "#9B6DFF", purpleDim: "#9B6DFF22",
  text: "#DCF0FF", textMuted: "#5A7A99", textDim: "#2A4A66",
};

// ─── DATA ─────────────────────────────────────────────────────────────────────
const ROLES = {
  manager:    { label: "Facility Manager",     icon: "🏢", color: C.accent },
  technician: { label: "Maintenance Tech",     icon: "🔧", color: C.warm },
  executive:  { label: "Executive / C-Suite",  icon: "📊", color: C.purple },
  iot:        { label: "IoT / BMS Engineer",   icon: "⚡", color: C.yellow },
  tenant:     { label: "Tenant / Occupant",    icon: "👤", color: C.green },
};

const FLOORS = ["RF","L5","L4","L3","L2","L1","GF","B1","B2"];
const FLOOR_LABELS = { RF:"Roof",L5:"Level 5",L4:"Level 4",L3:"Level 3",L2:"Level 2",L1:"Level 1",GF:"Ground",B1:"Basement 1",B2:"Basement 2" };

const ASSETS = [
  { id:"A001", name:"AHU-01",     type:"HVAC",     floor:"L1", x:16, y:24, status:"operational", health:94, rul:2847, temp:18.2, pm:"2026-07-12", brand:"Carrier",   model:"39HQ",         yr:2020 },
  { id:"A002", name:"ELEV-01",   type:"Elevator", floor:"GF", x:48, y:54, status:"warning",     health:67, rul:892,  temp:null,  pm:"2026-05-30", brand:"Otis",      model:"Gen2",         yr:2018 },
  { id:"A003", name:"CHILLER-01",type:"Cooling",  floor:"B1", x:28, y:42, status:"operational", health:88, rul:5210, temp:6.5,   pm:"2026-06-20", brand:"Trane",     model:"CGAX180",      yr:2019 },
  { id:"A004", name:"PUMP-02",   type:"Plumbing", floor:"B1", x:63, y:37, status:"critical",    health:31, rul:124,  temp:null,  pm:"OVERDUE",    brand:"Grundfos",  model:"CM5-5",        yr:2017 },
  { id:"A005", name:"FCU-L2-04", type:"HVAC",     floor:"L2", x:71, y:26, status:"operational", health:99, rul:8930, temp:21.0,  pm:"2026-08-01", brand:"Daikin",    model:"FWB100",       yr:2023 },
  { id:"A006", name:"GEN-01",    type:"Power",    floor:"B2", x:78, y:62, status:"standby",     health:100,rul:null, temp:null,  pm:"2026-07-15", brand:"Cummins",   model:"C150D5",       yr:2021 },
  { id:"A007", name:"FIRE-SYS",  type:"Safety",   floor:"L1", x:55, y:17, status:"operational", health:100,rul:null, temp:null,  pm:"2026-10-30", brand:"Notifier",  model:"NFS2-640",     yr:2020 },
  { id:"A008", name:"BMS-CTRL",  type:"Controls", floor:"L3", x:34, y:68, status:"operational", health:82, rul:3400, temp:null,  pm:"2026-09-01", brand:"Siemens",   model:"Desigo CC",    yr:2022 },
  { id:"A009", name:"TRANS-01",  type:"Power",    floor:"B2", x:40, y:72, status:"operational", health:91, rul:9200, temp:null,  pm:"2026-11-01", brand:"ABB",       model:"RESIBLOC",     yr:2021 },
  { id:"A010", name:"FCU-L3-02", type:"HVAC",     floor:"L3", x:22, y:42, status:"warning",     health:58, rul:610,  temp:23.8,  pm:"2026-05-28", brand:"Daikin",    model:"FWB080",       yr:2019 },
];

const WORK_ORDERS = [
  { id:"WO-2847", asset:"PUMP-02",    title:"Bearing replacement — urgent",       priority:"urgent", status:"open",        assigned:"J. Santos", created:"2026-05-20", due:"2026-05-24", est:4 },
  { id:"WO-2831", asset:"ELEV-01",    title:"Annual safety inspection",           priority:"high",   status:"in-progress", assigned:"T. Reyes",  created:"2026-05-18", due:"2026-05-30", est:8 },
  { id:"WO-2819", asset:"AHU-01",     title:"Filter replacement Q2",              priority:"normal", status:"scheduled",   assigned:"M. Cruz",   created:"2026-05-15", due:"2026-06-10", est:2 },
  { id:"WO-2810", asset:"FCU-L3-02",  title:"Coil cleaning & performance check",  priority:"high",   status:"open",        assigned:"T. Reyes",  created:"2026-05-22", due:"2026-05-27", est:3 },
  { id:"WO-2801", asset:"BMS-CTRL",   title:"Firmware upgrade to v4.2.1",         priority:"low",    status:"scheduled",   assigned:"L. Tan",    created:"2026-05-10", due:"2026-06-15", est:6 },
  { id:"WO-2798", asset:"CHILLER-01", title:"Refrigerant level check",            priority:"normal", status:"completed",   assigned:"J. Santos", created:"2026-05-05", due:"2026-05-20", est:2 },
  { id:"WO-2792", asset:"FIRE-SYS",   title:"Semi-annual detector test",          priority:"normal", status:"completed",   assigned:"M. Cruz",   created:"2026-04-28", due:"2026-05-15", est:4 },
];

const ALERT_RULES = [
  { id:"R001", name:"High Temperature Alert",    asset:"AHU-01",    metric:"temp",     op:">",  threshold:26,   severity:"high",   active:true,  triggered:false },
  { id:"R002", name:"Low Health Score",          asset:"ANY",       metric:"health",   op:"<",  threshold:40,   severity:"urgent", active:true,  triggered:true  },
  { id:"R003", name:"RUL Critical",              asset:"ANY",       metric:"rul",      op:"<",  threshold:200,  severity:"urgent", active:true,  triggered:true  },
  { id:"R004", name:"Energy Spike",              asset:"Building",  metric:"energy",   op:">",  threshold:95,   severity:"normal", active:false, triggered:false },
  { id:"R005", name:"Occupancy Threshold",       asset:"Building",  metric:"occupancy",op:">",  threshold:85,   severity:"low",    active:true,  triggered:false },
  { id:"R006", name:"FCU Over-Temp Warning",     asset:"FCU-L3-02", metric:"temp",     op:">",  threshold:23,   severity:"high",   active:true,  triggered:true  },
];

const SENSOR_24H = Array.from({length:24},(_,i)=>({
  h: `${String(i).padStart(2,"0")}`,
  temp: +(20+Math.sin(i*0.4)*3+(i>9&&i<19?2:0)+Math.random()*0.4).toFixed(1),
  energy: +(45+Math.sin(i*0.3+1)*20+(i>8&&i<18?32:0)+Math.random()*4).toFixed(1),
  occ: i>=8&&i<=19 ? Math.round(40+Math.sin((i-8)*0.5)*38) : Math.round(Math.random()*6),
  humid: +(48+Math.sin(i*0.5+2)*8+Math.random()*2).toFixed(1),
  co2: Math.round(400+(i>=8&&i<=18?250*Math.sin((i-8)*0.35):20)+Math.random()*30),
}));

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const statusColor = { operational:C.green, warning:C.yellow, critical:C.red, standby:C.textMuted };
const priorityColor = { urgent:C.red, high:C.yellow, normal:C.accent, low:C.textMuted };
const woStatusColor = { open:C.red, "in-progress":C.yellow, scheduled:C.accent, completed:C.green };
const typeIcon = { HVAC:"◈", Elevator:"⊡", Cooling:"❄", Plumbing:"⊙", Power:"⚡", Safety:"⊛", Controls:"⬡" };

function Dot({ status, size=8 }) {
  const c = statusColor[status]||C.textMuted;
  return <span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:c,boxShadow:status==="critical"?`0 0 6px ${c}`:status==="operational"?`0 0 5px ${c}66`:"none",flexShrink:0}} />;
}

function Bar({ v, color }) {
  const c = color||(v>75?C.green:v>40?C.yellow:C.red);
  return <div style={{width:"100%",height:3,background:C.border,borderRadius:2}}><div style={{width:`${v}%`,height:"100%",background:c,borderRadius:2,transition:"width .6s ease"}}/></div>;
}

function Chip({ label, color, bg }) {
  return <span style={{background:bg||`${color}22`,color:color||C.textMuted,border:`1px solid ${color||C.textMuted}33`,borderRadius:4,padding:"2px 8px",fontSize:10,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{label}</span>;
}

function Card({ children, style={}, onClick }) {
  return <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,...style}}>{children}</div>;
}

function MiniLine({ data, color, h=40 }) {
  if(!data||data.length<2) return null;
  const max=Math.max(...data), min=Math.min(...data), rng=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*100},${100-((v-min)/rng)*100}`).join(" ");
  const id=`lg${color.replace(/[^a-z0-9]/gi,"")}`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:"100%",height:h,display:"block"}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#${id})`}/>
    </svg>
  );
}

function KPI({ label, value, unit, sub, color, data }) {
  return (
    <Card style={{padding:16,overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:color,opacity:.8}}/>
      <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:2}}>
        <span style={{color:C.text,fontSize:26,fontWeight:700,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{value}</span>
        {unit&&<span style={{color:C.textMuted,fontSize:11}}>{unit}</span>}
      </div>
      {sub&&<div style={{color:C.textDim,fontSize:10,marginBottom:6}}>{sub}</div>}
      {data&&<MiniLine data={data} color={color} h={32}/>}
    </Card>
  );
}

// ─── MODULES ──────────────────────────────────────────────────────────────────

// LOGIN
function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("manager");
  const [email, setEmail] = useState("admin@twincore.io");
  const [pass, setPass] = useState("••••••••");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(role); }, 900);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{width:"100%",maxWidth:440,padding:20}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:56,height:56,background:`linear-gradient(135deg,${C.accent},${C.warm})`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 16px"}}>⬡</div>
          <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:22,letterSpacing:1}}>TWINCORE</div>
          <div style={{color:C.textMuted,fontSize:12,letterSpacing:3,textTransform:"uppercase"}}>Digital Twin Platform</div>
        </div>
        <Card style={{padding:32}}>
          <div style={{marginBottom:20}}>
            <div style={{color:C.textMuted,fontSize:11,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Sign in as</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {Object.entries(ROLES).map(([k,v])=>(
                <button key={k} onClick={()=>setRole(k)} style={{background:role===k?`${v.color}22`:C.bg,border:`1px solid ${role===k?v.color:C.border}`,borderRadius:8,padding:"10px 8px",cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
                  <div style={{fontSize:16,marginBottom:4}}>{v.icon}</div>
                  <div style={{color:role===k?v.color:C.textMuted,fontSize:11,fontWeight:role===k?700:400}}>{v.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{color:C.textMuted,fontSize:10,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Email</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{color:C.textMuted,fontSize:10,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Password</div>
            <input value={pass} onChange={e=>setPass(e.target.value)} type="password" style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",color:C.text,fontSize:13,outline:"none"}}/>
          </div>
          <button onClick={handleLogin} style={{width:"100%",background:`linear-gradient(135deg,${C.accent},${C.accent}BB)`,border:"none",borderRadius:8,padding:"13px",color:C.bg,fontSize:14,fontWeight:700,cursor:"pointer",opacity:loading?.6:1,transition:"opacity .2s"}}>
            {loading?"Authenticating…":"Sign In"}
          </button>
        </Card>
        <div style={{textAlign:"center",marginTop:16,color:C.textDim,fontSize:11}}>v2.1.0 · BIM-Linked Digital Twin · APS Integration</div>
      </div>
    </div>
  );
}

// BIM VIEWER
function BIMViewer({ assets, floor, onFloor, onSelect, selected }) {
  const floorAssets = assets.filter(a=>a.floor===floor);
  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {FLOORS.map(f=>(
          <button key={f} onClick={()=>{onFloor(f);onSelect(null);}} style={{background:floor===f?C.accent:C.surface,border:`1px solid ${floor===f?C.accent:C.border}`,color:floor===f?C.bg:C.textMuted,borderRadius:6,padding:"4px 10px",fontSize:10,fontFamily:"monospace",fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
            {f} <span style={{opacity:.6}}>{FLOOR_LABELS[f]?.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <div style={{position:"relative",width:"100%",paddingBottom:"55%",background:C.bg,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:16}}>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs><pattern id="gr" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke={C.border} strokeWidth=".2"/></pattern></defs>
          <rect width="100" height="100" fill="url(#gr)"/>
          <rect x="8" y="8" width="84" height="84" fill="none" stroke={C.borderBright} strokeWidth=".4" strokeDasharray="1.5,.8"/>
          <rect x="10" y="10" width="36" height="42" fill={`${C.accent}04`} stroke={C.borderBright} strokeWidth=".3"/>
          <rect x="48" y="10" width="44" height="26" fill={`${C.warm}04`} stroke={C.borderBright} strokeWidth=".3"/>
          <rect x="10" y="54" width="28" height="36" fill={`${C.green}04`} stroke={C.borderBright} strokeWidth=".3"/>
          <rect x="40" y="38" width="52" height="52" fill={`${C.accent}02`} stroke={C.borderBright} strokeWidth=".3"/>
          <text x="16" y="18" fontSize="2.8" fill={C.textDim} fontFamily="monospace">MECHANICAL</text>
          <text x="54" y="18" fontSize="2.8" fill={C.textDim} fontFamily="monospace">OFFICE A</text>
          <text x="13" y="62" fontSize="2.8" fill={C.textDim} fontFamily="monospace">LOBBY</text>
          <text x="52" y="46" fontSize="2.8" fill={C.textDim} fontFamily="monospace">OPEN PLAN</text>
          <text x="90" y="13" fontSize="3.5" fill={C.textMuted} fontFamily="monospace" textAnchor="middle">N</text>
          <line x1="90" y1="14" x2="90" y2="18" stroke={C.textMuted} strokeWidth=".4"/>
          <text x="4" y="5" fontSize="2.5" fill={C.textDim} fontFamily="monospace">BIM FL:{floor}</text>
        </svg>
        {floorAssets.map(a=>{
          const isSel=selected?.id===a.id;
          const col=statusColor[a.status];
          return (
            <button key={a.id} onClick={()=>onSelect(a)} style={{position:"absolute",left:`${a.x}%`,top:`${a.y}%`,transform:"translate(-50%,-50%)",background:isSel?col:`${col}22`,border:`1.5px solid ${col}`,borderRadius:5,padding:"3px 7px",cursor:"pointer",color:isSel?C.bg:col,fontSize:9,fontFamily:"monospace",fontWeight:700,boxShadow:`0 0 ${isSel?18:7}px ${col}${isSel?"99":"44"}`,transition:"all .2s",zIndex:2,whiteSpace:"nowrap",animation:a.status==="critical"?"blink 1.2s infinite":"none"}}>
              {typeIcon[a.type]||"●"} {a.name}
            </button>
          );
        })}
        {floorAssets.length===0&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.textDim,fontFamily:"monospace",fontSize:11}}>No assets on floor {floor}</div>}
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    </div>
  );
}

// ASSET DETAIL
function AssetDetail({ asset, onClose }) {
  if(!asset) return null;
  return (
    <Card style={{padding:20,position:"relative",marginBottom:16}}>
      <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"none",border:"none",color:C.textMuted,fontSize:18,cursor:"pointer"}}>✕</button>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16}}>
        <Dot status={asset.status} size={10}/>
        <div>
          <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:15}}>{asset.name}</div>
          <div style={{color:C.textMuted,fontSize:10}}>{asset.type} · {asset.id} · Floor {asset.floor}</div>
        </div>
        <div style={{marginLeft:"auto"}}><Chip label={asset.status} color={statusColor[asset.status]}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[["Brand",asset.brand],["Model",asset.model],["Installed",asset.yr],["Next PM",asset.pm]].map(([k,v])=>(
          <div key={k} style={{background:C.bg,borderRadius:6,padding:"7px 10px"}}>
            <div style={{color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{k}</div>
            <div style={{color:asset.pm==="OVERDUE"&&k==="Next PM"?C.red:C.text,fontSize:12,fontFamily:"monospace"}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{color:C.textMuted,fontSize:10}}>Health Score</span>
          <span style={{color:asset.health>75?C.green:asset.health>40?C.yellow:C.red,fontFamily:"monospace",fontWeight:700,fontSize:13}}>{asset.health}%</span>
        </div>
        <Bar v={asset.health}/>
      </div>
      {asset.rul&&<div style={{background:C.bg,borderRadius:6,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{color:C.textMuted,fontSize:10}}>Remaining Useful Life</span>
        <span style={{color:asset.rul<500?C.red:asset.rul<2000?C.yellow:C.green,fontFamily:"monospace",fontWeight:700}}>{asset.rul.toLocaleString()} hrs</span>
      </div>}
      {asset.temp!==null&&<div style={{background:C.bg,borderRadius:6,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:C.textMuted,fontSize:10}}>Live Temperature</span>
        <span style={{color:C.accent,fontFamily:"monospace",fontWeight:700,fontSize:16}}>{asset.temp}°C</span>
      </div>}
    </Card>
  );
}

// ENERGY MODULE
function EnergyModule() {
  const [metric, setMetric] = useState("energy");
  const metrics = { energy:{label:"Energy (kW)",color:C.accent,key:"energy"}, temp:{label:"Temp (°C)",color:C.warm,key:"temp"}, occ:{label:"Occupancy (%)",color:C.green,key:"occ"}, co2:{label:"CO₂ (ppm)",color:C.yellow,key:"co2"} };
  const m = metrics[metric];
  const vals = SENSOR_24H.map(d=>d[m.key]);
  const maxV = Math.max(...vals);
  const totalKwh = Math.round(SENSOR_24H.reduce((s,d)=>s+d.energy,0)/10);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <KPI label="Today's Usage" value={totalKwh} unit="kWh" color={C.accent} data={vals}/>
        <KPI label="Peak Demand" value="87.3" unit="kW" color={C.yellow}/>
        <KPI label="Carbon Output" value="42.1" unit="kg CO₂" color={C.green}/>
        <KPI label="Efficiency Score" value="B+" color={C.purple}/>
      </div>
      <Card style={{padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{color:C.text,fontWeight:600,fontSize:13}}>24-Hour Sensor Data</span>
          <div style={{display:"flex",gap:6}}>
            {Object.entries(metrics).map(([k,v])=>(
              <button key={k} onClick={()=>setMetric(k)} style={{background:metric===k?`${v.color}22`:C.bg,border:`1px solid ${metric===k?v.color:C.border}`,color:metric===k?v.color:C.textMuted,borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:3,height:110}}>
          {SENSOR_24H.map((d,i)=>(
            <div key={i} title={`${d.h}:00 — ${d[m.key]}`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}}>
              <div style={{width:"100%",background:`${m.color}${d[m.key]>maxV*.7?"BB":"55"}`,borderRadius:"2px 2px 0 0",height:`${(d[m.key]/maxV)*100}%`,minHeight:2,border:`1px solid ${m.color}33`,transition:"height .4s"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          {["00:00","06:00","12:00","18:00","23:00"].map(t=><span key={t} style={{color:C.textDim,fontSize:9,fontFamily:"monospace"}}>{t}</span>)}
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {label:"Lighting",val:28,color:C.yellow},
          {label:"HVAC",val:42,color:C.accent},
          {label:"IT Equipment",val:18,color:C.purple},
          {label:"Other",val:12,color:C.textMuted},
        ].map(s=>(
          <Card key={s.label} style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:C.textMuted,fontSize:11}}>{s.label}</span>
              <span style={{color:s.color,fontFamily:"monospace",fontWeight:700,fontSize:13}}>{s.val}%</span>
            </div>
            <Bar v={s.val} color={s.color}/>
          </Card>
        ))}
      </div>
    </div>
  );
}

// WORK ORDERS
function WorkOrdersModule({ role }) {
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const canCreate = ["manager","technician","iot"].includes(role);
  const filtered = filter==="all"?WORK_ORDERS:WORK_ORDERS.filter(w=>w.status===filter||w.priority===filter);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all","open","in-progress","urgent","completed"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?C.accentDim:C.surface,border:`1px solid ${filter===f?C.accent:C.border}`,color:filter===f?C.accent:C.textMuted,borderRadius:5,padding:"4px 10px",fontSize:10,cursor:"pointer",textTransform:"capitalize"}}>
              {f}
            </button>
          ))}
        </div>
        {canCreate&&<button onClick={()=>setShowNew(!showNew)} style={{background:C.warm,border:"none",borderRadius:7,padding:"7px 14px",color:C.bg,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ New WO</button>}
      </div>
      {showNew&&(
        <Card style={{padding:16,marginBottom:14,border:`1px solid ${C.warm}44`}}>
          <div style={{color:C.warm,fontFamily:"monospace",fontWeight:700,fontSize:12,marginBottom:12}}>CREATE WORK ORDER</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["Title","e.g. Filter replacement"],["Asset","e.g. AHU-01"],["Assigned To","e.g. J. Santos"],["Due Date","2026-06-01"]].map(([l,p])=>(
              <div key={l}>
                <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>{l}</div>
                <input placeholder={p} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"monospace",outline:"none"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{background:C.warm,border:"none",borderRadius:6,padding:"8px 16px",color:C.bg,fontWeight:700,fontSize:12,cursor:"pointer"}}>Create</button>
            <button onClick={()=>setShowNew(false)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 16px",color:C.textMuted,fontSize:12,cursor:"pointer"}}>Cancel</button>
          </div>
        </Card>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(wo=>(
          <Card key={wo.id} style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{color:C.textDim,fontFamily:"monospace",fontSize:10}}>{wo.id}</span>
                <Chip label={wo.priority} color={priorityColor[wo.priority]}/>
              </div>
              <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:4}}>{wo.title}</div>
              <div style={{color:C.textMuted,fontSize:10}}>Asset: <span style={{color:C.accent}}>{wo.asset}</span> · {wo.assigned} · Due {wo.due} · Est. {wo.est}h</div>
            </div>
            <Chip label={wo.status.replace("-"," ")} color={woStatusColor[wo.status]}/>
          </Card>
        ))}
      </div>
    </div>
  );
}

// IOT ALERTS
function IoTModule({ role }) {
  const [rules, setRules] = useState(ALERT_RULES);
  const canEdit = ["iot","manager"].includes(role);
  const toggle = (id) => setRules(r=>r.map(x=>x.id===id?{...x,active:!x.active}:x));
  const sevColor = { urgent:C.red, high:C.yellow, normal:C.accent, low:C.textMuted };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        <KPI label="Active Rules" value={rules.filter(r=>r.active).length} unit="rules" color={C.accent}/>
        <KPI label="Triggered Now" value={rules.filter(r=>r.triggered&&r.active).length} unit="alerts" color={C.red}/>
        <KPI label="All Rules" value={rules.length} unit="total" color={C.textMuted}/>
      </div>
      <Card style={{marginBottom:16,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.text,fontWeight:600,fontSize:13}}>Alert Rules Engine</span>
          {canEdit&&<button style={{background:C.accent,border:"none",borderRadius:5,padding:"5px 12px",color:C.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add Rule</button>}
        </div>
        {rules.map((r,i)=>(
          <div key={r.id} style={{padding:"12px 16px",borderTop:i?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",gap:12,opacity:r.active?1:.5,transition:"opacity .2s"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                {r.triggered&&r.active&&<span style={{width:7,height:7,borderRadius:"50%",background:C.red,boxShadow:`0 0 8px ${C.red}`,display:"inline-block",animation:"blink 1s infinite"}}/>}
                <span style={{color:C.text,fontSize:13,fontWeight:600}}>{r.name}</span>
                <Chip label={r.severity} color={sevColor[r.severity]}/>
              </div>
              <div style={{color:C.textMuted,fontSize:10}}>
                Asset: <span style={{color:C.accent,fontFamily:"monospace"}}>{r.asset}</span> · {r.metric} {r.op} {r.threshold} · {r.triggered&&r.active?<span style={{color:C.red}}>TRIGGERED</span>:<span style={{color:C.green}}>OK</span>}
              </div>
            </div>
            {canEdit&&(
              <div onClick={()=>toggle(r.id)} style={{width:36,height:20,background:r.active?C.green:C.border,borderRadius:10,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:r.active?16:2,width:16,height:16,background:C.bg,borderRadius:"50%",transition:"left .2s"}}/>
              </div>
            )}
          </div>
        ))}
      </Card>
      <Card style={{padding:16}}>
        <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:12}}>Live Sensor Feed</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[
            {label:"Temp L2",val:"21.0°C",color:C.accent,ok:true},
            {label:"Temp L3",val:"23.8°C",color:C.yellow,ok:false},
            {label:"CO₂ L1",val:"748 ppm",color:C.green,ok:true},
            {label:"Humidity",val:"54%",color:C.accent,ok:true},
            {label:"Pressure",val:"101.3 kPa",color:C.green,ok:true},
            {label:"Occupancy",val:"73%",color:C.yellow,ok:true},
          ].map(s=>(
            <div key={s.label} style={{background:C.bg,borderRadius:7,padding:"10px 12px",borderLeft:`2px solid ${s.color}`}}>
              <div style={{color:C.textMuted,fontSize:9,marginBottom:4}}>{s.label}</div>
              <div style={{color:s.color,fontFamily:"monospace",fontWeight:700,fontSize:15}}>{s.val}</div>
              <div style={{color:s.ok?C.green:C.yellow,fontSize:9}}>{s.ok?"● Normal":"▲ Warning"}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ARCHITECTURE MODULE
function ArchitectureModule() {
  const layers = [
    { label:"Presentation Layer", color:C.accent, items:["Web App (Next.js 15)","Mobile App (React Native)","AR/VR Interface","Admin Portal","Tenant Portal"] },
    { label:"API Gateway & Auth", color:C.green, items:["REST / GraphQL API","WebSocket (real-time)","JWT + RBAC Auth","Rate Limiting","API Versioning"] },
    { label:"Core Services", color:C.warm, items:["BIM Engine (APS/IFC.js)","Digital Twin Sync","Asset Registry","Work Order Engine","Analytics & ML","Predictive Maintenance"] },
    { label:"Integration Layer", color:C.yellow, items:["IoT Hub (MQTT/AMQP)","BACnet/Modbus Gateway","ERP Connector","GIS / Mapping","CMMS Sync","Weather API"] },
    { label:"Data Layer", color:C.purple, items:["Time-Series (InfluxDB)","Asset DB (PostgreSQL+PostGIS)","BIM Storage (IFC/NWD/RVT)","Doc Store (S3)","Cache (Redis)","Search (Elasticsearch)"] },
  ];
  const stack = [
    ["BIM Engine","Autodesk APS · IFC.js · xeokit"],
    ["Frontend","Next.js 15 · React Native · Three.js"],
    ["IoT Platform","AWS IoT Core · MQTT 5 · Node-RED"],
    ["Time-Series DB","InfluxDB 2.x · TimescaleDB"],
    ["Asset Database","PostgreSQL 16 + PostGIS"],
    ["Messaging","RabbitMQ · Apache Kafka"],
    ["Auth","Keycloak · Auth0 (RBAC/ABAC)"],
    ["Deployment","Docker · Kubernetes · Helm"],
    ["Observability","Grafana · Prometheus · Loki"],
    ["AI / ML","Python · scikit-learn · FastAPI"],
  ];
  return (
    <div>
      <div style={{color:C.textMuted,fontSize:12,marginBottom:16,lineHeight:1.7}}>Reference architecture — 5-layer platform from IoT edge through BIM engine to presentation. Each layer communicates via async events and REST/GraphQL APIs.</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {layers.map((l,i)=>(
          <Card key={l.label} style={{padding:"14px 16px",borderLeft:`3px solid ${l.color}`,border:`1px solid ${l.color}22`,borderLeftWidth:3}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:l.color}}/>
              <span style={{color:l.color,fontFamily:"monospace",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>L{layers.length-i} · {l.label}</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {l.items.map(item=><span key={item} style={{background:`${l.color}11`,border:`1px solid ${l.color}33`,color:C.text,borderRadius:4,padding:"2px 10px",fontSize:10,fontFamily:"monospace"}}>{item}</span>)}
            </div>
            {i<layers.length-1&&<div style={{color:C.textDim,fontSize:9,marginTop:8,textAlign:"center"}}>↓ API Events / Streams / WebSocket ↓</div>}
          </Card>
        ))}
      </div>
      <Card style={{padding:16}}>
        <div style={{color:C.warm,fontFamily:"monospace",fontWeight:700,fontSize:11,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Recommended Tech Stack</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {stack.map(([k,v])=>(
            <div key={k} style={{background:C.bg,borderRadius:6,padding:"8px 10px"}}>
              <div style={{color:C.textDim,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:.5}}>{k}</div>
              <div style={{color:C.accent,fontSize:11,fontFamily:"monospace"}}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// EXECUTIVE DASHBOARD
function ExecutiveDashboard() {
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <KPI label="Asset Portfolio" value="10" unit="assets" color={C.accent} data={[8,8,9,9,9,10,10]}/>
        <KPI label="Overall Health" value="81" unit="%" color={C.green} data={[75,78,79,80,80,81,81]}/>
        <KPI label="Open WOs" value="4" unit="orders" color={C.yellow} data={[6,5,5,4,4,4,4]}/>
        <KPI label="Monthly Savings" value="$14K" color={C.purple}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Card style={{padding:16}}>
          <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:12}}>Asset Health Distribution</div>
          {[{label:"Excellent (90–100%)",count:4,color:C.green},{label:"Good (70–89%)",count:3,color:C.accent},{label:"Fair (40–69%)",count:2,color:C.yellow},{label:"Critical (<40%)",count:1,color:C.red}].map(s=>(
            <div key={s.label} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:C.textMuted,fontSize:11}}>{s.label}</span>
                <span style={{color:s.color,fontFamily:"monospace",fontSize:12,fontWeight:700}}>{s.count}</span>
              </div>
              <Bar v={s.count*10} color={s.color}/>
            </div>
          ))}
        </Card>
        <Card style={{padding:16}}>
          <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:12}}>Maintenance Spend YTD</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[{m:"Jan",v:22},{m:"Feb",v:18},{m:"Mar",v:31},{m:"Apr",v:25},{m:"May",v:14}].map(d=>(
              <div key={d.m} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:C.textMuted,fontSize:10,width:24,fontFamily:"monospace"}}>{d.m}</span>
                <div style={{flex:1,height:18,background:C.bg,borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${(d.v/35)*100}%`,height:"100%",background:`${C.warm}88`,borderRadius:3}}/>
                </div>
                <span style={{color:C.warm,fontSize:11,fontFamily:"monospace",width:36,textAlign:"right"}}>${d.v}K</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{padding:16}}>
        <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:12}}>Predictive Maintenance Forecast</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[
            {name:"PUMP-02",risk:"Replace",due:"Now",color:C.red},
            {name:"ELEV-01",risk:"Inspect",due:"Jun 1",color:C.yellow},
            {name:"FCU-L3-02",risk:"Service",due:"Jun 5",color:C.yellow},
            {name:"AHU-01",risk:"Filter",due:"Jul 12",color:C.accent},
            {name:"BMS-CTRL",risk:"Update",due:"Sep 1",color:C.green},
            {name:"GEN-01",risk:"Test",due:"Nov",color:C.green},
          ].map(p=>(
            <div key={p.name} style={{background:C.bg,borderRadius:7,padding:"10px 12px",borderLeft:`2px solid ${p.color}`}}>
              <div style={{color:C.text,fontWeight:700,fontSize:12,fontFamily:"monospace"}}>{p.name}</div>
              <div style={{color:p.color,fontSize:10}}>{p.risk}</div>
              <div style={{color:C.textMuted,fontSize:9}}>Due: {p.due}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// MOBILE LAYOUT
function MobileView({ role, onBack }) {
  const [tab, setTab] = useState("home");
  const tabs = [{id:"home",icon:"⌂",label:"Home"},{id:"assets",icon:"◈",label:"Assets"},{id:"orders",icon:"⊡",label:"Orders"},{id:"alerts",icon:"⊛",label:"Alerts"}];
  const criticalCount = ASSETS.filter(a=>a.status==="critical").length;
  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",maxWidth:390,margin:"0 auto",position:"relative",border:`1px solid ${C.border}`}}>
      <div style={{background:C.surface,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,background:`linear-gradient(135deg,${C.accent},${C.warm})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⬡</div>
        <div style={{flex:1}}>
          <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:13}}>TWINCORE Mobile</div>
          <div style={{color:C.textMuted,fontSize:9}}>{ROLES[role].icon} {ROLES[role].label}</div>
        </div>
        <button onClick={onBack} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",color:C.textMuted,fontSize:10,cursor:"pointer"}}>← Web</button>
      </div>
      <div style={{padding:16,paddingBottom:80}}>
        {tab==="home"&&<div>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Facility Overview</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:12,borderTop:`2px solid ${C.green}`}}><div style={{color:C.textMuted,fontSize:9,marginBottom:4}}>OPERATIONAL</div><div style={{color:C.green,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{ASSETS.filter(a=>a.status==="operational").length}</div></div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:12,borderTop:`2px solid ${C.red}`}}><div style={{color:C.textMuted,fontSize:9,marginBottom:4}}>CRITICAL</div><div style={{color:C.red,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{criticalCount}</div></div>
          </div>
          {ASSETS.filter(a=>a.status!=="operational"||a.health<70).slice(0,4).map(a=>(
            <div key={a.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
              <Dot status={a.status} size={8}/>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:13,fontWeight:600}}>{a.name}</div>
                <div style={{color:C.textMuted,fontSize:10}}>{a.type} · Floor {a.floor}</div>
              </div>
              <div style={{textAlign:"right"}}><div style={{color:a.health>75?C.green:a.health>40?C.yellow:C.red,fontFamily:"monospace",fontWeight:700,fontSize:13}}>{a.health}%</div><div style={{color:C.textDim,fontSize:9}}>Health</div></div>
            </div>
          ))}
        </div>}
        {tab==="assets"&&<div>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>All Assets</div>
          {ASSETS.map(a=>(
            <div key={a.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Dot status={a.status}/><span style={{color:C.text,fontWeight:600,fontSize:13}}>{a.name}</span><span style={{marginLeft:"auto"}}><Chip label={a.status} color={statusColor[a.status]}/></span></div>
              <div style={{display:"flex",gap:10,marginBottom:6}}><span style={{color:C.textMuted,fontSize:10}}>{a.type}</span><span style={{color:C.textMuted,fontSize:10}}>·</span><span style={{color:C.textMuted,fontSize:10}}>Floor {a.floor}</span></div>
              <Bar v={a.health}/>
            </div>
          ))}
        </div>}
        {tab==="orders"&&<div>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Work Orders</div>
          {WORK_ORDERS.slice(0,5).map(wo=>(
            <div key={wo.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",gap:8,marginBottom:4}}><Chip label={wo.priority} color={priorityColor[wo.priority]}/><Chip label={wo.status.replace("-"," ")} color={woStatusColor[wo.status]}/></div>
              <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:2}}>{wo.title}</div>
              <div style={{color:C.textMuted,fontSize:10}}>{wo.asset} · Due {wo.due}</div>
            </div>
          ))}
        </div>}
        {tab==="alerts"&&<div>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Active Alerts</div>
          {ALERT_RULES.filter(r=>r.triggered&&r.active).map(r=>(
            <div key={r.id} style={{background:C.surface,border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 12px",marginBottom:8,borderLeft:`3px solid ${C.red}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{width:7,height:7,borderRadius:"50%",background:C.red,display:"inline-block"}}/><span style={{color:C.red,fontSize:11,fontWeight:700}}>TRIGGERED</span></div>
              <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:2}}>{r.name}</div>
              <div style={{color:C.textMuted,fontSize:10}}>{r.asset} · {r.metric} {r.op} {r.threshold}</div>
            </div>
          ))}
        </div>}
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:390,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",padding:"10px 0",cursor:"pointer",color:tab===t.id?C.accent:C.textMuted,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span style={{fontSize:9,fontFamily:"monospace"}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [floor, setFloor] = useState("L1");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [mobileView, setMobileView] = useState(false);
  const [time, setTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  if(!auth) return <LoginScreen onLogin={setAuth}/>;
  if(mobileView) return <MobileView role={auth} onBack={()=>setMobileView(false)}/>;

  const role = auth;
  const critical = ASSETS.filter(a=>a.status==="critical").length;
  const warning = ASSETS.filter(a=>a.status==="warning").length;

  const TABS = [
    { id:"dashboard", icon:"⬡", label:"BIM Viewer",  roles:["manager","technician","iot","executive","tenant"] },
    { id:"energy",    icon:"⚡", label:"Energy",      roles:["manager","iot","executive"] },
    { id:"workorders",icon:"⊡", label:"Work Orders", roles:["manager","technician"] },
    { id:"iot",       icon:"◈", label:"IoT / Alerts",roles:["iot","manager"] },
    { id:"executive", icon:"📊", label:"Executive",   roles:["executive","manager"] },
    { id:"arch",      icon:"∑",  label:"Architecture",roles:["iot","manager","executive"] },
  ].filter(t=>t.roles.includes(role));

  if(!TABS.find(t=>t.id===tab)) setTab(TABS[0].id);

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.text}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}button{cursor:pointer}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.fi{animation:fadeIn .3s ease forwards}`}</style>

      {/* HEADER */}
      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:30,height:30,background:`linear-gradient(135deg,${C.accent},${C.warm})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⬡</div>
          <div>
            <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:14,letterSpacing:.5}}>TWINCORE</div>
            <div style={{color:C.textDim,fontSize:8,letterSpacing:2,textTransform:"uppercase"}}>Digital Twin Platform</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {critical>0&&<div style={{display:"flex",alignItems:"center",gap:5,background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,padding:"3px 10px"}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:C.red,display:"inline-block"}}/>
            <span style={{color:C.red,fontSize:10,fontFamily:"monospace"}}>{critical} CRITICAL</span>
          </div>}
          {warning>0&&<div style={{display:"flex",alignItems:"center",gap:5,background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:6,padding:"3px 10px"}}>
            <span style={{color:C.yellow,fontSize:10,fontFamily:"monospace"}}>▲ {warning} WARNING</span>
          </div>}
          <button onClick={()=>setMobileView(true)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",color:C.textMuted,fontSize:10}}>📱 Mobile</button>
          <div style={{color:C.textMuted,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{time.toLocaleTimeString()}</div>
          <div style={{display:"flex",alignItems:"center",gap:7,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px"}}>
            <span>{ROLES[role].icon}</span>
            <span style={{color:C.textMuted,fontSize:11}}>{ROLES[role].label}</span>
            <button onClick={()=>setAuth(null)} style={{background:"none",border:"none",color:C.textDim,fontSize:11,marginLeft:4}}>↩</button>
          </div>
        </div>
      </header>

      {/* TAB NAV */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",color:tab===t.id?C.accent:C.textMuted,borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`,padding:"11px 14px",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500,transition:"all .2s",display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:12}}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <main style={{padding:20,maxWidth:1200,margin:"0 auto"}} key={tab}>
        <div className="fi">
          {tab==="dashboard"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
              <KPI label="Operational" value={ASSETS.filter(a=>a.status==="operational").length} color={C.green} data={[6,6,7,7,7,7,7]}/>
              <KPI label="Warnings"    value={warning} color={C.yellow} data={[1,2,1,1,2,2,2]}/>
              <KPI label="Critical"    value={critical} color={C.red} data={[0,1,1,0,1,1,1]}/>
              <KPI label="Open WOs"    value={WORK_ORDERS.filter(w=>w.status==="open"||w.status==="in-progress").length} color={C.warm} data={[3,4,4,3,4,3,2]}/>
            </div>
            <BIMViewer assets={ASSETS} floor={floor} onFloor={setFloor} onSelect={setSelectedAsset} selected={selectedAsset}/>
            {selectedAsset&&<AssetDetail asset={selectedAsset} onClose={()=>setSelectedAsset(null)}/>}
            <Card style={{overflow:"hidden"}}>
              <div style={{padding:"11px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:C.text,fontWeight:700,fontSize:13}}>Asset Registry</span>
                <span style={{color:C.textDim,fontSize:10}}>{ASSETS.length} assets</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:C.bg}}>
                    {["ID","Name","Type","Floor","Status","Health","RUL","Next PM"].map(h=><th key={h} style={{padding:"7px 12px",textAlign:"left",color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {ASSETS.map(a=>(
                      <tr key={a.id} onClick={()=>{setFloor(a.floor);setSelectedAsset(a);}} style={{borderTop:`1px solid ${C.border}`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"9px 12px",color:C.textDim,fontFamily:"monospace",fontSize:10}}>{a.id}</td>
                        <td style={{padding:"9px 12px",color:C.text,fontWeight:600,fontSize:12}}>{a.name}</td>
                        <td style={{padding:"9px 12px",color:C.textMuted,fontSize:11}}>{a.type}</td>
                        <td style={{padding:"9px 12px",color:C.textMuted,fontFamily:"monospace",fontSize:10}}>{a.floor}</td>
                        <td style={{padding:"9px 12px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><Dot status={a.status}/><span style={{fontSize:10,color:C.textMuted,textTransform:"capitalize"}}>{a.status}</span></div></td>
                        <td style={{padding:"9px 12px",minWidth:80}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1}}><Bar v={a.health}/></div><span style={{color:C.textMuted,fontSize:9,fontFamily:"monospace"}}>{a.health}%</span></div></td>
                        <td style={{padding:"9px 12px",color:a.rul&&a.rul<500?C.red:a.rul&&a.rul<2000?C.yellow:C.textMuted,fontSize:10,fontFamily:"monospace"}}>{a.rul?a.rul.toLocaleString()+"h":"—"}</td>
                        <td style={{padding:"9px 12px",color:a.pm==="OVERDUE"?C.red:C.textMuted,fontSize:10,fontFamily:"monospace"}}>{a.pm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>}
          {tab==="energy"&&<EnergyModule/>}
          {tab==="workorders"&&<WorkOrdersModule role={role}/>}
          {tab==="iot"&&<IoTModule role={role}/>}
          {tab==="executive"&&<ExecutiveDashboard/>}
          {tab==="arch"&&<ArchitectureModule/>}
        </div>
      </main>
    </div>
  );
}
