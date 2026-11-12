#!/usr/bin/env node
/**
 * ============================================================================
 * STARKOV NON-CUSTODIAL EXECUTION RELAY (v1.2.0)
 * ============================================================================
 * Architecture: Smart Cloud Signal Publisher (Starkov) -> Self-Hosted Signer (You)
 *
 * Security & US Regulatory Compliance Guarantee:
 * - Your Kalshi RSA Private Key and Polymarket L2 credentials NEVER leave your
 *   own server/environment. Starkov never sees, touches, or stores your keys.
 * - This lightweight node polls your authenticated Starkov 4-Pillar Bot signal
 *   queue and signs/dispatches orders directly from your own IP address.
 * - Requires Node.js 18+ (zero external npm dependencies required).
 *
 * How to Get Your `STARKOV_BOT_TOKEN` (`stk_live_...`):
 * 1. In your AI assistant (Claude Code, Antigravity, Cursor, Codex), call:
 *    `starkov_prepare_live_deployment` for your bot, OR
 * 2. Open `https://starkov-app.vercel.app/bots` and click the **Deploy** button.
 * ============================================================================
 */

import crypto from "node:crypto";
import http from "node:http";

const STARKOV_BOT_TOKEN = (process.env.STARKOV_BOT_TOKEN || "").trim();
const STARKOV_RELAY_URL = (
  process.env.STARKOV_RELAY_URL || "https://starkov-app.vercel.app/api/bots/relay"
).trim();
const EXCHANGE_TARGET = (process.env.EXCHANGE_TARGET || "kalshi").toLowerCase(); // "kalshi" | "polymarket" | "both"
const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
const POLL_INTERVAL_MS = Math.max(1500, Number(process.env.POLL_INTERVAL_MS || 2500));
const PORT = Number(process.env.PORT || 8080);

// --- Kalshi Official v2 API Credentials (User Self-Custody) ---
const KALSHI_API_KEY_ID = (process.env.KALSHI_API_KEY_ID || "").trim();
const KALSHI_PRIVATE_KEY_PEM = (process.env.KALSHI_PRIVATE_KEY || "")
  .replace(/\\n/g, "\n")
  .trim();
const KALSHI_BASE_URL = (
  process.env.KALSHI_BASE_URL || "https://api.elections.kalshi.com"
)
  .trim()
  .replace(/\/+$/, "");

// --- Polymarket Official CLOB L2 Credentials (User Self-Custody) ---
const POLY_API_KEY = (process.env.POLY_API_KEY || "").trim();
const POLY_SECRET = (process.env.POLY_SECRET || "").trim();
const POLY_PASSPHRASE = (process.env.POLY_PASSPHRASE || "").trim();
const POLY_ADDRESS = (process.env.POLY_ADDRESS || "").trim();
const POLY_CLOB_URL = (
  process.env.POLY_CLOB_URL || "https://clob.polymarket.com"
).trim();

if (!STARKOV_BOT_TOKEN || !STARKOV_BOT_TOKEN.startsWith("stk_live_")) {
  console.error(
    "[STARKOV RELAY] FATAL: Missing or invalid STARKOV_BOT_TOKEN environment variable (expected `stk_live_...`)."
  );
  console.error(
    "[STARKOV RELAY] Tip: Call `starkov_prepare_live_deployment` in your MCP client or click 'Deploy' on https://starkov-app.vercel.app/bots"
  );
  process.exit(1);
}

// Healthcheck HTTP server for Railway / Render / Fly.io zero-downtime probes
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "online",
        service: "starkov-non-custodial-relay",
        version: "1.2.0",
        exchangeTarget: EXCHANGE_TARGET,
        dryRun: DRY_RUN,
        uptimeSeconds: Math.floor(process.uptime()),
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[STARKOV RELAY] Healthcheck listening on port ${PORT} | Target: ${EXCHANGE_TARGET.toUpperCase()} | Dry-Run: ${DRY_RUN}`
  );
});

/**
 * Signs a Kalshi REST v2 request using RSA-PSS (SHA-256) per official Kalshi API spec.
 */
function signKalshiRequest(timestampMs, method, path) {
  const payload = `${timestampMs}${method.toUpperCase()}${path}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(payload);
  sign.end();
  return sign.sign(
    {
      key: KALSHI_PRIVATE_KEY_PEM,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    "base64"
  );
}

/**
 * Executes a signed binary contract order on Kalshi v2 Portfolio API.
 */
async function executeKalshiOrder(signal) {
  if (DRY_RUN) {
    return {
      ok: true,
      venue: "kalshi",
      orderId: `dryrun_kalshi_${Date.now()}`,
      note: "Simulated by local relay (DRY_RUN=true)",
    };
  }
  if (!KALSHI_API_KEY_ID || !KALSHI_PRIVATE_KEY_PEM) {
    throw new Error(
      "Missing KALSHI_API_KEY_ID or KALSHI_PRIVATE_KEY in relay environment."
    );
  }

  const path = "/trade-api/v2/portfolio/orders";
  const ts = String(Date.now());
  const signature = signKalshiRequest(ts, "POST", path);

  const sideLower =
    String(signal.side || "YES").toLowerCase() === "no" ? "no" : "yes";
  const priceCents = Math.max(
    1,
    Math.min(99, Math.round(Number(signal.price_dollars || 0.5) * 100))
  );
  const count = Math.max(1, Math.floor(Number(signal.contracts || 1)));

  const intentTag = String(signal.intent || "entry")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const cleanSigId = String(signal.signal_id || "sig")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
  const deterministicClientOrderId = `stk_${intentTag}_${cleanSigId}`;

  const orderBody = {
    action: signal.intent === "EXIT" ? "sell" : "buy",
    client_order_id: deterministicClientOrderId,
    count,
    side: sideLower,
    ticker: signal.ticker || signal.market_id,
    type: signal.order_type === "taker" ? "market" : "limit",
    ...(signal.order_type !== "taker"
      ? sideLower === "yes"
        ? { yes_price: priceCents }
        : { no_price: priceCents }
      : {}),
  };

  const res = await fetch(`${KALSHI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID,
      "KALSHI-ACCESS-TIMESTAMP": ts,
      "KALSHI-ACCESS-SIGNATURE": signature,
    },
    body: JSON.stringify(orderBody),
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Kalshi API HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  return {
    ok: true,
    venue: "kalshi",
    orderId: data?.order?.order_id || orderBody.client_order_id,
    raw: data,
  };
}

/**
 * Signs a Polymarket CLOB L2 request using HMAC-SHA256.
 */
function signPolymarketL2(timestampSec, method, requestPath, bodyStr) {
  const message = `${timestampSec}${method.toUpperCase()}${requestPath}${bodyStr || ""}`;
  const keyBuf = Buffer.from(POLY_SECRET, "base64");
  return crypto.createHmac("sha256", keyBuf).update(message).digest("base64url");
}

/**
 * Dispatches a signed order to Polymarket CLOB API.
 */
async function executePolymarketOrder(signal) {
  if (DRY_RUN) {
    return {
      ok: true,
      venue: "polymarket",
      orderId: `dryrun_poly_${Date.now()}`,
      note: "Simulated by local relay (DRY_RUN=true)",
    };
  }
  if (!POLY_API_KEY || !POLY_SECRET || !POLY_PASSPHRASE || !POLY_ADDRESS) {
    throw new Error(
      "Missing POLY_API_KEY, POLY_SECRET, POLY_PASSPHRASE, or POLY_ADDRESS in relay environment."
    );
  }

  const requestPath = "/order";
  const ts = String(Math.floor(Date.now() / 1000));
  const intentTag = String(signal.intent || "entry")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const cleanSigId = String(signal.signal_id || "sig")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
  const payloadStr = JSON.stringify({
    market: signal.market_id,
    side: signal.intent === "EXIT" ? "SELL" : "BUY",
    outcome: signal.side || "YES",
    price: String(signal.price_dollars || 0.5),
    size: String(signal.contracts || 1),
    clientOrderId: `stk_${intentTag}_${cleanSigId}`,
  });

  const hmacSig = signPolymarketL2(ts, "POST", requestPath, payloadStr);

  const res = await fetch(`${POLY_CLOB_URL}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "POLY-ADDRESS": POLY_ADDRESS,
      "POLY-API-KEY": POLY_API_KEY,
      "POLY-PASSPHRASE": POLY_PASSPHRASE,
      "POLY-TIMESTAMP": ts,
      "POLY-SIGNATURE": hmacSig,
    },
    body: payloadStr,
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Polymarket CLOB HTTP ${res.status}: ${JSON.stringify(data)}`
    );
  }

  return {
    ok: true,
    venue: "polymarket",
    orderId: data?.orderID || data?.id || `poly_${Date.now()}`,
    raw: data,
  };
}

async function reportReceipt(signalId, status, details) {
  try {
    await fetch(STARKOV_RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STARKOV_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        action: "ack_signal",
        signal_id: signalId,
        status,
        details,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.warn("[STARKOV RELAY] Failed to post receipt:", err.message);
  }
}

let isPolling = false;
const MAX_PROCESSED_SIGNALS = 2000;
const processedSignalKeys = new Set();

function rememberProcessedSignal(key) {
  if (processedSignalKeys.size >= MAX_PROCESSED_SIGNALS) {
    const oldest = processedSignalKeys.values().next().value;
    if (oldest !== undefined) processedSignalKeys.delete(oldest);
  }
  processedSignalKeys.add(key);
}

async function pollLoop() {
  if (isPolling) return;
  isPolling = true;
  const startTs = Date.now();
  try {
    const res = await fetch(
      `${STARKOV_RELAY_URL}?exchange=${encodeURIComponent(EXCHANGE_TARGET)}&dry_run=${DRY_RUN}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${STARKOV_BOT_TOKEN}`,
          "X-Relay-Version": "1.2.0",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[STARKOV RELAY] Poll warning (HTTP ${res.status}): ${errText.slice(0, 120)}`
      );
      return;
    }

    const payload = await res.json();
    const signals = Array.isArray(payload.signals) ? payload.signals : [];

    for (const sig of signals) {
      const dedupKey = `${sig.signal_id}:${sig.intent || "ENTRY"}`;
      if (processedSignalKeys.has(dedupKey)) continue;
      rememberProcessedSignal(dedupKey);

      if (sig.intent === "PING_TEST") {
        console.log(
          `[STARKOV RELAY] Received PING_TEST for bot "${payload.botName}" -> Sending PONG receipt.`
        );
        await reportReceipt(sig.signal_id, "PONG", {
          venue: EXCHANGE_TARGET,
          dryRun: DRY_RUN,
          latencyMs: Date.now() - startTs,
          message: `Relay node online (${EXCHANGE_TARGET.toUpperCase()}${DRY_RUN ? " · DRY RUN" : ""})`,
        });
        continue;
      }

      console.log(
        `[STARKOV RELAY] Executing signal ${sig.signal_id}: ${sig.intent} ${sig.side} on ${sig.match_name} @ $${sig.price_dollars} (${sig.contracts} contracts)`
      );
      try {
        let execResult;
        if (EXCHANGE_TARGET === "polymarket") {
          execResult = await executePolymarketOrder(sig);
        } else {
          execResult = await executeKalshiOrder(sig);
        }
        console.log(
          `[STARKOV RELAY] Order dispatched! ID: ${execResult.orderId}`
        );
        await reportReceipt(sig.signal_id, "FILLED", execResult);
      } catch (orderErr) {
        console.error(
          `[STARKOV RELAY] Order execution failed:`,
          orderErr.message
        );
        await reportReceipt(sig.signal_id, "ERROR", {
          error: orderErr.message,
        });
      }
    }
  } catch (err) {
    console.warn("[STARKOV RELAY] Network poll error:", err.message);
  } finally {
    isPolling = false;
  }
}

console.log("[STARKOV RELAY] Starting non-custodial signal listener loop...");
pollLoop();
setInterval(pollLoop, POLL_INTERVAL_MS);
