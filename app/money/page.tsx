import MoneyDashboard from "./MoneyDashboard";

export const metadata = {
  title: "PennyRail Money",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MoneyPage() {
  return <MoneyDashboard />;
}
