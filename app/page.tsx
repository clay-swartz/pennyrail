export default function Home(){
  const rows = [
    ["STATUS", "OPERATIONAL"],
    ["PROTOCOL", "x402"],
    ["NETWORK", "BASE"],
    ["SETTLEMENT", "USDC"],
    ["INTERFACE", "MACHINE"],
  ];
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"32px",boxSizing:"border-box"}}>
    <section style={{width:"100%",maxWidth:680,border:"1px solid #202329",background:"#0d0f12",padding:"28px 30px",boxSizing:"border-box"}}>
      <div style={{fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:11,letterSpacing:2.4,color:"#827c6f"}}>PENNYRAIL // RESOURCE NODE</div>
      <h1 style={{fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:"clamp(24px,4vw,34px)",fontWeight:500,margin:"22px 0 8px",letterSpacing:"-.02em"}}>Settlement index.</h1>
      <p style={{fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:12,lineHeight:1.7,color:"#777",margin:"0 0 26px"}}>Machine-readable service endpoint. No interactive surface at this location.</p>
      <div style={{borderTop:"1px solid #202329"}}>
        {rows.map(([k,v])=><div key={k} style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:16,padding:"11px 0",borderBottom:"1px solid #181b20",fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:11}}>
          <span style={{color:"#5f625f"}}>{k}</span><span style={{color:"#b4b0a5"}}>{v}</span>
        </div>)}
      </div>
      <div style={{fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:10,color:"#464a4d",marginTop:24}}>PR-BASE-001 / PUBLIC SERVICE RECORD</div>
    </section>
  </main>
}
