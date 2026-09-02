export default function PermitRailPrivacy() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1>PermitRail Privacy</h1>
      <p><strong>Last updated:</strong> September 2, 2026</p>
      <p>PermitRail's product data is derived from public government records. We do not purchase private homeowner contact lists for this service.</p>
      <h2>Billing</h2>
      <p>Subscription checkout is handled by Stripe. Stripe processes payment-card and billing information under its own privacy practices. PermitRail does not receive or store complete card numbers.</p>
      <h2>Access data</h2>
      <p>PermitRail may process ordinary server logs, request parameters, subscription identifiers, usage counts, and payment status to operate the service, prevent abuse, enforce plan limits, and measure actual revenue.</p>
      <h2>Public-record data</h2>
      <p>Some government project records contain names or addresses. PermitRail republishes only fields used for lawful project intelligence. Dallas 311 street numbers are masked in PermitRail's normalized feed because that source is used as area-level distress context rather than a homeowner-contact product.</p>
      <h2>Retention</h2>
      <p>The autonomous engine stores compact operational summaries and revenue/accounting records needed to run the service. Live project feeds are regenerated from their cited public sources.</p>
      <p><a href="/permitrail">Back to PermitRail</a></p>
    </main>
  );
}
