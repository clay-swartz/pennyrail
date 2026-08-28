"use client";
import { useState } from "react";

export default function Home(){
  const [token,setToken]=useState("");
  const [publication,setPublication]=useState<any>(null);
  const [catalog,setCatalog]=useState<any>(null);
  const [revenue,setRevenue]=useState<any>(null);
  const [busy,setBusy]=useState("");

  async function adminCall(path:string,method="GET"){
    const r=await fetch(path,{
      method,
      headers:{"x-admin-token":token,"accept":"application/json"},
      cache:"no-store",
    });
    const text=await r.text();
    try{return JSON.parse(text)}
    catch{return {error:`HTTP ${r.status}: ${text.slice(0,300)}`}}
  }

  async function refreshRevenue(){
    setBusy("revenue");
    try{setRevenue(await adminCall("/api/radar/revenue"))}
    finally{setBusy("")}
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
    try{
      const r=await fetch("/api/factory/catalog",{cache:"no-store"});
      setCatalog(await r.json());
    } finally { setBusy(""); }
  }

  const r=revenue?.revenue;

  return <main style={{maxWidth:1000,margin:"0 auto",padding:"40px 24px 80px",fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace"}}>
    <div style={{fontSize:11,letterSpacing:2.2,color:"#817966"}}>PENNYRAIL</div>
    <h1 style={{fontSize:28,fontWeight:500,margin:"14px 0 8px"}}>Machine revenue.</h1>
    <p style={{color:"#777",fontSize:12,lineHeight:1.7,margin:"0 0 24px"}}>
      50 paid utilities · Base USDC · outside settlements only.
    </p>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>REVENUE · ON-CHAIN</div>
      <div style={metrics}>
        <Metric title="Earned · 7d" value={r?`$${Number(r.earnedUsd||0).toFixed(3)}`:"—"}/>
        <Metric title="Outside calls" value={r?String(r.outsideCalls||0):"—"}/>
        <Metric title="Paying bots" value={r?String(r.payingBots||0):"—"}/>
        <Metric title="Rank" value={r?.rank?`#${r.rank}`:"—"}/>
      </div>
      <div style={{fontSize:11,color:r?.firstSale?"#b8c9a8":"#777",marginTop:14}}>
        {r?.firstSale?"✓ Outside PennyRail revenue detected.":"No outside sale detected yet."}
        {revenue?.asOf?` · snapshot ${new Date(revenue.asOf).toLocaleString()}`:""}
      </div>
      <button disabled={!token||!!busy} onClick={refreshRevenue} style={primary}>
        {busy==="revenue"?"Checking chain…":"Refresh revenue"}
      </button>
      {revenue?.basescan?<a href={revenue.basescan} target="_blank" rel="noreferrer" style={link}>Open BaseScan ↗</a>:null}
      {revenue?.error?<pre style={pre}>{JSON.stringify(revenue,null,2)}</pre>:null}
    </section>

    <section style={box}>
      <div style={label}>CONTROL</div>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={input}/>
      <button disabled={!token||!!busy} onClick={publish} style={primary}>
        {busy==="publish"?"Publishing inventory…":"Publish inventory"}
      </button>
      <button disabled={!!busy} onClick={loadCatalog} style={button}>
        {busy==="catalog"?"Loading…":"Inventory check"}
      </button>
      <a href="https://www.x402scan.com/resources/register" target="_blank" rel="noreferrer" style={link}>Add to x402scan ↗</a>
      <div style={{fontSize:10,color:"#666",marginTop:10}}>Origin to register: pennyrail.vercel.app</div>
    </section>

    {publication?<pre style={pre}>{JSON.stringify(publication,null,2)}</pre>:null}
    {catalog?<pre style={pre}>{JSON.stringify({
      capabilityCount:catalog.capabilityCount,
      priceUsdPerRun:catalog.priceUsdPerRun,
      firstFive:catalog.capabilities?.slice(0,5),
    },null,2)}</pre>:null}

    <section style={{...box,marginTop:16,color:"#777",fontSize:11,lineHeight:1.7}}>
      Distribution live: Agent402 + true402. OpenAPI is prepared for x402scan discovery. Agent402 revenue data refreshes hourly from Base USDC settlement logs.
    </section>
  </main>
}

function Metric({title,value}:{title:string,value:string}){
  return <div style={metric}><div style={{fontSize:10,color:"#777",marginBottom:8}}>{title}</div><div style={{fontSize:24}}>{value}</div></div>
}

const box={border:"1px solid #23262b",background:"#0d0f12",padding:18} as const;
const label={fontSize:10,letterSpacing:1.8,color:"#817966",marginBottom:14} as const;
const metrics={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:8} as const;
const metric={border:"1px solid #202329",background:"#090b0e",padding:14} as const;
const input={width:"100%",boxSizing:"border-box",padding:11,background:"#090b0e",border:"1px solid #30333a",color:"#ddd",marginBottom:10} as const;
const button={display:"inline-block",padding:"10px 13px",marginRight:8,border:"1px solid #34373d",background:"#15181d",color:"#bbb",cursor:"pointer",textDecoration:"none",fontSize:12} as const;
const primary={...button,background:"#d9d0b9",color:"#111",fontWeight:700} as const;
const link={...button,color:"#d0c7b4"} as const;
const pre={marginTop:16,padding:14,background:"#08090b",border:"1px solid #23262b",fontSize:10,whiteSpace:"pre-wrap",overflow:"auto",maxHeight:520} as const;
