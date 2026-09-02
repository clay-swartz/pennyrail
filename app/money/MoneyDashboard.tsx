"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AnyObj = Record<string, any>;

function money(value: unknown, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `$${number.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function number(value: unknown, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function percent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${(parsed * 100).toFixed(1)}%`;
}

function localTime(value: unknown) {
  if (!value) return "—";
  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function shortAddress(value: unknown) {
  const address = String(value || "");
  if (address.length < 18) return address || "—";
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function Metric({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #262a30",
        padding: "18px",
        minHeight: 108,
        background: emphasis ? "#121923" : "#0d1014",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          color: "#747a82",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: emphasis ? 28 : 22,
          lineHeight: 1.1,
          color: emphasis ? "#f1eee6" : "#d4d0c8",
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 10, color: "#676d74", marginTop: 10, lineHeight: 1.5 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 34 }}>
      {kicker ? (
        <div
          style={{
            fontSize: 10,
            letterSpacing: 1.8,
            color: "#666c74",
            marginBottom: 7,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: 17,
          fontWeight: 500,
          color: "#d7d2c8",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function MoneyDashboard() {
  const [data, setData] = useState<AnyObj | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/autopilot/status", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 401) {
        setAuthRequired(true);
        setData(null);
        return;
      }

      const body = await response.json();
      setData(body);
      setAuthRequired(false);
      setLastRefresh(new Date());
    } catch (error) {
      setData({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setAuthError("");

    try {
      const response = await fetch("/api/radar/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        setAuthError("That admin token was not accepted.");
        return;
      }

      setToken("");
      await load();
    } catch {
      setAuthError("Could not sign in.");
    }
  }

  const running = Boolean(data?.running) && !data?.stale;
  const scoreboard = data?.scoreboard || {};
  const kalshi = data?.kalshi || {};
  const radar = data?.radar || {};
  const payment = data?.paymentRail || {};
  const markets = Array.isArray(kalshi?.topPersistentMarkets)
    ? kalshi.topPersistentMarkets
    : [];
  const errors = Array.isArray(data?.errors) ? data.errors : [];

  const statusText = loading
    ? "CHECKING"
    : running
      ? "RUNNING"
      : data?.stale
        ? "STALE"
        : "NOT RUNNING";

  const statusColor = loading
    ? "#999"
    : running
      ? "#9fc79f"
      : "#d2a080";

  const actualRevenue = useMemo(
    () => money(scoreboard?.actualExternalRevenueApprox24hUsd),
    [scoreboard?.actualExternalRevenueApprox24hUsd],
  );

  if (authRequired) {
    return (
      <main style={shellStyle}>
        <div style={{ width: "100%", maxWidth: 470 }}>
          <div style={eyebrowStyle}>PENNYRAIL // PRIVATE</div>
          <h1 style={{ margin: "18px 0 8px", fontSize: 30, fontWeight: 500 }}>
            Money dashboard.
          </h1>
          <p style={{ color: "#777d84", lineHeight: 1.65, fontSize: 12 }}>
            Use the existing Radar admin token once. PennyRail will keep the private
            session in this browser for 30 days.
          </p>

          <form onSubmit={signIn} style={{ marginTop: 26 }}>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Radar admin token"
              autoComplete="current-password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #30353b",
                background: "#0b0d10",
                color: "#e2ddd3",
                padding: "13px 14px",
                font: "inherit",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                marginTop: 10,
                width: "100%",
                border: "1px solid #3a4047",
                background: "#171b20",
                color: "#dcd7ce",
                padding: "12px 14px",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Open dashboard
            </button>
            {authError ? (
              <div style={{ color: "#d49a86", fontSize: 11, marginTop: 12 }}>
                {authError}
              </div>
            ) : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <div style={{ width: "100%", maxWidth: 1040 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={eyebrowStyle}>PENNYRAIL // MONEY</div>
            <h1
              style={{
                margin: "15px 0 6px",
                fontSize: "clamp(28px, 5vw, 42px)",
                lineHeight: 1,
                fontWeight: 500,
                letterSpacing: "-.03em",
              }}
            >
              The scoreboard.
            </h1>
            <div style={{ color: "#71777e", fontSize: 11, lineHeight: 1.6 }}>
              Real money is separated from modeled opportunity. Always.
            </div>
          </div>

          <div style={{ textAlign: "right", fontSize: 10, lineHeight: 1.8 }}>
            <div>
              AUTOPILOT{" "}
              <span style={{ color: statusColor, fontWeight: 600 }}>
                {statusText}
              </span>
            </div>
            <div style={{ color: "#666c73" }}>
              LAST TICK {localTime(data?.lastTickAt)}
            </div>
            <div style={{ color: "#50565d" }}>
              refreshed {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
            </div>
          </div>
        </header>

        {data?.error ? (
          <div
            style={{
              marginTop: 24,
              padding: 14,
              border: "1px solid #583b34",
              color: "#d2a08d",
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            {String(data.error)}
          </div>
        ) : null}

        <Section title="Actual money" kicker="SOURCE OF TRUTH">
          <div style={gridStyle}>
            <Metric
              label="OUTSIDE REVENUE · ~24H"
              value={actualRevenue}
              sub="External Base USDC transfers only. PennyRail's own buyer/test wallet is excluded."
              emphasis
            />
            <Metric
              label="OUTSIDE PAYERS · ~24H"
              value={number(scoreboard?.actualExternalPayersApprox24h)}
            />
            <Metric
              label="OUTSIDE PAYMENTS · ~24H"
              value={number(scoreboard?.actualExternalTransfersApprox24h)}
            />
            <Metric
              label="INTERNAL / TEST · EXCLUDED"
              value={money(scoreboard?.internalBootstrapExcludedUsd)}
              sub="Never counted as revenue."
            />
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px solid #23272d",
              padding: "14px 16px",
              display: "flex",
              gap: 18,
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 11,
            }}
          >
            <div>
              <span style={{ color: "#666d74" }}>RECEIVING WALLET </span>
              <span style={{ color: "#c6c2ba" }}>
                {shortAddress(payment?.payTo)}
              </span>
              <span style={{ color: "#535a61", marginLeft: 10 }}>
                {String(payment?.asset || "USDC")} · {String(payment?.network || "—")}
              </span>
            </div>
            {payment?.explorerUrl ? (
              <a
                href={String(payment.explorerUrl)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#9aa9ba", textDecoration: "none" }}
              >
                View on BaseScan ↗
              </a>
            ) : null}
          </div>
        </Section>

        <Section title="Kalshi paper evidence" kicker="NOT REAL MONEY">
          <div style={gridStyle}>
            <Metric
              label="MODELED NET / DAY"
              value={money(scoreboard?.paperNetRunRateUsdPerDay)}
              sub="Only meaningful after enough persistent evidence."
            />
            <Metric
              label="MODELED REWARDS / DAY"
              value={money(scoreboard?.paperRewardRunRateUsdPerDay)}
            />
            <Metric
              label="MODELED TRADING / DAY"
              value={money(scoreboard?.paperTradeRunRateUsdPerDay)}
            />
            <Metric
              label="PAPER SAMPLES"
              value={number(scoreboard?.paperSamples)}
              sub={`Coverage ${percent(scoreboard?.paperCoverage)} · gate hit ${percent(
                scoreboard?.paperGateHitRate,
              )}`}
            />
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px solid #272c32",
              padding: 16,
              fontSize: 11,
              lineHeight: 1.7,
              color: "#858b92",
            }}
          >
            <div>
              <span style={{ color: "#666d74" }}>LIVE CAPITAL GATE </span>
              <strong
                style={{
                  color: scoreboard?.liveCapitalReady ? "#9fc79f" : "#caab82",
                  fontWeight: 600,
                }}
              >
                {scoreboard?.liveCapitalReady ? "READY FOR HUMAN REVIEW" : "NOT READY"}
              </strong>
            </div>
            <div style={{ marginTop: 6 }}>
              {String(scoreboard?.gateReason || "—")}
            </div>
          </div>

          <div style={{ ...gridStyle, marginTop: 12 }}>
            <Metric
              label="LAST SNAPSHOT · SCHEDULED GROSS 24H"
              value={money(kalshi?.last?.scheduledGross24h)}
            />
            <Metric
              label="LAST SNAPSHOT · CAPITAL"
              value={money(kalshi?.last?.capital)}
            />
            <Metric
              label="LAST SNAPSHOT · MARKETS"
              value={number(kalshi?.last?.marketCount)}
            />
            <Metric
              label="POSSIBLE-FILL INTERVALS"
              value={`${number(kalshi?.tradeIntervalsWithPossibleFill)} / ${number(
                kalshi?.tradeIntervals,
              )}`}
            />
          </div>

          {markets.length ? (
            <div style={{ marginTop: 18, overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 680,
                  fontSize: 10,
                }}
              >
                <thead>
                  <tr style={{ color: "#666d74", textAlign: "left" }}>
                    <th style={thStyle}>MARKET</th>
                    <th style={thStyle}>SELECTED</th>
                    <th style={thStyle}>PAPER REWARD</th>
                    <th style={thStyle}>POSSIBLE FILLS</th>
                    <th style={thStyle}>TRADE NET</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.slice(0, 10).map((row: AnyObj) => (
                    <tr key={String(row?.t)} style={{ borderTop: "1px solid #20242a" }}>
                      <td style={tdStyle}>{String(row?.t || "—")}</td>
                      <td style={tdStyle}>{number(row?.selected)}</td>
                      <td style={tdStyle}>{money(row?.reward, 4)}</td>
                      <td style={tdStyle}>{number(row?.possibleFill)}</td>
                      <td style={tdStyle}>{money(row?.netTrade, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Section>

        <Section title="Other money lanes" kicker="RADAR">
          <div style={gridStyle}>
            <Metric label="CURRENT PRIMARY" value={String(radar?.primary || "—")} />
            <Metric
              label="CROSS-VENUE ARBS"
              value={number(radar?.crossVenueArbCount)}
              sub={
                radar?.topCrossVenueGrossEdge == null
                  ? "No qualifying edge recorded."
                  : `Top gross edge ${money(radar.topCrossVenueGrossEdge, 4)}`
              }
            />
            <Metric
              label="X402 HUNTER"
              value={
                radar?.x402HunterOk == null
                  ? "—"
                  : radar.x402HunterOk
                    ? "HEALTHY"
                    : "ERROR"
              }
            />
            <Metric
              label="AGENT402"
              value={
                radar?.x402Agent402Registered == null
                  ? "—"
                  : radar.x402Agent402Registered
                    ? "REGISTERED"
                    : "NOT REGISTERED"
              }
            />
          </div>
        </Section>

        {errors.length ? (
          <Section title="Needs attention" kicker="ERRORS">
            <div
              style={{
                border: "1px solid #483932",
                background: "#120f0e",
                padding: 16,
                fontSize: 10,
                color: "#b99a8d",
                lineHeight: 1.7,
              }}
            >
              {errors.map((error: unknown, index: number) => (
                <div key={index}>{String(error)}</div>
              ))}
            </div>
          </Section>
        ) : null}

        <footer
          style={{
            borderTop: "1px solid #20242a",
            marginTop: 40,
            paddingTop: 16,
            color: "#484e55",
            fontSize: 9,
            lineHeight: 1.7,
          }}
        >
          PennyRail only labels outside wallet inflows as actual revenue. Kalshi,
          arbitrage and opportunity figures remain paper/model data until money
          actually settles.
        </footer>
      </div>
    </main>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#090b0e",
  color: "#d7d2c8",
  padding: "clamp(24px, 5vw, 60px)",
  boxSizing: "border-box",
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2.1,
  color: "#747a82",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 10,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: "11px 8px",
  color: "#aaa69e",
};
