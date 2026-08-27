/** @type {import("next").NextConfig} */
const nextConfig = {
  // Coinbase CDP ships both EVM and Solana helpers. PennyRail only uses EVM.
  // Keep the SDK out of Turbopack's server bundle so optional Solana x402
  // imports are resolved only if that code path is actually executed.
  serverExternalPackages: ["@coinbase/cdp-sdk"],
};

export default nextConfig;
