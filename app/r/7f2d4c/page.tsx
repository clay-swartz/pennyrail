"use client";
import { useState } from "react";

export default function Home(){
  const [token,setToken]=useState("");
  const [scan,setScan]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [registration,setRegistration]=useState<any>(null);

  async function call(path:string,method="GET"){
    const r=await fetch(path,{method,headers:{"x-admin-token":token,"accept":"application/json"},cache:"no-store"});
    const text=await r.text();
    try{return JSON.parse(text)}catch{return {error:`HTTP ${r.status}: ${text.slice(0,300)}`}}
  }

  async function runFactory(){
    setBusy(true); setScan(null);
    try{setScan(await call("/api/factory/scan"))}catch(e){setScan({error:e instanceof Error?e.message:"scan failed"})}finally{setBusy(false)}
  }
  async function list(){setRegistration(await call("/api/radar/register","POST"))}

  const rows=scan?.opportunities||[];
  return <main style={{maxWidth:1040,margin:"0 auto",padding:"40px 24px 80px",fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace"}}>
    <div style={{fontSize:11,letterSpacing:2.2,color:"#817966"}}>PENNYRAIL / FACTORY</div>
    <h1 style={{fontSize:28,fontWeight:500,margin:"14px 0 26px"}}>Machine demand → paid capability.</h1>

    <section style={box}>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={input}/>
      <button disabled={!token||busy} onClick={runFactory} style={primary}>{busy?"Buying live demand + building shortlist…":"Run factory"}</button>
      <button disabled={!token} onClick={list} style={button}>List / refresh seller</button>
    </section>

    {scan?.error?<pre style={errorBox}>{JSON.stringify(scan,null,2)}</pre>:null}

    {rows.length?<section style={{...box,marginTop:16}}>
      <div style={{fontSize:11,color:"#777",marginBottom:14}}>
        ${(scan.intelSpendUsd||0).toFixed(3)} intel · {scan.factory?.autoLive||0} auto-live · {scan.factory?.needsBuilder||0} need new recipe
      </div>
      {rows.map((r:any,i:number)=><div key={i} style={{padding:"14px 0",borderTop:i?"1px solid #23262b":"none",display:"grid",gridTemplateColumns:"110px 1fr",gap:16}}>
        <div><span style={{fontSize:10,padding:"4px 7px",border:"1px solid #3a3d42",borderRadius:999,color:r.status==="AUTO-LIVE"?"#d8cba7":"#8e9198"}}>{r.status}</span><div style={{fontSize:10,color:"#666",marginTop:7}}>score {r.score}</div></div>
        <div><div style={{fontSize:15}}>{r.need}</div><div style={{fontSize:11,color:"#777",marginTop:6}}>{r.demandSignals} signals · {r.signalType}{r.operation?` · ${r.operation} · $${r.priceUsd}/call`:""}</div></div>
      </div>)}
    </section>:null}

    {!scan&&<section style={{...box,marginTop:16,color:"#777",fontSize:12,lineHeight:1.7}}>No factory run yet.</section>}

    {registration?<pre style={pre}>{JSON.stringify(registration,null,2)}</pre>:null}
  </main>
}

const box={border:"1px solid #23262b",background:"#0d0f12",padding:18} as const;
const input={width:"100%",boxSizing:"border-box",padding:11,background:"#090b0e",border:"1px solid #30333a",color:"#ddd",marginBottom:10} as const;
const button={padding:"10px 13px",marginRight:8,border:"1px solid #34373d",background:"#15181d",color:"#bbb",cursor:"pointer"} as const;
const primary={...button,background:"#d9d0b9",color:"#111",fontWeight:700} as const;
const pre={marginTop:16,padding:14,background:"#08090b",border:"1px solid #23262b",fontSize:10,whiteSpace:"pre-wrap",overflow:"auto"} as const;
const errorBox={...pre,border:"1px solid #5a3030",color:"#ddb3b3"} as const;
