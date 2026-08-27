"use client";
import { useState } from "react";

export default function Home(){
 const [market,setMarket]=useState<any>(null); const [paid,setPaid]=useState<any>(null); const [token,setToken]=useState('');
 async function loadMarket(){setMarket(await (await fetch('/api/radar/market')).json())}
 async function loadPaid(){setPaid(await (await fetch('/api/radar/paid',{headers:{'x-admin-token':token}})).json())}
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'44px 24px'}}>
  <div style={{fontSize:12,letterSpacing:3,color:'#b7a77f'}}>PENNYRAIL</div>
  <h1 style={{fontSize:48,margin:'12px 0'}}>Robot tollbooth lab.</h1>
  <p style={{maxWidth:760,color:'#aaa',lineHeight:1.6}}>Watch paid agent demand. Publish tiny tools. Keep the ones machines actually buy.</p>
  <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,marginTop:32}}>
   <div style={card}><h2>Market radar</h2><p style={muted}>Free Agent402 marketplace/index signals.</p><button style={btn} onClick={loadMarket}>Refresh market</button><pre style={pre}>{market?JSON.stringify(market,null,2):'Not loaded'}</pre></div>
   <div style={card}><h2>Paid demand radar</h2><p style={muted}>Buys Agent402 Demand Radar + Bestsellers for $0.005 each when a funded buyer wallet is configured.</p><input value={token} onChange={e=>setToken(e.target.value)} placeholder="RADAR_ADMIN_TOKEN" style={input}/><button style={btn} onClick={loadPaid}>Buy fresh intelligence</button><pre style={pre}>{paid?JSON.stringify(paid,null,2):'Not loaded'}</pre></div>
  </section>
  <section style={{marginTop:32,...card}}><h2>First PennyTools</h2><p style={muted}>These are intentionally cheap sacrificial endpoints. They prove discovery/payment before Radar chooses the next tools.</p><ul style={{lineHeight:2}}><li><code>/api/tools/json-canonicalize</code> — $0.001</li><li><code>/api/tools/text-stats</code> — $0.001</li><li><code>/api/tools/strip-tracking</code> — $0.001</li></ul></section>
 </main>
}
const card={border:'1px solid #23252b',background:'#111317',borderRadius:18,padding:20} as const;
const muted={color:'#999',lineHeight:1.5} as const; const btn={background:'#e8dfcd',color:'#111',border:0,borderRadius:10,padding:'10px 14px',fontWeight:700,cursor:'pointer',margin:'8px 0'} as const;
const pre={maxHeight:360,overflow:'auto',fontSize:11,background:'#090a0c',padding:12,borderRadius:10,whiteSpace:'pre-wrap'} as const; const input={width:'100%',padding:10,borderRadius:9,border:'1px solid #333',background:'#0b0c0f',color:'#eee',marginBottom:4} as const;
