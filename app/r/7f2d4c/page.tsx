"use client";
import { useState } from "react";

export default function Home(){
  const [token,setToken]=useState("");
  const [publication,setPublication]=useState<any>(null);
  const [catalog,setCatalog]=useState<any>(null);
  const [busy,setBusy]=useState("");

  async function adminCall(path:string,method="GET"){
    const r=await fetch(path,{method,headers:{"x-admin-token":token,"accept":"application/json"},cache:"no-store"});
    const text=await r.text();
    try{return JSON.parse(text)}catch{return {error:`HTTP ${r.status}: ${text.slice(0,300)}`}}
  }

  async function publish(){
    setBusy("publish"); setPublication(null);
    try{
      const [agent402,true402]=await Promise.all([
        adminCall("/api/radar/register","POST"),
        adminCall("/api/radar/register-true402","POST"),
      ]);
      setPublication({agent402,true402});
    } finally { setBusy(""); }
  }

  async function loadCatalog(){
    setBusy("catalog");
    try{const r=await fetch("/api/factory/catalog",{cache:"no-store"});setCatalog(await r.json())}
    finally{setBusy("")}
  }

  return <main style={{maxWidth:1000,margin:"0 auto",padding:"40px 24px 80px",fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace"}}>
    <div style={{fontSize:11,letterSpacing:2.2,color:"#817966"}}>PENNYRAIL / INVENTORY</div>
    <h1 style={{fontSize:28,fontWeight:500,margin:"14px 0 8px"}}>50 paid machine utilities.</h1>
    <p style={{color:"#777",fontSize:12,lineHeight:1.7,margin:"0 0 24px"}}>
      $0.001/call. Publish once; machines discover and buy directly.
    </p>

    <section style={box}>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={input}/>
      <button disabled={!token||!!busy} onClick={publish} style={primary}>
        {busy==="publish"?"Publishing inventory…":"Publish inventory"}
      </button>
      <button disabled={!!busy} onClick={loadCatalog} style={button}>
        {busy==="catalog"?"Loading…":"Inventory check"}
      </button>
    </section>

    {publication?<pre style={pre}>{JSON.stringify(publication,null,2)}</pre>:null}
    {catalog?<pre style={pre}>{JSON.stringify({capabilityCount:catalog.capabilityCount,priceUsdPerRun:catalog.priceUsdPerRun,firstFive:catalog.capabilities?.slice(0,5)},null,2)}</pre>:null}

    <section style={{...box,marginTop:16,color:"#777",fontSize:11,lineHeight:1.7}}>
      Distribution: Agent402 + true402. Coinbase Bazaar is intentionally disabled because its current Base-mainnet discovery path is unreliable; production payment routes remain on PennyRail's proven x402 rail.
    </section>
  </main>
}

const box={border:"1px solid #23262b",background:"#0d0f12",padding:18} as const;
const input={width:"100%",boxSizing:"border-box",padding:11,background:"#090b0e",border:"1px solid #30333a",color:"#ddd",marginBottom:10} as const;
const button={padding:"10px 13px",marginRight:8,border:"1px solid #34373d",background:"#15181d",color:"#bbb",cursor:"pointer"} as const;
const primary={...button,background:"#d9d0b9",color:"#111",fontWeight:700} as const;
const pre={marginTop:16,padding:14,background:"#08090b",border:"1px solid #23262b",fontSize:10,whiteSpace:"pre-wrap",overflow:"auto",maxHeight:520} as const;
