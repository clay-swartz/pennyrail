import type { ReactNode } from "react";
export const metadata = { title: "PennyRail", description: "Agent-demand radar + paid microtools" };
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body style={{margin:0,background:'#090a0c',color:'#eee',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}
