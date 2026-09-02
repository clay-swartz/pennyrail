import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { permitRailStripeRevenue24h } from "@/lib/permitrail-stripe-revenue";
import { scanPermitRailProspects, type PermitRailProspect } from "@/lib/permitrail-prospects";

const NTFY = "https://ntfy.sh";
const SCHEDULER = "https://aisenseapi.com/services/v1/webhook_schedule";
const SMARTLEAD = "https://server.smartlead.ai/api/v1";
const SMARTPROSPECT = "https://prospect-api.smartlead.ai/api/v1/search-email-leads";
const RUN_EVERY_SECONDS = 6 * 60 * 60;
const CAMPAIGN_NAME = "PermitRail DFW Contractor Opportunity Alerts";

export type PermitRailAcquisitionState = {
  v: 1;
  startedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  prospectCount: number;
  tdlrRowsRead: number;
  topMarkets: Array<{ city: string; trade: string; prospects: number; signals: number; hot: number }>;
  sender: {
    configured: boolean;
    live: boolean;
    postalAddressConfigured: boolean;
    senderReadyAcknowledged: boolean;
    campaignId: number | null;
    campaignStatus: string | null;
    emailAccounts: number;
    leadsAddedThisRun: number;
    dailyCap: number;
    sent: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    error: string | null;
  };
  scheduler: { ok: boolean; lastScheduledAt: string | null; error: string | null };
  errors: string[];
};

function stateSecret() {
  return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || "";
}
function smartleadKey() { return process.env.SMARTLEAD_API_KEY?.trim() || ""; }
function outreachLive() { return /^true$/i.test(process.env.PERMITRAIL_OUTREACH_LIVE?.trim() || ""); }
function senderReady() { return /^true$/i.test(process.env.PERMITRAIL_OUTREACH_SENDER_READY?.trim() || ""); }
function postalAddress() { return process.env.PERMITRAIL_POSTAL_ADDRESS?.trim() || ""; }
function topic() {
  if (!stateSecret()) throw new Error("PermitRail acquisition state secret unavailable");
  return `pennyrail-${createHash("sha256").update(`permitrail-acquisition-v1:${stateSecret()}`).digest("hex").slice(0, 40)}`;
}
function safeEqual(a: string, b: string) {
  try { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); } catch { return false; }
}
function tokenForSlot(slot: number) { return createHmac("sha256", stateSecret()).update(`permitrail-acquisition-v1:${slot}`).digest("hex"); }
export function verifyPermitRailAcquisitionToken(slot: number, token: string) {
  if (!stateSecret() || !Number.isInteger(slot) || slot <= 0 || !token) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - slot) > 45 * 60) return false;
  return safeEqual(token, tokenForSlot(slot));
}

function blank(): PermitRailAcquisitionState {
  return {
    v: 1, startedAt: new Date().toISOString(), lastRunAt: null, nextRunAt: null,
    prospectCount: 0, tdlrRowsRead: 0, topMarkets: [],
    sender: { configured: false, live: false, postalAddressConfigured: false, senderReadyAcknowledged: false, campaignId: null, campaignStatus: null, emailAccounts: 0, leadsAddedThisRun: 0, dailyCap: 20, sent: 0, replied: 0, bounced: 0, unsubscribed: 0, error: null },
    scheduler: { ok: false, lastScheduledAt: null, error: null }, errors: [],
  };
}

export async function loadPermitRailAcquisitionState(): Promise<PermitRailAcquisitionState | null> {
  try {
    const r = await fetch(`${NTFY}/${encodeURIComponent(topic())}/json?poll=1&since=latest`, { headers: { accept: "application/x-ndjson,application/json" }, cache: "no-store", signal: AbortSignal.timeout(7_000) });
    if (!r.ok) return null;
    const rows = (await r.text()).split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(row => row?.event === "message" && typeof row?.message === "string");
    if (!rows.length) return null;
    const state = JSON.parse(rows[rows.length - 1].message);
    return state?.v === 1 ? state as PermitRailAcquisitionState : null;
  } catch { return null; }
}

async function saveState(state: PermitRailAcquisitionState) {
  state.topMarkets = state.topMarkets.slice(0, 12);
  state.errors = state.errors.slice(0, 4).map(x => x.slice(0, 220));
  const r = await fetch(`${NTFY}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: topic(), title: "PennyRail PermitRail acquisition", message: JSON.stringify(state), priority: 1 }), cache: "no-store", signal: AbortSignal.timeout(7_000) });
  if (!r.ok) throw new Error(`PermitRail acquisition state write HTTP ${r.status}`);
}

function apiUrl(base: string, path: string) {
  const join = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return `${join}${join.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(smartleadKey())}`;
}

async function smartlead(path: string, init: RequestInit = {}) {
  if (!smartleadKey()) throw new Error("SMARTLEAD_API_KEY is not configured");
  const r = await fetch(apiUrl(SMARTLEAD, path), {
    ...init,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) },
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  const raw = await r.text();
  let body: any = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!r.ok) throw new Error(`Smartlead ${path} HTTP ${r.status}: ${typeof body === "string" ? body.slice(0, 200) : body?.message || JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function smartprospect(path: string, body: any) {
  if (!smartleadKey()) throw new Error("SMARTLEAD_API_KEY is not configured");
  const r = await fetch(apiUrl(SMARTPROSPECT, path), { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(25_000) });
  const raw = await r.text();
  let parsed: any = null; try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
  if (!r.ok || parsed?.success === false) throw new Error(`SmartProspect ${path} HTTP ${r.status}: ${parsed?.message || (typeof parsed === "string" ? parsed.slice(0, 180) : JSON.stringify(parsed).slice(0, 180))}`);
  return parsed;
}

function arrayFrom(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.list)) return body.data.list;
  if (Array.isArray(body?.campaigns)) return body.campaigns;
  if (Array.isArray(body?.email_accounts)) return body.email_accounts;
  return [];
}

function campaignIdFrom(body: any): number | null {
  const n = Number(body?.campaign?.id ?? body?.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function listEmailAccounts() {
  const body = await smartlead("/email-accounts/?limit=50");
  return arrayFrom(body).filter(row => row && row.id != null && row.from_email);
}

async function findOrCreateCampaign() {
  const listed = await smartlead("/campaigns/?limit=100");
  const found = arrayFrom(listed).find(row => String(row?.name || "") === CAMPAIGN_NAME);
  if (found?.id) return Number(found.id);
  const created = await smartlead("/campaigns/create", { method: "POST", body: JSON.stringify({ name: CAMPAIGN_NAME, track_settings: { track_open: false, track_click: false } }) });
  const id = campaignIdFrom(created);
  if (!id) throw new Error("Smartlead campaign create returned no campaign id");
  return id;
}

function emailSequence() {
  const address = postalAddress();
  return {
    sequences: [
      {
        seq_number: 1,
        subject: "{{company_name}} — current {{permitrail_trade}} project signals",
        email_body: `Hi {{first_name}},\n\nPermitRail is monitoring public permit and project records across DFW. Right now we have {{signal_count}} current {{permitrail_trade}}-relevant project signals around {{permitrail_city}}, including {{hot_count}} high-priority signals.\n\nI pulled a live sample for your market: {{sample_url}}\n\nPermitRail is public-record project intelligence — not purchased homeowner contact data. Plans start at $299/month if the feed is useful for your team.\n\nCommercial message from PermitRail / PennyRail.\n${address}\n%unsubscribe-text%`,
        seq_delay_details: { delay_in_days: 0 },
      },
      {
        seq_number: 2,
        subject: "Re: {{company_name}} — current {{permitrail_trade}} project signals",
        email_body: `Hi {{first_name}},\n\nOne follow-up in case this is useful: the live {{permitrail_city}} / {{permitrail_trade}} sample is here: {{sample_url}}\n\nIf project-intelligence feeds aren't relevant, no problem — use the opt-out below and we won't email again.\n\nCommercial message from PermitRail / PennyRail.\n${address}\n%unsubscribe-text%`,
        seq_delay_details: { delay_in_days: 4 },
      },
    ],
  };
}

async function configureCampaign(campaignId: number, emailAccountId: number, dailyCap: number) {
  await smartlead(`/campaigns/${campaignId}/sequences`, { method: "POST", body: JSON.stringify(emailSequence()) });
  await smartlead(`/campaigns/${campaignId}/email-accounts`, { method: "POST", body: JSON.stringify({ email_account_ids: [emailAccountId] }) });
  await smartlead(`/campaigns/${campaignId}/schedule`, { method: "POST", body: JSON.stringify({ timezone: "America/Chicago", days_of_the_week: [1, 2, 3, 4, 5], start_hour: "09:15", end_hour: "16:15", min_time_btw_emails: 12, max_new_leads_per_day: dailyCap }) });
  await smartlead(`/campaigns/${campaignId}/settings`, { method: "PATCH", body: JSON.stringify({ track_settings: { track_open: false, track_click: false }, stop_lead_settings: { stop_on_reply: true, stop_on_auto_reply: false, stop_on_click: false } }) });
}

function normalizeCompany(value: string) { return value.toLowerCase().replace(/\b(llc|inc|corp|corporation|company|co|ltd|pllc|lp)\b\.?/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function titleRank(title: unknown) {
  const t = String(title || "").toLowerCase();
  if (/owner|founder|president|chief executive|\bceo\b/.test(t)) return 100;
  if (/general manager|managing director|operations|business development/.test(t)) return 85;
  if (/sales|director|manager/.test(t)) return 70;
  return 20;
}

async function acquireContacts(prospects: PermitRailProspect[], maxContacts: number) {
  const targetCompanies = prospects.slice(0, 150).map(p => p.businessName);
  if (!targetCompanies.length || maxContacts <= 0) return [] as any[];
  const search = await smartprospect("/search-contacts", { limit: 300, companyName: targetCompanies, state: ["Texas"], country: ["United States"], dontDisplayOwnedContact: true, companyExactMatch: false });
  const filterId = Number(search?.data?.filter_id ?? search?.filter_id);
  const preview = Array.isArray(search?.data?.list) ? search.data.list : [];
  if (!Number.isInteger(filterId) || filterId <= 0 || !preview.length) return [];

  const prospectByCompany = new Map(prospects.map(p => [normalizeCompany(p.businessName), p]));
  const chosen = new Map<string, any>();
  for (const row of preview) {
    const company = String(row?.company?.name || row?.companyName || "");
    const key = normalizeCompany(company);
    let prospect = prospectByCompany.get(key);
    if (!prospect) {
      prospect = prospects.find(p => {
        const pKey = normalizeCompany(p.businessName);
        return key.length >= 5 && (pKey.includes(key) || key.includes(pKey));
      });
    }
    if (!prospect) continue;
    const id = String(row?.id || row?.adapt_id || "");
    if (!id) continue;
    const current = chosen.get(prospect.id);
    if (!current || titleRank(row?.title) > titleRank(current.row?.title)) chosen.set(prospect.id, { row, prospect, id });
  }
  const selected = [...chosen.values()].sort((a, b) => b.prospect.score - a.prospect.score || titleRank(b.row?.title) - titleRank(a.row?.title)).slice(0, maxContacts);
  if (!selected.length) return [];
  const fetched = await smartprospect("/fetch-contacts", { filter_id: filterId, id: selected.map(s => s.id), visual_limit: Math.min(1000, selected.length), visual_offset: 0 });
  const details = Array.isArray(fetched?.data?.list) ? fetched.data.list : [];
  const selectedById = new Map(selected.map(s => [String(s.id), s]));
  return details.map((row: any) => {
    const selectedRow = selectedById.get(String(row?.id || row?.adapt_id || ""));
    if (!selectedRow || !row?.email) return null;
    const verification = String(row?.verification_status || row?.verificationStatus || "").toLowerCase();
    if (verification && !/valid|verified/.test(verification)) return null;
    const p: PermitRailProspect = selectedRow.prospect;
    return {
      first_name: String(row?.firstName || row?.first_name || p.ownerName?.split(/\s+/)[0] || "there"),
      last_name: String(row?.lastName || row?.last_name || ""),
      email: String(row.email),
      company_name: p.businessName,
      location: `${p.targetCity}, TX`,
      custom_fields: {
        permitrail_city: p.targetCity === "fortworth" ? "Fort Worth" : p.targetCity.charAt(0).toUpperCase() + p.targetCity.slice(1),
        permitrail_trade: p.trade.replace(/-/g, " "),
        signal_count: String(p.signalCount), hot_count: String(p.hotCount), sample_url: p.sampleUrl,
      },
    };
  }).filter(Boolean);
}

async function addLeads(campaignId: number, leads: any[]) {
  if (!leads.length) return 0;
  await smartlead(`/campaigns/${campaignId}/leads`, { method: "POST", body: JSON.stringify({ lead_list: leads, settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false, ignore_duplicate_leads_in_other_campaign: false } }) });
  return leads.length;
}

async function activateCampaign(campaignId: number) {
  try {
    await smartlead(`/campaigns/${campaignId}/status`, { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) });
  } catch (first) {
    await smartlead(`/campaigns/${campaignId}/status`, { method: "POST", body: JSON.stringify({ status: "ACTIVE" }) });
  }
}

function metric(body: any, ...keys: string[]) {
  for (const key of keys) {
    const value = body?.[key] ?? body?.data?.[key] ?? body?.analytics?.[key];
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function campaignAnalytics(campaignId: number) {
  try { return await smartlead(`/campaigns/${campaignId}/analytics`); } catch { return null; }
}

async function campaignInfo(campaignId: number) {
  try { return await smartlead(`/campaigns/${campaignId}`); } catch { return null; }
}

async function scheduleNext(publicOrigin: string, slot: number) {
  const callback = `${publicOrigin.replace(/\/$/, "")}/api/permitrail/acquisition/run?slot=${slot}&token=${encodeURIComponent(tokenForSlot(slot))}`;
  const delay = Math.max(60, slot - Math.floor(Date.now() / 1000));
  const r = await fetch(SCHEDULER, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ url: callback, delay_seconds: delay, payload: {} }), cache: "no-store", signal: AbortSignal.timeout(8_000) });
  const raw = await r.text();
  if (!r.ok) throw new Error(`PermitRail acquisition scheduler HTTP ${r.status}: ${raw.slice(0, 180)}`);
  return { ok: true, slot };
}

export async function runPermitRailAcquisition(publicOrigin: string) {
  const state = (await loadPermitRailAcquisitionState()) || blank();
  state.sender.configured = Boolean(smartleadKey());
  state.sender.live = outreachLive();
  state.sender.postalAddressConfigured = Boolean(postalAddress());
  state.sender.senderReadyAcknowledged = senderReady();
  state.sender.leadsAddedThisRun = 0;
  state.sender.error = null;

  try {
    const scan = await scanPermitRailProspects(publicOrigin, 2000);
    state.lastRunAt = scan.checkedAt;
    state.prospectCount = scan.prospectCount;
    state.tdlrRowsRead = scan.sourceRows;
    state.topMarkets = scan.markets.slice(0, 12);
    if (scan.errors.length) state.errors = [...scan.errors, ...state.errors].slice(0, 4);

    if (smartleadKey()) {
      const accounts = await listEmailAccounts();
      state.sender.emailAccounts = accounts.length;
      const revenue = await permitRailStripeRevenue24h().catch(() => null);
      const dailyCap = revenue && revenue.grossUsd > 0 ? 40 : 20;
      state.sender.dailyCap = dailyCap;

      const existingCampaigns = await smartlead("/campaigns/?limit=100");
      const existing = arrayFrom(existingCampaigns).find(row => String(row?.name || "") === CAMPAIGN_NAME);
      if (existing?.id) state.sender.campaignId = Number(existing.id);

      if (outreachLive()) {
        if (!postalAddress()) throw new Error("PERMITRAIL_POSTAL_ADDRESS is required before commercial outreach can send");
        if (!senderReady()) throw new Error("PERMITRAIL_OUTREACH_SENDER_READY=true is required after a warmed/healthy sender mailbox is confirmed");
        if (!accounts.length) throw new Error("Smartlead has no sending email account connected");
        const campaignId = state.sender.campaignId || await findOrCreateCampaign();
        state.sender.campaignId = campaignId;
        await configureCampaign(campaignId, Number(accounts[0].id), dailyCap);
        const contacts = await acquireContacts(scan.prospects, dailyCap);
        state.sender.leadsAddedThisRun = await addLeads(campaignId, contacts);
        await activateCampaign(campaignId);
      }

      if (state.sender.campaignId) {
        const [info, analytics] = await Promise.all([campaignInfo(state.sender.campaignId), campaignAnalytics(state.sender.campaignId)]);
        state.sender.campaignStatus = String(info?.status || info?.campaign?.status || existing?.status || "").toUpperCase() || null;
        state.sender.sent = metric(analytics, "total_sent", "sent_count", "sent");
        state.sender.replied = metric(analytics, "total_replied", "reply_count", "replied");
        state.sender.bounced = metric(analytics, "total_bounced", "bounce_count", "bounced");
        state.sender.unsubscribed = metric(analytics, "unsubscribed_count", "total_unsubscribed", "unsubscribed");
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.sender.error = message;
    state.errors = [`${new Date().toISOString()} ${message}`, ...state.errors].slice(0, 4);
  }

  const nextSlot = Math.floor(Date.now() / 1000) + RUN_EVERY_SECONDS;
  state.nextRunAt = new Date(nextSlot * 1000).toISOString();
  try { await scheduleNext(publicOrigin, nextSlot); state.scheduler = { ok: true, lastScheduledAt: new Date().toISOString(), error: null }; }
  catch (error) { state.scheduler = { ok: false, lastScheduledAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }; }
  try { await saveState(state); } catch (error) { state.errors = [`${new Date().toISOString()} ${error instanceof Error ? error.message : String(error)}`, ...state.errors].slice(0, 4); }
  return { ok: true, mode: "PERMITRAIL_ACQUISITION_ENGINE_V70", state };
}

export async function ensurePermitRailAcquisitionScheduled(publicOrigin: string) {
  const state = await loadPermitRailAcquisitionState();
  if (state?.scheduler?.ok && state.nextRunAt && Date.parse(state.nextRunAt) > Date.now() - 30 * 60_000) return { ok: true, action: "ALREADY_RUNNING", state };
  const slot = Math.floor(Date.now() / 1000) + 75;
  await scheduleNext(publicOrigin, slot);
  return { ok: true, action: "SCHEDULED", slot, state };
}

export async function permitRailAcquisitionPublicStatus() {
  const state = await loadPermitRailAcquisitionState();
  if (!state) return { ok: true, running: false, mode: "PERMITRAIL_ACQUISITION_ENGINE_V70" };
  return {
    ok: true, running: Boolean(state.scheduler.ok), mode: "PERMITRAIL_ACQUISITION_ENGINE_V70",
    lastRunAt: state.lastRunAt, nextRunAt: state.nextRunAt, prospectCount: state.prospectCount, tdlrRowsRead: state.tdlrRowsRead,
    topMarkets: state.topMarkets,
    sender: { configured: state.sender.configured, live: state.sender.live, postalAddressConfigured: state.sender.postalAddressConfigured, senderReadyAcknowledged: state.sender.senderReadyAcknowledged, campaignStatus: state.sender.campaignStatus, emailAccounts: state.sender.emailAccounts, leadsAddedThisRun: state.sender.leadsAddedThisRun, dailyCap: state.sender.dailyCap, sent: state.sender.sent, replied: state.sender.replied, bounced: state.sender.bounced, unsubscribed: state.sender.unsubscribed, error: state.sender.error },
    errors: state.errors.slice(0, 3),
  };
}
