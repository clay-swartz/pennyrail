import type { ReactNode } from "react";
export const metadata = {
  title: "PennyRail / Resource Node",
  description: "Machine-readable settlement service",
  robots: { index: false, follow: false, nocache: true },
};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body style={{margin:0,background:'#090a0c',color:'#eee',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}
