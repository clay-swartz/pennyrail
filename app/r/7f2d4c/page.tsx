"use client";
import { useState } from "react";

export default function Home(){
  const [token,setToken]=useState("");
  const [publication,setPublication]=useState<any>(null);
  const [catalog,setCatalog]=useState<any>(null);
  const [revenue,setRevenue]=useState<any>(null);
  const [yieldAudit,setYieldAudit]=useState<any>(null);
  const [the402Registration,setThe402Registration]=useState<any>(null);
  const [the402Activation,setThe402Activation]=useState<any>(null);
  const [the402Status,setThe402Status]=useState<any>(null);
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


  async function registerThe402(){
    setBusy("the402-register"); setThe402Registration(null);
    try{setThe402Registration(await adminCall("/api/radar/the402/register","POST"))}
    finally{setBusy("")}
  }

  async function activateThe402(){
    setBusy("the402-activate"); setThe402Activation(null);
    try{setThe402Activation(await adminCall("/api/radar/the402/activate","POST"))}
    finally{setBusy("")}
  }

  async function loadThe402Status(sweep=false){
    setBusy("the402-status"); setThe402Status(null);
    try{setThe402Status(await adminCall(`/api/radar/the402/status${sweep?"?sweep=1":""}`))}
    finally{setBusy("")}
  }

  async function loadYieldAudit(){
    setBusy("yield"); setYieldAudit(null);
    try{setYieldAudit(await adminCall("/api/radar/revenue-engine"))}
    finally{setBusy("")}
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
      autonomous gap factory · active outbound sales · target ≥ $1,000/day · outside revenue only.
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


    <section style={{...box,marginBottom:16}}>
      <div style={label}>REVENUE ENGINE · AUTONOMOUS GAP FACTORY</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        PennyRail buys the itemized Agent402 Demand Radar + Bestsellers signals, compares them with live x402 supply, scores monetizable gaps, and immediately exposes needs it can fulfill. Paid intelligence is hard-capped at $0.01 per six-hour audit.
      </p>
      <button disabled={!token||!!busy} onClick={loadYieldAudit} style={primary}>
        {busy==="yield"?"Auditing machine demand…":"Audit revenue gaps"}
      </button>
      <a href="/api/revenue/catalog" target="_blank" rel="noreferrer" style={link}>Open machine catalog ↗</a>
      {yieldAudit?.portfolio?<div style={{...metrics,marginTop:14}}>
        <Metric title="Revenue routes live" value={String(yieldAudit.portfolio.totalRevenueRoutesLive||0)}/>
        <Metric title="Demand aliases" value={String(yieldAudit.portfolio.demandAliasesLive||0)}/>
        <Metric title="Auto-live gaps" value={String(yieldAudit.autoLive?.length||0)}/>
        <Metric title="Needs primitive" value={String(yieldAudit.unresolved?.length||0)}/>
        <Metric title="Demand rows" value={String(yieldAudit.sources?.demandRowsExtracted||0)}/>
        <Metric title="Paid bestseller rows" value={String(yieldAudit.sources?.bestsellerRowsExtracted||0)}/>
        <Metric title="Proven mapped" value={yieldAudit.portfolio?.provenBestsellerRows?`${yieldAudit.portfolio.provenBestsellerMapped||0}/${yieldAudit.portfolio.provenBestsellerRows}`:"—"}/>
      </div>:null}
      {yieldAudit?<pre style={pre}>{JSON.stringify({
        generatedAt:yieldAudit.generatedAt,
        sources:yieldAudit.sources,
        market:yieldAudit.market?{
          servicesObserved:yieldAudit.market.servicesObserved,
          measuredVolumeUsd30d:yieldAudit.market.measuredVolumeUsd30d,
          measuredTransactions30d:yieldAudit.market.measuredTransactions30d,
          measuredBuyers30d:yieldAudit.market.measuredBuyers30d,
          topCategories:yieldAudit.market.categories?.slice(0,8),
        }:null,
        portfolio:yieldAudit.portfolio,
        economics:yieldAudit.economics,
        paidDemand:yieldAudit.paidDemand,
        autoLive:yieldAudit.autoLive?.slice(0,18),
        unresolved:yieldAudit.unresolved?.slice(0,18),
      },null,2)}</pre>:null}
    </section>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>OUTBOUND SALES · THE402</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        PennyRail can sell fixed-price services in the402 catalog and subscribe to real-time request.created pushes. Matching requests are bid automatically and winning jobs are fulfilled through the existing Revenue Engine. Registration costs at most $0.01 once; listing, notifications, bidding with the API key and fulfillment are free platform API calls.
      </p>
      <button disabled={!token||!!busy||Boolean(the402Registration?.ok)} onClick={registerThe402} style={primary}>
        {busy==="the402-register"?"Registering provider…":"1 · Register the402 provider · max $0.01"}
      </button>
      <button disabled={!token||!!busy} onClick={activateThe402} style={button}>
        {busy==="the402-activate"?"Activating sales…":"2 · Activate listings + auto-bidding"}
      </button>
      <button disabled={!token||!!busy} onClick={()=>loadThe402Status(false)} style={button}>
        {busy==="the402-status"?"Checking…":"Status + earnings"}
      </button>
      <button disabled={!token||!!busy} onClick={()=>loadThe402Status(true)} style={button}>
        Sweep requests now
      </button>
      {the402Registration?.ok?<div style={{fontSize:11,lineHeight:1.7,color:"#d0c7b4",marginTop:14}}>
        Registration complete. Copy the three returned environment variables into Vercel Production, redeploy once, then click <b>Activate listings + auto-bidding</b>. Do not commit the API key or webhook secret.
      </div>:null}
      {the402Registration?<pre style={pre}>{JSON.stringify(the402Registration,null,2)}</pre>:null}
      {the402Activation?<pre style={pre}>{JSON.stringify(the402Activation,null,2)}</pre>:null}
      {the402Status?<pre style={pre}>{JSON.stringify(the402Status,null,2)}</pre>:null}
    </section>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>DISTRIBUTION · X402 LIST</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        Submitted successfully: 50/50 paid endpoints found, zero probe errors, $1 review fee paid. Submission 1552c878-c03b-4c33-b788-5db3e96f54fc is pending human review. Do not resubmit while pending.
      </p>
      <a href="https://x402-list.com" target="_blank" rel="noreferrer" style={link}>Open x402 List ↗</a>
    </section>

    <section style={box}>
      <div style={label}>CONTROL</div>
      <input value={token} onChange={(e:any)=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={input}/>
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
      Revenue Engine live: paid gap intelligence + proven-buyer signals + autonomous product aliases. Outbound layer: the402 direct catalog + real-time request bidding when configured. Distribution: x402scan + Agent402 index + true402 + x402 List review.
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
