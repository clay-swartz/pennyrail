/** @type {import("next").NextConfig} */
const nextConfig = {
  // Coinbase CDP ships both EVM and Solana helpers. PennyRail only uses EVM.
  // Keep the SDK out of Turbopack's server bundle so optional Solana x402
  // imports are resolved only if that code path is actually executed.
  serverExternalPackages: ["@coinbase/cdp-sdk"],

  // Keep discovery routes in ordinary visible folders in the repository.
  // This avoids browser/GitHub upload workflows dropping hidden `.well-known`
  // directories while preserving the public x402-standard URLs.
  async rewrites() {
    return [
      { source: "/.well-known/x402", destination: "/api/x402-manifest" },
      { source: "/.well-known/x402-service.json", destination: "/api/true402-manifest" },
      { source: "/openapi.json", destination: "/api/openapi" },
    ];
  },
};

export default nextConfig;
