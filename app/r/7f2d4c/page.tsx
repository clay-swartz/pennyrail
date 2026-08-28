"use client";
import { useState } from "react";

export default function Home(){
 const [opportunities,setOpportunities]=useState<any>(null);
 const [registration,setRegistration]=useState<any>(null);
 const [market,setMarket]=useState<any>(null);
 const [paid,setPaid]=useState<any>(null);
 const [wallet,setWallet]=useState<any>(null);
 const [selfTest,setSelfTest]=useState<any>(null);
 const [diagnostics,setDiagnostics]=useState<any>(null);
 const [token,setToken]=useState("");
 const [busy,setBusy]=useState("");
 async function adminCall(path:string,method="GET"){
   return (await fetch(path,{method,headers:{"x-admin-token":token}})).json();
 }
 async function scan(){setBusy("scan");try{setOpportunities(await adminCall("/api/radar/opportunities"))}finally{setBusy("")}}
 async function registerSeller(){setBusy("register");try{setRegistration(await adminCall("/api/radar/register","POST"))}finally{setBusy("")}}
 async function loadMarket(){setMarket(await (await fetch("/api/radar/market")).json())}
 async function loadPaid(){setPaid(await adminCall("/api/radar/paid"))}
 async function loadWallet(){setWallet(await adminCall("/api/radar/wallet"))}
 async function fundWallet(){setWallet(await adminCall("/api/radar/wallet","POST"))}
 async function runSelfTest(){setSelfTest(await adminCall("/api/radar/self-test","POST"))}
 async function runDiagnostics(){setDiagnostics(await adminCall("/api/radar/diagnostics"))}
 const rows=opportunities?.opportunities||[];
 return <main style={{maxWidth:1160,margin:"0 auto",padding:"48px 24px 80px"}}>
  <div style={{fontSize:12,letterSpacing:3,color:"#b7a77f"}}>PENNYRAIL</div>
  <h1 style={{fontSize:"clamp(38px,6vw,64px)",lineHeight:1.02,margin:"14px 0 12px",maxWidth:850}}>Find demand. Ship tollbooths.</h1>
  <p style={{maxWidth:780,color:"#aaa",lineHeight:1.65,fontSize:17}}>Watch what agents ask for, check whether anyone serves it well, then publish the smallest paid function that closes the gap.</p>

  <section style={{...card,marginTop:30}}>
    <div style={{display:"flex",gap:18,justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap"}}>
      <div><div style={eyebrow}>CONTROL</div><h2 style={{margin:"7px 0 6px"}}>Radar access</h2><p style={{...muted,margin:0}}>Your admin token stays in this browser tab. Scanning the free radar costs nothing.</p></div>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={{...input,maxWidth:430}}/>
    </div>
  </section>

  <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(280px,.7fr)",gap:16,marginTop:16}} className="radar-grid">
    <div style={heroCard}>
      <div style={eyebrow}>01 · RADAR</div>
      <h2 style={{fontSize:30,margin:"10px 0 8px"}}>What should PennyRail build?</h2>
      <p style={{...muted,maxWidth:650}}>Pull live unmet requests from Agent402, check current supply, then rank the gaps as BUILD / WATCH / IGNORE.</p>
      <button style={primaryBtn} onClick={scan} disabled={busy==="scan"}>{busy==="scan"?"Scanning…":"Scan live gaps"}</button>
      {opportunities?.error?<pre style={pre}>{JSON.stringify(opportunities,null,2)}</pre>:null}
      {rows.length?<div style={{marginTop:20,display:"grid",gap:10}}>{rows.slice(0,8).map((r:any,i:number)=><div key={i} style={oppRow}>
        <div style={{minWidth:82}}><span style={{...pill,...(r.action==="BUILD"?buildPill:r.action==="WATCH"?watchPill:ignorePill)}}>{r.action}</span><div style={{fontSize:11,color:"#777",marginTop:7}}>score {r.score}</div></div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:17,fontWeight:700}}>{r.text}</div><div style={{fontSize:12,color:"#999",marginTop:6,lineHeight:1.5}}>{r.reasons?.join(" · ")}</div>{r.supply?.best?.name?<div style={{fontSize:11,color:"#756f64",marginTop:5}}>Closest supply: {r.supply.best.name}{r.supply.best.price?` · ${r.supply.best.price}`:""}</div>:null}</div>
      </div>)}</div>:<div style={emptyState}>No scan yet. The first useful output should be a short list, not a wall of marketplace data.</div>}
    </div>

    <div style={card}>
      <div style={eyebrow}>02 · SELL</div>
      <h2 style={{margin:"10px 0 8px"}}>Open the booth</h2>
      <p style={muted}>Once Vercel is set to <code>X402_MODE=mainnet</code>, submit PennyRail's public x402 manifest to Agent402's open index.</p>
      <button style={btn} onClick={registerSeller} disabled={busy==="register"}>{busy==="register"?"Submitting…":"List PennyRail"}</button>
      <pre style={pre}>{registration?JSON.stringify(registration,null,2):"Not submitted yet"}</pre>
    </div>
  </section>

  <section style={{...card,marginTop:16}}>
    <div style={eyebrow}>03 · CURRENT INVENTORY</div>
    <h2 style={{margin:"10px 0 6px"}}>Three live PennyTools</h2>
    <p style={muted}>These were built to prove the rail. Keep them live as cheap inventory while Radar chooses the first demand-led tool.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginTop:14}}>
      <div style={mini}><strong>JSON canonicalize</strong><span>/api/tools/json-canonicalize</span><b>$0.001</b></div>
      <div style={mini}><strong>Text stats</strong><span>/api/tools/text-stats</span><b>$0.001</b></div>
      <div style={mini}><strong>Strip tracking</strong><span>/api/tools/strip-tracking</span><b>$0.001</b></div>
    </div>
  </section>

  <details style={{...card,marginTop:16}}>
    <summary style={{cursor:"pointer",fontWeight:700}}>Infrastructure / deeper intel</summary>
    <p style={muted}>The rail is already proven. These controls stay available without dominating the product.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
      <div style={miniCard}><h3>Market snapshot</h3><button style={btn} onClick={loadMarket}>Refresh market</button><pre style={pre}>{market?JSON.stringify(market,null,2):"Not loaded"}</pre></div>
      <div style={miniCard}><h3>Paid intelligence</h3><p style={muted}>Requires Base mainnet USDC in PennyRail's buyer wallet.</p><button style={btn} onClick={loadPaid}>Buy Demand Radar + Bestsellers</button><pre style={pre}>{paid?JSON.stringify(paid,null,2):"Not purchased"}</pre></div>
      <div style={miniCard}><h3>Buyer wallet</h3><button style={btn} onClick={loadWallet}>Show wallet</button><button style={{...btn,marginLeft:8}} onClick={fundWallet}>Testnet faucet</button><pre style={pre}>{wallet?JSON.stringify(wallet,null,2):"Not loaded"}</pre></div>
      <div style={miniCard}><h3>Rail self-test</h3><button style={btn} onClick={runSelfTest}>Run self-test</button><pre style={pre}>{selfTest?JSON.stringify(selfTest,null,2):"Not run"}</pre></div>
      <div style={miniCard}><h3>Coinbase diagnostics</h3><button style={btn} onClick={runDiagnostics}>Run diagnostics</button><pre style={pre}>{diagnostics?JSON.stringify(diagnostics,null,2):"Not run"}</pre></div>
    </div>
  </details>
  <style jsx>{`@media(max-width:800px){.radar-grid{grid-template-columns:1fr!important}}`}</style>
 </main>
}
const card={border:"1px solid #23252b",background:"#111317",borderRadius:18,padding:20} as const;
const heroCard={...card,background:"linear-gradient(145deg,#15171b,#0e1013)"} as const;
const miniCard={border:"1px solid #24262a",borderRadius:14,padding:14,background:"#0d0f12"} as const;
const muted={color:"#999",lineHeight:1.55} as const;
const eyebrow={fontSize:11,letterSpacing:2.2,color:"#9f9272"} as const;
const btn={background:"#e8dfcd",color:"#111",border:0,borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer",margin:"8px 0"} as const;
const primaryBtn={...btn,padding:"13px 18px",marginTop:10,fontSize:15} as const;
const pre={maxHeight:260,overflow:"auto",fontSize:10,background:"#090a0c",padding:12,borderRadius:10,whiteSpace:"pre-wrap",color:"#aaa"} as const;
const input={width:"100%",padding:11,borderRadius:9,border:"1px solid #333",background:"#0b0c0f",color:"#eee"} as const;
const emptyState={marginTop:20,border:"1px dashed #303238",borderRadius:13,padding:18,color:"#777",fontSize:13,lineHeight:1.55} as const;
const oppRow={display:"flex",gap:14,alignItems:"flex-start",padding:"13px 0",borderTop:"1px solid #24262a"} as const;
const pill={display:"inline-block",padding:"4px 7px",borderRadius:999,fontSize:10,fontWeight:800,letterSpacing:1} as const;
const buildPill={background:"#d9d0b9",color:"#151515"} as const;
const watchPill={background:"#292a27",color:"#d4c8a9",border:"1px solid #4a473e"} as const;
const ignorePill={background:"#191b1e",color:"#777",border:"1px solid #292b2e"} as const;
const mini={border:"1px solid #25272b",borderRadius:13,padding:14,display:"flex",flexDirection:"column",gap:8,background:"#0d0f12"} as const;
