"use client";
import { useState } from "react";

export default function Home(){
  const [token,setToken]=useState("");
  const [registration,setRegistration]=useState<any>(null);
  const [catalog,setCatalog]=useState<any>(null);
  const [busy,setBusy]=useState("");

  async function adminCall(path:string,method="GET"){
    const r=await fetch(path,{method,headers:{"x-admin-token":token,"accept":"application/json"},cache:"no-store"});
    const text=await r.text(); try{return JSON.parse(text)}catch{return {error:`HTTP ${r.status}: ${text.slice(0,300)}`}}
  }
  async function list(){setBusy("list");try{setRegistration(await adminCall("/api/radar/register","POST"))}finally{setBusy("")}}
  async function loadCatalog(){setBusy("catalog");try{const r=await fetch("/api/factory/catalog",{cache:"no-store"});setCatalog(await r.json())}finally{setBusy("")}}

  return <main style={{maxWidth:1000,margin:"0 auto",padding:"40px 24px 80px",fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace"}}>
    <div style={{fontSize:11,letterSpacing:2.2,color:"#817966"}}>PENNYRAIL / INVENTORY</div>
    <h1 style={{fontSize:28,fontWeight:500,margin:"14px 0 8px"}}>50 paid machine utilities.</h1>
    <p style={{color:"#777",fontSize:12,lineHeight:1.7,margin:"0 0 24px"}}>47 shared-engine tollbooths + 3 original PennyTools. Each factory utility is independently discoverable at $0.001/call.</p>

    <section style={box}>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={input}/>
      <button disabled={!token||!!busy} onClick={list} style={primary}>{busy==="list"?"Publishing inventory…":"List / refresh seller"}</button>
      <button disabled={!!busy} onClick={loadCatalog} style={button}>{busy==="catalog"?"Loading…":"Inventory check"}</button>
    </section>

    {registration?<pre style={pre}>{JSON.stringify(registration,null,2)}</pre>:null}
    {catalog?<pre style={pre}>{JSON.stringify({capabilityCount:catalog.capabilityCount,priceUsdPerRun:catalog.priceUsdPerRun,firstFive:catalog.capabilities?.slice(0,5)},null,2)}</pre>:null}

    <section style={{...box,marginTop:16,color:"#777",fontSize:11,lineHeight:1.7}}>
      Agent402's paid Demand Radar is currently returning an empty list because its upstream handler is wired to the aggregate-only demand view. PennyRail inventory remains live; Radar will move to independent signals rather than block selling.
    </section>
  </main>
}

const box={border:"1px solid #23262b",background:"#0d0f12",padding:18} as const;
const input={width:"100%",boxSizing:"border-box",padding:11,background:"#090b0e",border:"1px solid #30333a",color:"#ddd",marginBottom:10} as const;
const button={padding:"10px 13px",marginRight:8,border:"1px solid #34373d",background:"#15181d",color:"#bbb",cursor:"pointer"} as const;
const primary={...button,background:"#d9d0b9",color:"#111",fontWeight:700} as const;
const pre={marginTop:16,padding:14,background:"#08090b",border:"1px solid #23262b",fontSize:10,whiteSpace:"pre-wrap",overflow:"auto",maxHeight:420} as const;
