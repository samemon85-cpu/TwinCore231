import { useState, useEffect, useRef, useCallback } from "react";

// ── TOKENS ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#050810",surface:"#090F1E",surfaceAlt:"#0D1528",
  border:"#131E33",borderBright:"#1A3050",borderAccent:"#1E4A70",
  accent:"#00CFFF",accentDim:"#00CFFF18",warm:"#FF5522",warmDim:"#FF552218",
  green:"#00F07A",greenDim:"#00F07A18",yellow:"#FFBC00",yellowDim:"#FFBC0018",
  red:"#FF2D55",redDim:"#FF2D5518",purple:"#A855F7",purpleDim:"#A855F718",
  teal:"#00D4B4",pink:"#FF6EB4",
  text:"#D8EFFF",textMuted:"#4A7090",textDim:"#1E3A55",
};

// ── SHARED DATA ───────────────────────────────────────────────────────────────
const ASSETS = [
  {id:"A001",name:"AHU-01",   type:"HVAC",    floor:"L1",x:16,y:24,status:"operational",health:94,rul:2847,temp:18.2,pm:"2026-07-12",brand:"Carrier",model:"39HQ",yr:2020,pos:[0,1.2,0]},
  {id:"A002",name:"ELEV-01",  type:"Elevator",floor:"GF",x:48,y:54,status:"warning",    health:67,rul:892, temp:null, pm:"2026-05-30",brand:"Otis",   model:"Gen2",yr:2018,pos:[2,0,0]},
  {id:"A003",name:"CHILLER-01",type:"Cooling",floor:"B1",x:28,y:42,status:"operational",health:88,rul:5210,temp:6.5,  pm:"2026-06-20",brand:"Trane",  model:"CGAX",yr:2019,pos:[-2,-.8,1]},
  {id:"A004",name:"PUMP-02",  type:"Plumbing",floor:"B1",x:63,y:37,status:"critical",   health:31,rul:124, temp:null, pm:"OVERDUE",   brand:"Grundfos",model:"CM5",yr:2017,pos:[1,-.8,-1]},
  {id:"A005",name:"FCU-L2-04",type:"HVAC",    floor:"L2",x:71,y:26,status:"operational",health:99,rul:8930,temp:21.0, pm:"2026-08-01",brand:"Daikin", model:"FWB",yr:2023,pos:[-1,0.8,1]},
  {id:"A006",name:"GEN-01",   type:"Power",   floor:"B2",x:78,y:62,status:"standby",    health:100,rul:null,temp:null,pm:"2026-07-15",brand:"Cummins",model:"C150",yr:2021,pos:[2.5,-.8,0]},
  {id:"A007",name:"FIRE-SYS", type:"Safety",  floor:"L1",x:55,y:17,status:"operational",health:100,rul:null,temp:null,pm:"2026-10-30",brand:"Notifier",model:"NFS2",yr:2020,pos:[0,1.2,2]},
  {id:"A008",name:"BMS-CTRL", type:"Controls",floor:"L3",x:34,y:68,status:"operational",health:82, rul:3400,temp:null, pm:"2026-09-01",brand:"Siemens",model:"Desigo",yr:2022,pos:[-1.5,2,0]},
  {id:"A009",name:"FCU-L3-02",type:"HVAC",    floor:"L3",x:22,y:42,status:"warning",    health:58, rul:610, temp:23.8, pm:"2026-05-28",brand:"Daikin", model:"FWB080",yr:2019,pos:[0.5,2,1.5]},
];

const statusColor={operational:C.green,warning:C.yellow,critical:C.red,standby:C.textMuted};
const priorityColor={urgent:C.red,high:C.yellow,normal:C.accent,low:C.textMuted};

// ── PRIMITIVES ────────────────────────────────────────────────────────────────
const Dot=({status,size=8})=><span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:statusColor[status]||C.textMuted,flexShrink:0,boxShadow:status==="critical"?`0 0 7px ${C.red}`:""}} />;
const Bar=({v,color})=>{const c=color||(v>75?C.green:v>40?C.yellow:C.red);return<div style={{width:"100%",height:3,background:C.border,borderRadius:2}}><div style={{width:`${v}%`,height:"100%",background:c,borderRadius:2,transition:"width .5s"}}/></div>;};
const Chip=({label,color})=><span style={{background:`${color||C.textMuted}22`,color:color||C.textMuted,border:`1px solid ${color||C.textMuted}33`,borderRadius:4,padding:"2px 8px",fontSize:9,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{label}</span>;
const Card=({children,style={},onClick})=><div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,...style}}>{children}</div>;

function KPI({label,value,unit,color,delta}){
  return(
    <Card style={{padding:16,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:color}}/>
      <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
        <span style={{color:C.text,fontSize:24,fontWeight:700,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{value}</span>
        {unit&&<span style={{color:C.textMuted,fontSize:10}}>{unit}</span>}
      </div>
      {delta&&<div style={{color:delta>0?C.green:C.red,fontSize:10,marginTop:3}}>{delta>0?"▲":"▼"} {Math.abs(delta)}% vs last month</div>}
    </Card>
  );
}

// ── 3D BIM VIEWER (Canvas-based, no external deps) ────────────────────────────
function BIM3DViewer({assets,onSelect,selected}){
  const canvasRef=useRef(null);
  const stateRef=useRef({rotX:0.4,rotY:0.5,dragging:false,lx:0,ly:0,zoom:1,hovered:null,frame:0});
  const animRef=useRef(null);

  const project=(x,y,z,W,H,zoom)=>{
    const s=stateRef.current;
    // Rotate Y
    const cosY=Math.cos(s.rotY), sinY=Math.sin(s.rotY);
    const x1=x*cosY+z*sinY, z1=-x*sinY+z*cosY;
    // Rotate X
    const cosX=Math.cos(s.rotX), sinX=Math.sin(s.rotX);
    const y1=y*cosX-z1*sinX, z2=y*sinX+z1*cosX;
    const fov=4.5*zoom, px=x1/z2*fov, py=y1/z2*fov;
    return [W/2+px*(W/2*0.6), H/2-py*(H/2*0.6), z2];
  };

  const draw=useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const W=canvas.width, H=canvas.height;
    const s=stateRef.current;
    s.frame++;

    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

    // Draw grid
    ctx.strokeStyle=C.border+"88"; ctx.lineWidth=0.5;
    for(let i=-4;i<=4;i++){
      const [ax,ay]=project(i,0,-4,W,H,s.zoom);
      const [bx,by]=project(i,0,4,W,H,s.zoom);
      const [cx,cy]=project(-4,0,i,W,H,s.zoom);
      const [dx,dy]=project(4,0,i,W,H,s.zoom);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(dx,dy); ctx.stroke();
    }

    // Draw building outline floors
    const floors=[-0.8,0,0.8,1.6,2.4];
    floors.forEach(fy=>{
      const corners=[[-2.5,fy,-1.5],[2.5,fy,-1.5],[2.5,fy,2],[−2.5,fy,2]];
      ctx.strokeStyle=C.borderBright+"66"; ctx.lineWidth=0.8;
      ctx.beginPath();
      corners.forEach((c,i)=>{
        const [px,py,pz]=project(c[0],c[1],c[2],W,H,s.zoom);
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.closePath(); ctx.stroke();
    });

    // Draw vertical edges
    [[-2.5,-2],[2.5,-1.5],[-2.5,2],[2.5,2]].forEach(([ex,ez])=>{
      const [ax,ay]=project(ex,-0.8,ez,W,H,s.zoom);
      const [bx,by]=project(ex,2.4,ez,W,H,s.zoom);
      ctx.strokeStyle=C.borderBright+"99"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    });

    // Draw axes
    const axData=[[1,0,0,C.red,"X"],[0,1,0,C.green,"Y"],[0,0,1,C.accent,"Z"]];
    axData.forEach(([ax,ay,az,col,lbl])=>{
      const [ox,oy]=project(-3.5,-1,-3,W,H,s.zoom);
      const [ex,ey]=project(-3.5+ax,-1+ay,-3+az,W,H,s.zoom);
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.fillStyle=col; ctx.font="bold 10px 'DM Mono',monospace"; ctx.fillText(lbl,ex+3,ey-3);
    });

    // Draw assets — collect with depth for sorting
    const assetDrawList=assets.map(a=>{
      const p=a.pos||[0,0,0];
      const [px,py,pz]=project(p[0],p[1],p[2],W,H,s.zoom);
      return {a,px,py,pz};
    }).sort((a,b)=>b.pz-a.pz);

    assetDrawList.forEach(({a,px,py})=>{
      const isSel=selected?.id===a.id;
      const isHov=s.hovered===a.id;
      const col=statusColor[a.status]||C.textMuted;
      const sz=(isSel?28:isHov?24:20);
      const pulse=Math.sin(s.frame*0.08)*0.3+0.7;

      // Glow
      if(isSel||a.status==="critical"){
        const g=ctx.createRadialGradient(px,py,0,px,py,sz*2);
        g.addColorStop(0,col+(isSel?"55":"33")); g.addColorStop(1,"transparent");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(px,py,sz*2,0,Math.PI*2); ctx.fill();
      }

      // Shadow line to grid
      const [gx,gy]=project(a.pos[0],0,a.pos[2],W,H,s.zoom);
      ctx.strokeStyle=col+"33"; ctx.lineWidth=0.5; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(gx,gy); ctx.stroke();
      ctx.setLineDash([]);

      // Box shape
      ctx.fillStyle=isSel?col:`${col}33`;
      ctx.strokeStyle=col; ctx.lineWidth=isSel?2:1.2;
      const r=6;
      ctx.beginPath();
      ctx.roundRect(px-sz/2,py-sz/2,sz,sz,r);
      ctx.fill(); ctx.stroke();

      // Icon char
      const icons={HVAC:"◈",Elevator:"⊡",Cooling:"❄",Plumbing:"⊙",Power:"⚡",Safety:"⊛",Controls:"⬡"};
      ctx.fillStyle=isSel?C.bg:col;
      ctx.font=`bold ${isSel?12:10}px 'DM Sans',sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(icons[a.type]||"●",px,py);

      // Label
      ctx.fillStyle=isSel?C.text:col;
      ctx.font=`${isSel?"bold ":""}10px 'DM Mono',monospace`;
      ctx.textAlign="center"; ctx.textBaseline="top";
      ctx.fillText(a.name,px,py+sz/2+4);

      // Status pulse dot
      if(a.status==="critical"){
        ctx.fillStyle=`rgba(255,45,85,${pulse})`;
        ctx.beginPath(); ctx.arc(px+sz/2-4,py-sz/2+4,4,0,Math.PI*2); ctx.fill();
      }
    });

    // HUD
    ctx.fillStyle=C.textMuted; ctx.font="9px 'DM Mono',monospace"; ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillText(`3D BIM VIEW  ·  ROT(${s.rotY.toFixed(2)}, ${s.rotX.toFixed(2)})  ·  ZOOM ${s.zoom.toFixed(1)}x`,12,12);
    ctx.fillText(`ASSETS: ${assets.length}  ·  DRAG to rotate  ·  WHEEL to zoom  ·  CLICK to select`,12,26);
    ctx.textAlign="right";
    ctx.fillText("TWINCORE BIM ENGINE v2.1",W-12,12);

    animRef.current=requestAnimationFrame(draw);
  },[assets,selected]);

  useEffect(()=>{
    animRef.current=requestAnimationFrame(draw);
    return()=>{if(animRef.current) cancelAnimationFrame(animRef.current);};
  },[draw]);

  const getHit=(mx,my,W,H)=>{
    const s=stateRef.current;
    let best=null, bestD=Infinity;
    assets.forEach(a=>{
      const [px,py]=project(a.pos[0],a.pos[1],a.pos[2],W,H,s.zoom);
      const d=Math.hypot(mx-px,my-py);
      if(d<20&&d<bestD){bestD=d;best=a;}
    });
    return best;
  };

  const onMouseDown=e=>{
    const r=canvasRef.current.getBoundingClientRect();
    stateRef.current.dragging=true;
    stateRef.current.lx=e.clientX-r.left;
    stateRef.current.ly=e.clientY-r.top;
  };
  const onMouseMove=e=>{
    const s=stateRef.current;
    const r=canvasRef.current.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const hit=getHit(mx,my,r.width,r.height);
    s.hovered=hit?.id||null;
    canvasRef.current.style.cursor=hit?"pointer":"grab";
    if(s.dragging){
      s.rotY+=(mx-s.lx)*0.008;
      s.rotX+=(my-s.ly)*0.006;
      s.rotX=Math.max(-1.2,Math.min(1.2,s.rotX));
      s.lx=mx; s.ly=my;
    }
  };
  const onMouseUp=e=>{
    const s=stateRef.current;
    if(!s.dragging) return; s.dragging=false;
    const r=canvasRef.current.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const hit=getHit(mx,my,r.width,r.height);
    if(hit&&Math.hypot(mx-s.lx,my-s.ly)<3) onSelect(hit);
  };
  const onWheel=e=>{
    e.preventDefault();
    stateRef.current.zoom=Math.max(.5,Math.min(3,stateRef.current.zoom-e.deltaY*0.001));
  };

  useEffect(()=>{
    const el=canvasRef.current;
    el.addEventListener("wheel",onWheel,{passive:false});
    return()=>el.removeEventListener("wheel",onWheel);
  },[]);

  return(
    <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:`1px solid ${C.borderBright}`,background:C.bg}}>
      <canvas ref={canvasRef} width={860} height={440} style={{width:"100%",height:"auto",display:"block"}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={()=>{stateRef.current.dragging=false;}} />
      <div style={{position:"absolute",top:8,right:8,display:"flex",gap:6}}>
        {["Top","Front","Iso"].map(v=>(
          <button key={v} onClick={()=>{
            stateRef.current.rotX=v==="Top"?1.4:v==="Front"?0:0.4;
            stateRef.current.rotY=v==="Iso"?0.5:0;
          }} style={{background:`${C.surface}CC`,border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:5,padding:"3px 8px",fontSize:9,fontFamily:"monospace",cursor:"pointer"}}>
            {v}
          </button>
        ))}
      </div>
      <div style={{position:"absolute",bottom:8,left:8,display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.entries(statusColor).map(([s,c])=>(
          <div key={s} style={{display:"flex",alignItems:"center",gap:4,background:`${C.surface}CC`,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 7px"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block"}}/>
            <span style={{color:C.textMuted,fontSize:9,fontFamily:"monospace",textTransform:"capitalize"}}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── API SCHEMA (OpenAPI-style explorer) ────────────────────────────────────────
const API_ENDPOINTS=[
  {method:"GET",path:"/api/v1/assets",tag:"Assets",desc:"List all assets with filtering, pagination, and BIM metadata",params:["floor","status","type","page","limit"],resp:{total:10,assets:[{id:"A001",name:"AHU-01",status:"operational",health:94,floor:"L1"}]}},
  {method:"GET",path:"/api/v1/assets/:id",tag:"Assets",desc:"Get single asset with full BIM properties, sensor history, and work order links",params:["id"],resp:{id:"A001",name:"AHU-01",health:94,rul:2847,sensors:[{ts:"2026-05-24T10:00",temp:18.2}]}},
  {method:"PATCH",path:"/api/v1/assets/:id",tag:"Assets",desc:"Update asset metadata, health override, or maintenance status",params:["id"],body:{health:92,notes:"Post-service update"},resp:{updated:true}},
  {method:"GET",path:"/api/v1/sensors/stream",tag:"IoT",desc:"WebSocket endpoint — real-time sensor telemetry stream (MQTT bridge)",params:["assetId","metrics"],resp:{type:"telemetry",assetId:"A001",ts:"2026-05-24T10:00:01Z",temp:18.3,energy:52.1}},
  {method:"POST",path:"/api/v1/alerts/rules",tag:"IoT",desc:"Create a new alert rule with threshold conditions and notification targets",params:[],body:{assetId:"A004",metric:"health",operator:"<",threshold:40,severity:"urgent"},resp:{ruleId:"R007",created:true}},
  {method:"GET",path:"/api/v1/work-orders",tag:"CMMS",desc:"List work orders with filtering by status, priority, asset, and assignee",params:["status","priority","assetId","assignee"],resp:{total:7,orders:[{id:"WO-2847",status:"open"}]}},
  {method:"POST",path:"/api/v1/work-orders",tag:"CMMS",desc:"Create a new work order linked to an asset, floor, and BIM element",params:[],body:{assetId:"A004",title:"Bearing replacement",priority:"urgent",due:"2026-05-24"},resp:{id:"WO-2848",created:true}},
  {method:"GET",path:"/api/v1/bim/model",tag:"BIM",desc:"Fetch BIM model metadata, IFC element tree, and floor hierarchy",params:["floor","format"],resp:{floors:9,elements:4821,ifcVersion:"IFC4",format:"xeokit-xkt"}},
  {method:"POST",path:"/api/v1/bim/sync",tag:"BIM",desc:"Trigger a BIM model sync from Autodesk APS or uploaded IFC file",params:[],body:{source:"aps",urn:"dXJuOmFkc2sub2JqZWN0czp..."},resp:{jobId:"sync-2847",status:"queued"}},
  {method:"GET",path:"/api/v1/analytics/energy",tag:"Analytics",desc:"Retrieve energy consumption time-series, aggregated by hour/day/month",params:["from","to","granularity","floor"],resp:{series:[{ts:"2026-05-24T00:00",kw:48.2}],totalKwh:512}},
  {method:"POST",path:"/api/v1/ml/predict",tag:"ML",desc:"Run predictive maintenance inference — returns RUL estimate and risk score",params:[],body:{assetId:"A004",features:{vibration:3.2,temp:62,runtime:18400}},resp:{rulHours:124,riskScore:0.91,recommendation:"Replace bearing"}},
  {method:"GET",path:"/api/v1/users",tag:"Admin",desc:"List platform users with roles, access levels, and floor permissions",params:["role","active"],resp:{users:[{id:"U001",email:"admin@co.com",role:"manager"}]}},
];

const methodColor={GET:C.green,POST:C.accent,PATCH:C.yellow,DELETE:C.red,PUT:C.warm};
const TAGS=["Assets","IoT","CMMS","BIM","Analytics","ML","Admin"];

function APIExplorer(){
  const [activeTag,setActiveTag]=useState("Assets");
  const [expanded,setExpanded]=useState(null);
  const [testResult,setTestResult]=useState(null);
  const filtered=API_ENDPOINTS.filter(e=>e.tag===activeTag);

  const runTest=(ep)=>{
    setTestResult({loading:true,ep});
    setTimeout(()=>{
      setTestResult({loading:false,ep,status:ep.method==="DELETE"?204:ep.method==="POST"?201:200,body:ep.resp});
    },800);
  };

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {TAGS.map(t=>(
          <button key={t} onClick={()=>setActiveTag(t)} style={{background:activeTag===t?C.accentDim:C.surface,border:`1px solid ${activeTag===t?C.accent:C.border}`,color:activeTag===t?C.accent:C.textMuted,borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>
            {t}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          {filtered.map((ep,i)=>{
            const isExp=expanded===ep.path+ep.method;
            return(
              <Card key={ep.path+ep.method} style={{marginBottom:8,overflow:"hidden",border:`1px solid ${isExp?C.borderAccent:C.border}`}}>
                <div onClick={()=>setExpanded(isExp?null:ep.path+ep.method)} style={{padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{background:`${methodColor[ep.method]}22`,color:methodColor[ep.method],borderRadius:4,padding:"2px 7px",fontSize:10,fontFamily:"monospace",fontWeight:700,minWidth:46,textAlign:"center"}}>{ep.method}</span>
                  <code style={{color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",flex:1}}>{ep.path}</code>
                  <span style={{color:C.textDim,fontSize:9,marginLeft:"auto"}}>{isExp?"▲":"▼"}</span>
                </div>
                {isExp&&<div style={{borderTop:`1px solid ${C.border}`,padding:14}}>
                  <div style={{color:C.textMuted,fontSize:12,marginBottom:12,lineHeight:1.6}}>{ep.desc}</div>
                  {ep.params.length>0&&<div style={{marginBottom:10}}>
                    <div style={{color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Parameters</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {ep.params.map(p=><code key={p} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.accent,borderRadius:4,padding:"2px 8px",fontSize:10}}>{p}</code>)}
                    </div>
                  </div>}
                  {ep.body&&<div style={{marginBottom:10}}>
                    <div style={{color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Request Body</div>
                    <pre style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:10,fontSize:10,color:C.textMuted,fontFamily:"'DM Mono',monospace",overflow:"auto",margin:0}}>{JSON.stringify(ep.body,null,2)}</pre>
                  </div>}
                  <div style={{marginBottom:12}}>
                    <div style={{color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Response Example</div>
                    <pre style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:10,fontSize:10,color:C.green,fontFamily:"'DM Mono',monospace",overflow:"auto",margin:0}}>{JSON.stringify(ep.resp,null,2)}</pre>
                  </div>
                  <button onClick={()=>runTest(ep)} style={{background:C.accent,border:"none",borderRadius:6,padding:"7px 16px",color:C.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    ▶ Try It
                  </button>
                </div>}
              </Card>
            );
          })}
        </div>
        {testResult&&(
          <div style={{width:260,flexShrink:0}}>
            <Card style={{padding:14}}>
              <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Test Result</div>
              {testResult.loading?<div style={{color:C.accent,fontFamily:"monospace",fontSize:12}}>Sending request…</div>:(
                <>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{background:testResult.status<300?C.greenDim:C.redDim,color:testResult.status<300?C.green:C.red,borderRadius:4,padding:"2px 8px",fontSize:11,fontFamily:"monospace",fontWeight:700}}>{testResult.status}</span>
                    <span style={{color:C.textMuted,fontSize:10}}>{testResult.status===200?"OK":testResult.status===201?"Created":"No Content"}</span>
                  </div>
                  <pre style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:10,fontSize:9,color:C.green,fontFamily:"'DM Mono',monospace",overflow:"auto",margin:0,maxHeight:300}}>{JSON.stringify(testResult.body,null,2)}</pre>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DATABASE SCHEMA (ERD-style) ────────────────────────────────────────────────
function DBSchema(){
  const tables=[
    {name:"assets",color:C.accent,fields:[["id","UUID PK"],["name","VARCHAR(100)"],["type","ENUM"],["floor_id","UUID FK"],["bim_element_id","VARCHAR"],["status","ENUM"],["health_score","SMALLINT"],["rul_hours","INTEGER"],["installed_year","SMALLINT"],["brand","VARCHAR(80)"],["model","VARCHAR(80)"]]},
    {name:"sensor_readings",color:C.green,fields:[["id","BIGSERIAL PK"],["asset_id","UUID FK"],["ts","TIMESTAMPTZ"],["metric","VARCHAR(40)"],["value","DOUBLE"],["unit","VARCHAR(20)"],["quality","SMALLINT"]]},
    {name:"work_orders",color:C.warm,fields:[["id","VARCHAR(16) PK"],["asset_id","UUID FK"],["title","TEXT"],["priority","ENUM"],["status","ENUM"],["assigned_to","UUID FK"],["created_at","TIMESTAMPTZ"],["due_at","TIMESTAMPTZ"],["est_hours","SMALLINT"]]},
    {name:"alert_rules",color:C.yellow,fields:[["id","VARCHAR(8) PK"],["asset_id","UUID FK"],["metric","VARCHAR(40)"],["operator","ENUM"],["threshold","DOUBLE"],["severity","ENUM"],["active","BOOLEAN"]]},
    {name:"floors",color:C.purple,fields:[["id","UUID PK"],["code","VARCHAR(4)"],["label","VARCHAR(40)"],["elevation_m","NUMERIC"],["area_m2","NUMERIC"],["bim_level_id","VARCHAR"]]},
    {name:"users",color:C.teal,fields:[["id","UUID PK"],["email","VARCHAR(200)"],["name","VARCHAR(120)"],["role","ENUM"],["active","BOOLEAN"],["last_login","TIMESTAMPTZ"],["floor_access","UUID[]"]]},
    {name:"ml_predictions",color:C.pink,fields:[["id","UUID PK"],["asset_id","UUID FK"],["predicted_at","TIMESTAMPTZ"],["rul_hours","INTEGER"],["risk_score","NUMERIC"],["model_version","VARCHAR"],["recommendation","TEXT"]]},
  ];
  return(
    <div>
      <div style={{color:C.textMuted,fontSize:12,marginBottom:16,lineHeight:1.7}}>PostgreSQL 16 + PostGIS schema. Time-series data uses InfluxDB (mirrored to <code style={{color:C.accent}}>sensor_readings</code> for joins). All tables have <code style={{color:C.green}}>created_at</code>, <code style={{color:C.green}}>updated_at</code>, and soft-delete via <code style={{color:C.green}}>deleted_at</code>.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
        {tables.map(t=>(
          <Card key={t.name} style={{overflow:"hidden",border:`1px solid ${t.color}33`}}>
            <div style={{background:`${t.color}18`,padding:"10px 14px",borderBottom:`1px solid ${t.color}33`,display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:t.color,display:"inline-block"}}/>
              <code style={{color:t.color,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:12}}>{t.name}</code>
            </div>
            <div>
              {t.fields.map(([f,type],i)=>(
                <div key={f} style={{padding:"5px 14px",borderTop:i?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <code style={{color:type.includes("PK")?t.color:type.includes("FK")?C.textMuted:C.text,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{f}</code>
                  <code style={{color:C.textDim,fontSize:9,fontFamily:"'DM Mono',monospace"}}>{type}</code>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────
const USERS_DATA=[
  {id:"U001",name:"Maria Santos",   email:"m.santos@corp.io",  role:"manager",    active:true,  floors:["All"],    lastLogin:"2026-05-24 09:12",avatar:"MS",color:C.accent},
  {id:"U002",name:"Tom Reyes",      email:"t.reyes@corp.io",   role:"technician", active:true,  floors:["B1","B2","GF","L1"],lastLogin:"2026-05-24 08:45",avatar:"TR",color:C.warm},
  {id:"U003",name:"Linda Tan",      email:"l.tan@corp.io",     role:"iot",        active:true,  floors:["All"],    lastLogin:"2026-05-23 17:30",avatar:"LT",color:C.yellow},
  {id:"U004",name:"David Kim",      email:"d.kim@corp.io",     role:"executive",  active:true,  floors:["All"],    lastLogin:"2026-05-22 14:00",avatar:"DK",color:C.purple},
  {id:"U005",name:"Ana Cruz",       email:"a.cruz@corp.io",    role:"technician", active:false, floors:["L1","L2","L3"],lastLogin:"2026-05-10 11:20",avatar:"AC",color:C.warm},
  {id:"U006",name:"James Wu",       email:"j.wu@corp.io",      role:"tenant",     active:true,  floors:["L4","L5"],lastLogin:"2026-05-24 08:00",avatar:"JW",color:C.green},
  {id:"U007",name:"Sara Park",      email:"s.park@corp.io",    role:"tenant",     active:true,  floors:["L3"],     lastLogin:"2026-05-23 09:15",avatar:"SP",color:C.green},
];
const ROLE_PERMS={
  manager:    {label:"Facility Manager",  color:C.accent, perms:["View all","Edit assets","Create WOs","Manage users","View analytics","IoT config"]},
  technician: {label:"Maintenance Tech",  color:C.warm,   perms:["View assigned","Edit WOs","Field updates","View floor plans"]},
  iot:        {label:"IoT Engineer",      color:C.yellow,  perms:["View all","IoT config","Alert rules","Sensor management","API access"]},
  executive:  {label:"Executive",         color:C.purple,  perms:["View all","Analytics","Reports","No edit access"]},
  tenant:     {label:"Tenant",            color:C.green,   perms:["View own floor","Occupancy data","Submit requests"]},
};

function UserManagement(){
  const [selectedUser,setSelectedUser]=useState(null);
  const [showInvite,setShowInvite]=useState(false);
  const [filterRole,setFilterRole]=useState("all");

  const filtered=filterRole==="all"?USERS_DATA:USERS_DATA.filter(u=>u.role===filterRole);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setFilterRole("all")} style={{background:filterRole==="all"?C.accentDim:C.surface,border:`1px solid ${filterRole==="all"?C.accent:C.border}`,color:filterRole==="all"?C.accent:C.textMuted,borderRadius:6,padding:"5px 10px",fontSize:10,cursor:"pointer"}}>All</button>
          {Object.entries(ROLE_PERMS).map(([r,v])=>(
            <button key={r} onClick={()=>setFilterRole(r)} style={{background:filterRole===r?`${v.color}22`:C.surface,border:`1px solid ${filterRole===r?v.color:C.border}`,color:filterRole===r?v.color:C.textMuted,borderRadius:6,padding:"5px 10px",fontSize:10,cursor:"pointer"}}>{v.label.split(" ")[0]}</button>
          ))}
        </div>
        <button onClick={()=>setShowInvite(true)} style={{background:C.green,border:"none",borderRadius:7,padding:"7px 14px",color:C.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Invite User</button>
      </div>
      {showInvite&&(
        <Card style={{padding:16,marginBottom:14,border:`1px solid ${C.green}44`}}>
          <div style={{color:C.green,fontFamily:"monospace",fontWeight:700,fontSize:11,marginBottom:12}}>INVITE NEW USER</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["Full Name","Jane Smith"],["Email","jane@corp.io"],["Role","manager"]].map(([l,p])=>(
              <div key={l}>
                <div style={{color:C.textMuted,fontSize:9,marginBottom:4}}>{l}</div>
                <input placeholder={p} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{background:C.green,border:"none",borderRadius:6,padding:"7px 14px",color:C.bg,fontWeight:700,fontSize:11,cursor:"pointer"}}>Send Invite</button>
            <button onClick={()=>setShowInvite(false)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 14px",color:C.textMuted,fontSize:11,cursor:"pointer"}}>Cancel</button>
          </div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:selectedUser?"1fr 300px":"1fr",gap:14,alignItems:"start"}}>
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.text,fontWeight:600,fontSize:13}}>Platform Users</span>
            <span style={{color:C.textDim,fontSize:10}}>{USERS_DATA.filter(u=>u.active).length}/{USERS_DATA.length} active</span>
          </div>
          {filtered.map((u,i)=>(
            <div key={u.id} onClick={()=>setSelectedUser(selectedUser?.id===u.id?null:u)} style={{padding:"12px 16px",borderTop:i?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",gap:12,cursor:"pointer",background:selectedUser?.id===u.id?C.surfaceAlt:"transparent",transition:"background .15s"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:`${u.color}22`,border:`1.5px solid ${u.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:u.color,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{u.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:C.text,fontSize:13,fontWeight:600}}>{u.name}</span>
                  {!u.active&&<Chip label="Inactive" color={C.textMuted}/>}
                </div>
                <div style={{color:C.textMuted,fontSize:10}}>{u.email} · {ROLE_PERMS[u.role].label}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <Chip label={u.role} color={ROLE_PERMS[u.role].color}/>
                <div style={{color:C.textDim,fontSize:9,marginTop:4}}>Last: {u.lastLogin.split(" ")[0]}</div>
              </div>
            </div>
          ))}
        </Card>
        {selectedUser&&(
          <Card style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:`${selectedUser.color}22`,border:`1.5px solid ${selectedUser.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:selectedUser.color,fontFamily:"'DM Mono',monospace"}}>{selectedUser.avatar}</div>
                <div>
                  <div style={{color:C.text,fontWeight:700,fontSize:14}}>{selectedUser.name}</div>
                  <div style={{color:C.textMuted,fontSize:10}}>{selectedUser.id}</div>
                </div>
              </div>
              <button onClick={()=>setSelectedUser(null)} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{marginBottom:12}}>
              {[["Email",selectedUser.email],["Role",ROLE_PERMS[selectedUser.role].label],["Status",selectedUser.active?"Active":"Inactive"],["Last Login",selectedUser.lastLogin]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.textMuted,fontSize:11}}>{k}</span>
                  <span style={{color:C.text,fontSize:11,fontFamily:"monospace"}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginBottom:12}}>
              <div style={{color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Floor Access</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {selectedUser.floors.map(f=><Chip key={f} label={f} color={C.accent}/>)}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{color:C.textDim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Permissions</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {ROLE_PERMS[selectedUser.role].perms.map(p=>(
                  <div key={p} style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{color:C.green,fontSize:12}}>✓</span>
                    <span style={{color:C.textMuted,fontSize:11}}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button style={{flex:1,background:C.accent,border:"none",borderRadius:6,padding:"7px",color:C.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>Edit Role</button>
              <button style={{flex:1,background:selectedUser.active?C.redDim:C.greenDim,border:`1px solid ${selectedUser.active?C.red:C.green}44`,borderRadius:6,padding:"7px",color:selectedUser.active?C.red:C.green,fontSize:11,cursor:"pointer"}}>{selectedUser.active?"Deactivate":"Activate"}</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── ML PREDICTIVE MAINTENANCE ─────────────────────────────────────────────────
function MLModule(){
  const [selected,setSelected]=useState(ASSETS[3]); // PUMP-02 default
  const [running,setRunning]=useState(false);
  const [result,setResult]=useState({rul:124,risk:0.91,rec:"Immediate bearing replacement required — failure imminent",confidence:0.94,anomalies:["High vibration (3.8g)","Temp spike +12°C","Current draw +18%"]});
  const [features,setFeatures]=useState({vibration:3.8,temp:62,runtime:18400,current:8.4,noise:74});

  const runML=()=>{
    setRunning(true); setResult(null);
    setTimeout(()=>{
      const risk=Math.min(1,features.vibration/5*0.4+features.temp/100*0.3+(features.runtime>15000?0.3:0.1));
      const rul=Math.round(Math.max(50,500-risk*500+Math.random()*50));
      setRunning(false);
      setResult({rul,risk:+risk.toFixed(2),rec:risk>0.8?"Immediate replacement required":risk>0.5?"Schedule service within 2 weeks":"Continue normal operation",confidence:+(0.85+Math.random()*0.12).toFixed(2),anomalies:features.vibration>3?["Elevated vibration"]:[]});
    },1600);
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <KPI label="Assets Monitored" value={ASSETS.filter(a=>a.rul).length} unit="assets" color={C.accent}/>
        <KPI label="Critical RUL" value={ASSETS.filter(a=>a.rul&&a.rul<500).length} unit="assets" color={C.red}/>
        <KPI label="Avg Health" value={Math.round(ASSETS.reduce((s,a)=>s+a.health,0)/ASSETS.length)} unit="%" color={C.green}/>
        <KPI label="Model Accuracy" value="94.2" unit="%" color={C.purple}/>
      </div>

      {/* RUL Timeline */}
      <Card style={{padding:16,marginBottom:16}}>
        <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:14}}>Remaining Useful Life — All Assets</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ASSETS.filter(a=>a.rul).sort((a,b)=>a.rul-b.rul).map(a=>{
            const maxRUL=10000; const pct=Math.min(100,(a.rul/maxRUL)*100);
            const col=a.rul<500?C.red:a.rul<2000?C.yellow:C.green;
            return(
              <div key={a.id} onClick={()=>setSelected(a)} style={{cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <Dot status={a.status} size={6}/>
                    <span style={{color:C.text,fontSize:12,fontWeight:selected?.id===a.id?700:400}}>{a.name}</span>
                    <span style={{color:C.textDim,fontSize:10}}>{a.type}</span>
                  </div>
                  <span style={{color:col,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{a.rul.toLocaleString()} hrs</span>
                </div>
                <div style={{width:"100%",height:6,background:C.border,borderRadius:3}}>
                  <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:3,transition:"width .5s",boxShadow:`0 0 6px ${col}66`}}/>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ML Inference Panel */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card style={{padding:16}}>
          <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:4}}>Inference Engine</div>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:14}}>Asset: <span style={{color:C.accent,fontFamily:"monospace"}}>{selected?.name||"—"}</span></div>
          {[
            {key:"vibration",label:"Vibration (g-rms)",min:0,max:8,step:.1},
            {key:"temp",label:"Operating Temp (°C)",min:20,max:100,step:1},
            {key:"runtime",label:"Cumulative Runtime (hrs)",min:0,max:30000,step:100},
            {key:"current",label:"Current Draw (A)",min:0,max:20,step:.1},
            {key:"noise",label:"Acoustic Level (dB)",min:40,max:100,step:1},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{color:C.textMuted,fontSize:10}}>{f.label}</span>
                <span style={{color:C.accent,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{features[f.key]}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={features[f.key]}
                onChange={e=>setFeatures(x=>({...x,[f.key]:+e.target.value}))}
                style={{width:"100%",accentColor:C.accent}}/>
            </div>
          ))}
          <button onClick={runML} style={{width:"100%",background:running?C.surface:C.accent,border:running?`1px solid ${C.border}`:"none",borderRadius:8,padding:"11px",color:running?C.textMuted:C.bg,fontSize:13,fontWeight:700,cursor:running?"not-allowed":"pointer",transition:"all .2s"}}>
            {running?"⟳  Running Inference…":"▶  Run ML Prediction"}
          </button>
        </Card>

        <Card style={{padding:16}}>
          <div style={{color:C.text,fontWeight:600,fontSize:13,marginBottom:14}}>Prediction Output</div>
          {running&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {["Loading feature vectors…","Running gradient boost model…","Calculating confidence intervals…"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:8,opacity:1,animation:`fadeI .4s ${i*.2}s both`}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:C.accent,display:"inline-block"}}/>
                <span style={{color:C.textMuted,fontSize:11}}>{s}</span>
              </div>
            ))}
          </div>}
          {result&&!running&&<div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${result.rul<500?C.red:result.rul<2000?C.yellow:C.green}`}}>
                <div style={{color:C.textMuted,fontSize:9,marginBottom:4}}>PREDICTED RUL</div>
                <div style={{color:result.rul<500?C.red:result.rul<2000?C.yellow:C.green,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{result.rul.toLocaleString()}</div>
                <div style={{color:C.textDim,fontSize:9}}>hours remaining</div>
              </div>
              <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${result.risk>.7?C.red:result.risk>.4?C.yellow:C.green}`}}>
                <div style={{color:C.textMuted,fontSize:9,marginBottom:4}}>RISK SCORE</div>
                <div style={{color:result.risk>.7?C.red:result.risk>.4?C.yellow:C.green,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{(result.risk*100).toFixed(0)}%</div>
                <div style={{color:C.textDim,fontSize:9}}>failure probability</div>
              </div>
            </div>
            <div style={{background:C.bg,borderRadius:7,padding:"10px 12px",marginBottom:10,border:`1px solid ${result.risk>.7?C.red+"44":C.border}`}}>
              <div style={{color:C.textDim,fontSize:9,marginBottom:4}}>RECOMMENDATION</div>
              <div style={{color:C.text,fontSize:12,lineHeight:1.5}}>{result.rec}</div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <span style={{color:C.textMuted,fontSize:10}}>Model Confidence</span>
              <span style={{color:C.green,fontFamily:"monospace",fontWeight:700,fontSize:12}}>{(result.confidence*100).toFixed(0)}%</span>
            </div>
            <Bar v={result.confidence*100} color={C.green}/>
            {result.anomalies.length>0&&<div style={{marginTop:12}}>
              <div style={{color:C.textDim,fontSize:9,marginBottom:6}}>DETECTED ANOMALIES</div>
              {result.anomalies.map(a=><div key={a} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{color:C.red,fontSize:12}}>▲</span><span style={{color:C.red,fontSize:11}}>{a}</span></div>)}
            </div>}
            <button style={{width:"100%",marginTop:14,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px",color:C.textMuted,fontSize:11,cursor:"pointer"}}>
              → Create Work Order from Prediction
            </button>
          </div>}
          {!result&&!running&&<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:40}}>Configure inputs and run inference →</div>}
        </Card>
      </div>
    </div>
  );
}

// ── WEBSOCKET LIVE FEED ────────────────────────────────────────────────────────
function WebSocketModule(){
  const [connected,setConnected]=useState(false);
  const [msgs,setMsgs]=useState([]);
  const [paused,setPaused]=useState(false);
  const [filter,setFilter]=useState("all");
  const intervalRef=useRef(null);
  const msgTypes=["telemetry","alert","status_change","heartbeat","prediction"];
  const msgColors={telemetry:C.accent,alert:C.red,status_change:C.yellow,heartbeat:C.textDim,prediction:C.purple};

  const connect=()=>{
    setConnected(true); setMsgs([]);
    intervalRef.current=setInterval(()=>{
      if(paused) return;
      const asset=ASSETS[Math.floor(Math.random()*ASSETS.length)];
      const type=Math.random()<.05?"alert":Math.random()<.1?"status_change":Math.random()<.05?"prediction":Math.random()<.15?"heartbeat":"telemetry";
      const msg={
        id:Date.now()+Math.random(),
        ts:new Date().toISOString(),
        type,
        assetId:asset.id,
        assetName:asset.name,
        data:type==="telemetry"?{temp:+(asset.temp||20+Math.random()*4).toFixed(1),energy:+(45+Math.random()*40).toFixed(1),vibration:+(Math.random()*4).toFixed(2)}:
             type==="alert"?{severity:"urgent",metric:"health",value:asset.health,threshold:40}:
             type==="prediction"?{rul:Math.round(asset.rul||2000+Math.random()*500),risk:+(Math.random()).toFixed(2)}:
             type==="heartbeat"?{uptime:Math.round(Math.random()*999999)}:
             {from:asset.status,to:"operational"},
      };
      setMsgs(m=>[msg,...m].slice(0,120));
    },800);
  };

  const disconnect=()=>{ clearInterval(intervalRef.current); setConnected(false); };
  useEffect(()=>()=>clearInterval(intervalRef.current),[]);

  const filtered=filter==="all"?msgs:msgs.filter(m=>m.type===filter);

  return(
    <div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:connected?C.green:C.textDim,boxShadow:connected?`0 0 10px ${C.green}`:""}}/>
          <span style={{color:connected?C.green:C.textMuted,fontSize:12,fontFamily:"monospace"}}>{connected?"CONNECTED — ws://twincore.io/api/v1/sensors/stream":"DISCONNECTED"}</span>
        </div>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {connected&&<button onClick={()=>setPaused(!paused)} style={{background:paused?C.yellowDim:C.surface,border:`1px solid ${paused?C.yellow:C.border}`,color:paused?C.yellow:C.textMuted,borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>{paused?"▶ Resume":"⏸ Pause"}</button>}
          <button onClick={connected?disconnect:connect} style={{background:connected?C.redDim:C.greenDim,border:`1px solid ${connected?C.red:C.green}44`,color:connected?C.red:C.green,borderRadius:6,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{connected?"Disconnect":"Connect"}</button>
        </div>
      </div>

      {connected&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:14}}>
          {msgTypes.map(t=>{
            const count=msgs.filter(m=>m.type===t).length;
            return(
              <button key={t} onClick={()=>setFilter(filter===t?"all":t)} style={{background:filter===t?`${msgColors[t]}22`:C.surface,border:`1px solid ${filter===t?msgColors[t]:C.border}`,borderRadius:7,padding:"8px 6px",cursor:"pointer",textAlign:"center"}}>
                <div style={{color:msgColors[t],fontFamily:"monospace",fontWeight:700,fontSize:16}}>{count}</div>
                <div style={{color:filter===t?msgColors[t]:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:.5}}>{t.replace("_"," ")}</div>
              </button>
            );
          })}
        </div>

        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:C.text,fontSize:12,fontWeight:600}}>Live Message Stream</span>
            <span style={{color:C.textDim,fontSize:10}}>{filtered.length} messages · {paused?"PAUSED":"LIVE"}</span>
          </div>
          <div style={{height:440,overflowY:"auto"}}>
            {filtered.length===0&&<div style={{color:C.textDim,textAlign:"center",padding:40,fontSize:12}}>Waiting for messages…</div>}
            {filtered.map(msg=>(
              <div key={msg.id} style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"80px 90px 80px 1fr",gap:10,alignItems:"center",animation:"slideIn .2s ease"}}>
                <code style={{color:C.textDim,fontSize:9}}>{msg.ts.slice(11,23)}</code>
                <Chip label={msg.type.replace("_"," ")} color={msgColors[msg.type]}/>
                <code style={{color:C.accent,fontSize:9}}>{msg.assetName}</code>
                <code style={{color:C.textMuted,fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{JSON.stringify(msg.data)}</code>
              </div>
            ))}
          </div>
        </Card>
      </div>}

      {!connected&&(
        <Card style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:16}}>⚡</div>
          <div style={{color:C.text,fontSize:16,fontWeight:600,marginBottom:8}}>WebSocket Simulator</div>
          <div style={{color:C.textMuted,fontSize:12,maxWidth:400,margin:"0 auto 24px",lineHeight:1.7}}>Simulates the real-time MQTT-to-WebSocket bridge that streams telemetry, alerts, status changes, and ML predictions from your IoT devices to connected clients.</div>
          <button onClick={connect} style={{background:C.green,border:"none",borderRadius:8,padding:"11px 24px",color:C.bg,fontSize:13,fontWeight:700,cursor:"pointer"}}>Connect to Stream</button>
        </Card>
      )}
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("bim3d");
  const [selected3D,setSelected3D]=useState(null);
  const [time,setTime]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);

  const TABS=[
    {id:"bim3d",  icon:"⬡", label:"3D BIM Viewer"},
    {id:"api",    icon:"◈", label:"API Explorer"},
    {id:"db",     icon:"⊙", label:"DB Schema"},
    {id:"users",  icon:"⊛", label:"User Management"},
    {id:"ml",     icon:"∑", label:"ML Predictions"},
    {id:"ws",     icon:"⚡", label:"Live WebSocket"},
  ];

  const criticalCount=ASSETS.filter(a=>a.status==="critical").length;

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.text}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}button{cursor:pointer}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}@keyframes fadeI{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.fi{animation:fadeI .3s ease forwards}`}</style>

      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",alignItems:"center",gap:16,height:54,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:`linear-gradient(135deg,${C.accent},${C.warm})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⬡</div>
          <div>
            <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:14,letterSpacing:.5}}>TWINCORE</div>
            <div style={{color:C.textDim,fontSize:8,letterSpacing:2}}>NEXT STEPS — ADVANCED MODULES</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginLeft:"auto"}}>
          {criticalCount>0&&<div style={{display:"flex",alignItems:"center",gap:5,background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,padding:"3px 10px"}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:C.red,display:"inline-block",animation:"pulse 1s infinite"}}/>
            <span style={{color:C.red,fontSize:10,fontFamily:"monospace"}}>{criticalCount} CRITICAL</span>
          </div>}
          <div style={{color:C.textMuted,fontSize:10,fontFamily:"'DM Mono',monospace"}}>{time.toLocaleTimeString()}</div>
        </div>
      </header>

      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",gap:2,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",color:tab===t.id?C.accent:C.textMuted,borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`,padding:"11px 14px",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500,transition:"all .2s",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <main style={{padding:20,maxWidth:1200,margin:"0 auto"}} key={tab}>
        <div className="fi">
          {tab==="bim3d"&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              <KPI label="Assets in Model" value={ASSETS.length} color={C.accent} delta={12}/>
              <KPI label="Critical" value={criticalCount} color={C.red}/>
              <KPI label="Avg Health" value={Math.round(ASSETS.reduce((s,a)=>s+a.health,0)/ASSETS.length)+"%"} color={C.green}/>
              <KPI label="BIM Elements" value="4,821" color={C.purple}/>
            </div>
            <BIM3DViewer assets={ASSETS} onSelect={setSelected3D} selected={selected3D}/>
            {selected3D&&(
              <Card style={{marginTop:14,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <Dot status={selected3D.status} size={10}/>
                    <div>
                      <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:15}}>{selected3D.name}</div>
                      <div style={{color:C.textMuted,fontSize:10}}>{selected3D.type} · {selected3D.id} · Floor {selected3D.floor} · 3D pos [{selected3D.pos.join(",")}]</div>
                    </div>
                  </div>
                  <button onClick={()=>setSelected3D(null)} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                  {[["Brand",selected3D.brand],["Model",selected3D.model],["Year",selected3D.yr],["Health",selected3D.health+"%"],["RUL",selected3D.rul?(selected3D.rul.toLocaleString()+"h"):"—"]].map(([k,v])=>(
                    <div key={k} style={{background:C.bg,borderRadius:6,padding:"8px 10px"}}>
                      <div style={{color:C.textDim,fontSize:9,marginBottom:2}}>{k}</div>
                      <div style={{color:C.text,fontSize:12,fontFamily:"monospace"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>}
          {tab==="api"&&<APIExplorer/>}
          {tab==="db"&&<DBSchema/>}
          {tab==="users"&&<UserManagement/>}
          {tab==="ml"&&<MLModule/>}
          {tab==="ws"&&<WebSocketModule/>}
        </div>
      </main>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
