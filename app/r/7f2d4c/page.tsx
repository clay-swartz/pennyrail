"use client";
import { useEffect, useState } from "react";

export default function Home(){
  const [token,setToken]=useState("");
  const [rememberedAuth,setRememberedAuth]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);
  const [publication,setPublication]=useState<any>(null);
  const [catalog,setCatalog]=useState<any>(null);
  const [revenue,setRevenue]=useState<any>(null);
  const [yieldAudit,setYieldAudit]=useState<any>(null);
  const [the402Registration,setThe402Registration]=useState<any>(null);
  const [the402Activation,setThe402Activation]=useState<any>(null);
  const [the402Status,setThe402Status]=useState<any>(null);
  const [x402ListStatus,setX402ListStatus]=useState<any>(null);
  const [bazaar,setBazaar]=useState<any>(null);
  const [authResult,setAuthResult]=useState<any>(null);
  const [busy,setBusy]=useState("");

  useEffect(()=>{
    fetch("/api/radar/session",{cache:"no-store",credentials:"same-origin"})
      .then(r=>r.json()).then(j=>setRememberedAuth(Boolean(j?.authenticated)))
      .catch(()=>setRememberedAuth(false)).finally(()=>setAuthChecked(true));
  },[]);

  const hasAdmin=Boolean(token||rememberedAuth);

  async function adminCall(path:string,method="GET"){
    const headers:Record<string,string>={"accept":"application/json"};
    if(token) headers["x-admin-token"]=token;
    const r=await fetch(path,{method,headers,cache:"no-store",credentials:"same-origin"});
    const text=await r.text();
    try{return JSON.parse(text)}
    catch{return {error:`HTTP ${r.status}: ${text.slice(0,300)}`}}
  }

  async function rememberAccess(){
    if(!token)return;
    setBusy("remember");setAuthResult(null);
    try{
      const r=await fetch("/api/radar/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token}),credentials:"same-origin"});
      const j=await r.json();setAuthResult(j);
      if(j?.authenticated){setRememberedAuth(true);setToken("");}
    }finally{setBusy("")}
  }

  async function forgetAccess(){
    setBusy("forget");
    try{await fetch("/api/radar/session",{method:"DELETE",credentials:"same-origin"});setRememberedAuth(false);setToken("");setAuthResult(null);}
    finally{setBusy("")}
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

  async function loadX402ListStatus(){
    setBusy("x402-list-status"); setX402ListStatus(null);
    try{setX402ListStatus(await adminCall("/api/radar/x402-list"))}
    finally{setBusy("")}
  }

  async function verifyX402List(){
    setBusy("x402-list-verify"); setX402ListStatus(null);
    try{setX402ListStatus(await adminCall("/api/radar/x402-list","POST"))}
    finally{setBusy("")}
  }

  async function seedBazaar(){
    setBusy("bazaar"); setBazaar(null);
    try{setBazaar(await adminCall("/api/radar/test-bazaar","POST"))}
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
  const upstreams=yieldAudit?.portfolio?.upstreamsConfigured;
  const auditDisplay=yieldAudit?{
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
    needsConfig:yieldAudit.needsConfig?.slice(0,12),
    autoLive:yieldAudit.autoLive?.slice(0,18),
    unresolved:yieldAudit.unresolved?.slice(0,18),
  }:null;

  return <main style={{maxWidth:1000,margin:"0 auto",padding:"40px 24px 80px",fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace"}}>
    <div style={{fontSize:11,letterSpacing:2.2,color:"#817966"}}>PENNYRAIL</div>
    <h1 style={{fontSize:28,fontWeight:500,margin:"14px 0 8px"}}>Machine revenue.</h1>
    <p style={{color:"#777",fontSize:12,lineHeight:1.7,margin:"0 0 24px"}}>
      transaction router · free intent → paid execution · target ≥ $1,000/day · outside revenue only.
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
        {r?.firstSale?"✓ Outside settlement detected.":"No outside sale detected yet."}
        {revenue?.asOf?` · snapshot ${new Date(revenue.asOf).toLocaleString()}`:""}
      </div>
      {r?.firstSale?<div style={{fontSize:10,color:"#666",marginTop:6}}>Directory verification and internal distribution seeds can create real settlements; repeat/unknown buyers are the organic revenue signal.</div>:null}
      <button disabled={!hasAdmin||!!busy} onClick={refreshRevenue} style={primary}>
        {busy==="revenue"?"Checking chain…":"Refresh revenue"}
      </button>
      {revenue?.basescan?<a href={revenue.basescan} target="_blank" rel="noreferrer" style={link}>Open BaseScan ↗</a>:null}
      {revenue?.error?<JsonBox value={revenue}/>:null}
    </section>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>REVENUE ENGINE · PROVEN DEMAND BROKER</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        PennyRail buys the proven-working Agent402 Bestsellers signal, maps paid demand only to exact implementations, aligns common price points, and exposes configured products automatically. Demand Radar remains disabled while its upstream itemized feed is empty.
      </p>
      <button disabled={!hasAdmin||!!busy} onClick={loadYieldAudit} style={primary}>
        {busy==="yield"?"Auditing machine demand…":"Audit revenue gaps"}
      </button>
      <a href="/api/revenue/catalog" target="_blank" rel="noreferrer" style={link}>Open machine catalog ↗</a>
      {yieldAudit?.portfolio?<div style={{...metrics,marginTop:14}}>
        <Metric title="Revenue routes live" value={String(yieldAudit.portfolio.totalRevenueRoutesLive||0)}/>
        <Metric title="Demand aliases" value={String(yieldAudit.portfolio.demandAliasesLive||0)}/>
        <Metric title="Auto-live gaps" value={String(yieldAudit.autoLive?.length||0)}/>
        <Metric title="Needs config" value={String(yieldAudit.needsConfig?.length||0)}/>
        <Metric title="Needs primitive" value={String(yieldAudit.unresolved?.length||0)}/>
        <Metric title="Paid bestseller rows" value={String(yieldAudit.sources?.bestsellerRowsExtracted||0)}/>
        <Metric title="Live mapped" value={yieldAudit.portfolio?.provenBestsellerRows?`${yieldAudit.portfolio.provenBestsellerMapped||0}/${yieldAudit.portfolio.provenBestsellerRows}`:"—"}/>
        <Metric title="Potential mapped" value={yieldAudit.portfolio?.provenBestsellerRows?`${yieldAudit.portfolio.provenBestsellerPotentialMapped||0}/${yieldAudit.portfolio.provenBestsellerRows}`:"—"}/>
      </div>:null}
      {upstreams?<div style={{fontSize:11,lineHeight:1.8,color:"#aaa",marginTop:12}}>
        OpenAI revenue broker: <b style={{color:upstreams.openAi?"#b8c9a8":"#d2aa83"}}>{upstreams.openAi?"configured ✓":"needs OPENAI_API_KEY"}</b>
      </div>:null}
      {yieldAudit?<JsonBox value={auditDisplay} copyValue={yieldAudit} copyLabel="Copy full JSON"/>:null}
    </section>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>TRANSACTION ROUTER · REVENUE-FIRST</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        One free buyer interface over the full PennyRail portfolio: FIND → QUOTE → one paid EXECUTE. Ambiguous intent is rejected before execution so PennyRail does not charge for guessed tools.
      </p>
      <a href="/api/router/find?q=web%20search" target="_blank" rel="noreferrer" style={link}>Test free find ↗</a>
      <a href="/openapi.json" target="_blank" rel="noreferrer" style={link}>Router OpenAPI ↗</a>
      <button disabled={!hasAdmin||!!busy||Boolean(bazaar?.ok)} onClick={seedBazaar} style={button}>
        {busy==="bazaar"?"Seeding Coinbase Bazaar…":bazaar?.ok?"Bazaar seed complete ✓":"Seed Coinbase Bazaar · max $0.02"}
      </button>
      <div style={{fontSize:10,color:"#666",marginTop:10}}>Machine entrypoints: /api/router/find · /api/router/quote · /api/router/execute/&lt;tier&gt; · /api/bazaar/web-search</div>
      {bazaar?<JsonBox value={bazaar}/>:null}
    </section>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>OUTBOUND SALES · THE402</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        PennyRail can sell fixed-price services in the402 catalog and subscribe to real-time request.created pushes. Matching requests are bid automatically and winning jobs are fulfilled through the Revenue Engine. Registration costs at most $0.01 once; listing, notifications, bidding with the API key and fulfillment are free platform API calls.
      </p>
      <button disabled={!hasAdmin||!!busy||Boolean(the402Registration?.ok)} onClick={registerThe402} style={primary}>
        {busy==="the402-register"?"Registering provider…":"1 · Register the402 provider · max $0.01"}
      </button>
      <button disabled={!hasAdmin||!!busy} onClick={activateThe402} style={button}>
        {busy==="the402-activate"?"Activating sales…":"2 · Activate listings + auto-bidding"}
      </button>
      <button disabled={!hasAdmin||!!busy} onClick={()=>loadThe402Status(false)} style={button}>
        {busy==="the402-status"?"Checking…":"Status + earnings"}
      </button>
      <button disabled={!hasAdmin||!!busy} onClick={()=>loadThe402Status(true)} style={button}>
        Sweep requests now
      </button>
      {the402Registration?.ok?<div style={{fontSize:11,lineHeight:1.7,color:"#d0c7b4",marginTop:14}}>
        Registration complete. Copy the three returned environment variables into Vercel Production, redeploy once, then click <b>Activate listings + auto-bidding</b>. Do not commit the API key or webhook secret.
      </div>:null}
      {the402Registration?<JsonBox value={the402Registration}/>:null}
      {the402Activation?<JsonBox value={the402Activation}/>:null}
      {the402Status?<JsonBox value={the402Status}/>:null}
    </section>

    <section style={{...box,marginBottom:16}}>
      <div style={label}>DISTRIBUTION · X402 LIST</div>
      <p style={{color:"#777",fontSize:11,lineHeight:1.7,margin:"0 0 12px"}}>
        PennyRail is approved, payment-ready and delivery-verified on x402 List. Verification is a distribution/trust signal; it is not organic customer revenue.
      </p>
      <button disabled={!hasAdmin||!!busy} onClick={loadX402ListStatus} style={primary}>
        {busy==="x402-list-status"?"Checking x402 List…":"Check x402 List"}
      </button>
      <button disabled={!hasAdmin||!!busy||Boolean(x402ListStatus?.listing?.verified)} onClick={verifyX402List} style={button}>
        {busy==="x402-list-verify"?"Paying + verifying…":x402ListStatus?.listing?.verified?"Verified ✓":"Verify delivery · max $0.30"}
      </button>
      <a href="https://x402-list.com/services/pennyrail" target="_blank" rel="noreferrer" style={link}>Open PennyRail listing ↗</a>
      {x402ListStatus?.listing?<div style={{...metrics,marginTop:14}}>
        <Metric title="Status" value={String(x402ListStatus.listing.status||"—")}/>
        <Metric title="Payment-ready" value={x402ListStatus.listing.payment_ready?"YES":"NO"}/>
        <Metric title="Verified" value={x402ListStatus.listing.verified?"YES":"NO"}/>
        <Metric title="Endpoints" value={String(x402ListStatus.listing.endpoint_count??"—")}/>
      </div>:null}
      {x402ListStatus?<JsonBox value={x402ListStatus}/>:null}
    </section>

    <section style={box}>
      <div style={label}>CONTROL</div>
      {authChecked&&rememberedAuth?<div style={{fontSize:11,color:"#b8c9a8",marginBottom:12}}>Admin access remembered on this browser ✓</div>:null}
      {!rememberedAuth?<>
        <input value={token} onChange={(e:any)=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" type="password" autoComplete="off" style={input}/>
        <button disabled={!token||!!busy} onClick={rememberAccess} style={primary}>{busy==="remember"?"Remembering…":"Remember admin access"}</button>
      </>:<button disabled={!!busy} onClick={forgetAccess} style={button}>{busy==="forget"?"Forgetting…":"Forget admin access"}</button>}
      {authResult?.error?<div style={{fontSize:11,color:"#d38c8c",marginTop:10}}>{authResult.error}</div>:null}
      <div style={{marginTop:12}}>
        <button disabled={!hasAdmin||!!busy} onClick={publish} style={primary}>
          {busy==="publish"?"Publishing inventory…":"Publish inventory"}
        </button>
        <button disabled={!!busy} onClick={loadCatalog} style={button}>
          {busy==="catalog"?"Loading…":"Inventory check"}
        </button>
        <a href="https://www.x402scan.com/resources/register" target="_blank" rel="noreferrer" style={link}>Add to x402scan ↗</a>
      </div>
      <div style={{fontSize:10,color:"#666",marginTop:10}}>Origin to register: pennyrail.vercel.app</div>
    </section>

    {publication?<JsonBox value={publication}/>:null}
    {catalog?<JsonBox value={{capabilityCount:catalog.capabilityCount,priceUsdPerRun:catalog.priceUsdPerRun,firstFive:catalog.capabilities?.slice(0,5)}}/>:null}

    <section style={{...box,marginTop:16,color:"#777",fontSize:11,lineHeight:1.7}}>
      Transaction Router live: free intent discovery + free quote + one paid execution tier over exact paid-demand mappings, market-aligned micro-prices and the OpenAI broker. Distribution: x402scan + Agent402 + true402 + x402 List Verified + official MCP Registry + isolated Coinbase Bazaar indexing test; the402 remains additive when its provider registration reopens.
    </section>
  </main>
}

function JsonBox({value,copyValue,copyLabel="Copy JSON"}:{value:any,copyValue?:any,copyLabel?:string}){
  const [copied,setCopied]=useState(false);
  const display=JSON.stringify(value,null,2);
  const copy=JSON.stringify(copyValue??value,null,2);
  async function doCopy(){
    try{await navigator.clipboard.writeText(copy);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{}
  }
  return <div style={{position:"relative",marginTop:16}}>
    <button onClick={doCopy} style={copyButton}>{copied?"Copied ✓":copyLabel}</button>
    <pre style={{...pre,marginTop:0,paddingTop:46}}>{display}</pre>
  </div>
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
const pre={padding:14,background:"#08090b",border:"1px solid #23262b",fontSize:10,whiteSpace:"pre-wrap",overflow:"auto",maxHeight:520} as const;
const copyButton={...button,position:"absolute",right:8,top:8,zIndex:2,marginRight:0,padding:"7px 10px",fontSize:10,background:"#1a1d22"} as const;
