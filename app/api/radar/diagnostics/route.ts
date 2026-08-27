import { createPrivateKey } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { BUYER_ACCOUNT_NAME, getCdpClient } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function value(name: string) {
  return process.env[name]?.trim() || "";
}

function redact(message: string) {
  let result = message;
  for (const name of ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"]) {
    const secret = process.env[name];
    if (secret) result = result.split(secret).join("[redacted]");
    const trimmed = secret?.trim();
    if (trimmed) result = result.split(trimmed).join("[redacted]");
  }
  return result.slice(0, 500);
}

function errorMessage(error: unknown) {
  return redact(error instanceof Error ? error.message : String(error));
}

function strictBase64Bytes(input: string) {
  if (!input || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) {
    return null;
  }
  try {
    const bytes = Buffer.from(input, "base64");
    const normalizedInput = input.replace(/=+$/, "");
    const normalizedOutput = bytes.toString("base64").replace(/=+$/, "");
    return normalizedInput === normalizedOutput ? bytes : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKeyId = value("CDP_API_KEY_ID");
  const apiKeySecret = value("CDP_API_KEY_SECRET");
  const walletSecret = value("CDP_WALLET_SECRET");

  const apiSecretBytes = strictBase64Bytes(apiKeySecret);
  const apiKeyFormat = {
    ok: Boolean(apiKeyId && apiSecretBytes?.length === 64),
    idPresent: Boolean(apiKeyId),
    secretPresent: Boolean(apiKeySecret),
    secretDecodedBytes: apiSecretBytes?.length ?? null,
    expectedForEd25519: 64,
  };

  let walletFormat: Record<string, unknown> = {
    ok: false,
    present: Boolean(walletSecret),
    decodedBytes: null,
    keyType: null,
    namedCurve: null,
  };

  const walletBytes = strictBase64Bytes(walletSecret);
  if (walletBytes) {
    try {
      const key = createPrivateKey({ key: walletBytes, format: "der", type: "pkcs8" });
      walletFormat = {
        ok: key.asymmetricKeyType === "ec",
        present: true,
        decodedBytes: walletBytes.length,
        keyType: key.asymmetricKeyType,
        namedCurve: key.asymmetricKeyDetails?.namedCurve ?? null,
      };
    } catch (error) {
      walletFormat = {
        ok: false,
        present: true,
        decodedBytes: walletBytes.length,
        keyType: null,
        namedCurve: null,
        error: errorMessage(error),
      };
    }
  }

  const cdp = getCdpClient();

  let apiAuth: Record<string, unknown> = { ok: false };
  try {
    const page = await cdp.evm.listAccounts();
    apiAuth = {
      ok: true,
      note: "Authenticated GET to Coinbase succeeded.",
      accountsVisible: Array.isArray(page.accounts) ? page.accounts.length : null,
    };
  } catch (error) {
    apiAuth = { ok: false, error: errorMessage(error) };
  }

  let walletAuth: Record<string, unknown> = {
    ok: false,
    skipped: !apiAuth.ok,
    stage: !apiAuth.ok ? "skipped because API auth failed" : "not run",
  };

  if (apiAuth.ok) {
    try {
      const account = await cdp.evm.getOrCreateAccount({ name: BUYER_ACCOUNT_NAME });
      try {
        await account.signMessage({ message: "PennyRail wallet-auth diagnostic" });
        walletAuth = {
          ok: true,
          skipped: false,
          stage: "managed account lookup/create + signing",
          evmAddress: account.address,
          note: "Coinbase accepted Wallet Secret authentication and managed signing.",
        };
      } catch (error) {
        walletAuth = {
          ok: false,
          skipped: false,
          stage: "managed signing",
          evmAddress: account.address,
          error: errorMessage(error),
        };
      }
    } catch (error) {
      walletAuth = {
        ok: false,
        skipped: false,
        stage: "managed account lookup/create",
        error: errorMessage(error),
      };
    }
  }

  const diagnosis = !apiKeyFormat.ok
    ? "CDP API Key Secret does not look like a valid Ed25519 key."
    : !walletFormat.ok
      ? "CDP Wallet Secret is not a valid PKCS#8 EC key locally."
      : !apiAuth.ok
        ? "Local credential formats look valid, but Coinbase rejected API-key authentication."
        : !walletAuth.ok
          ? "API auth and local Wallet Secret format are valid; Coinbase is rejecting the wallet-auth operation."
          : "All Coinbase authentication stages passed.";

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    apiKeyFormat,
    walletSecretFormat: walletFormat,
    apiAuth,
    walletAuth,
    diagnosis,
    secretsReturned: false,
  });
}
