export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "Restaurant Inventory for Wix",
    version: "0.1.0",
    appId: process.env.WIX_APP_ID || null
  });
}
