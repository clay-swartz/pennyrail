import MoneyDashboard from "./MoneyDashboard";
import PortfolioPanel from "./PortfolioPanel";
export const metadata = { title: "PennyRail Money", robots: { index: false, follow: false } };
export default function MoneyPage() { return <><MoneyDashboard /><PortfolioPanel /></>; }
