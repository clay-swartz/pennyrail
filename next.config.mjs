/** @type {import("next").NextConfig} */
const nextConfig = {
  // Coinbase CDP ships both EVM and Solana helpers. PennyRail only uses EVM.
  // Keep the SDK out of Turbopack's server bundle so optional Solana x402
  // imports are resolved only if that code path is actually executed.
  serverExternalPackages: ["@coinbase/cdp-sdk"],

  async rewrites() {
    return [
      // v54 wraps the existing manifest with explicit price-bearing `tools`
      // so external agent routers can rank PennyRail immediately.
      { source: "/.well-known/x402", destination: "/api/x402-index-manifest" },
      { source: "/.well-known/x402-service.json", destination: "/api/true402-manifest" },
      { source: "/openapi.json", destination: "/api/openapi" },
    ];
  },
};

export default nextConfig;
