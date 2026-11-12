#!/usr/bin/env node
/**
 * ============================================================================
 * STARKOV MODEL CONTEXT PROTOCOL (MCP) STDIO SERVER & BRIDGE (v1.2.0)
 * ============================================================================
 * Connects Claude Code, Antigravity, Codex, Cursor, Windsurf, or Claude Desktop
 * to Starkov's Live Market Radar, NOFX Frontier Trade Planner, 4-Pillar Bot
 * Studio (`evaluator.py`), and Non-Custodial Live Relay Deployer (`starkov-relay.mjs`).
 *
 * Dual-Mode Execution:
 * 1. Standalone Public Repo Mode (External Users):
 *    Forwards JSON-RPC 2.0 calls over HTTPS to `https://starkov-app.vercel.app/api/mcp`
 *    authenticated with your personal `STARKOV_MCP_TOKEN` (`stk_mcp_...`).
 * 2. Local Monorepo Mode (Starkov Developers):
 *    Loads `web-dashboard/src/lib/mcp/starkov-mcp-server.ts` directly in-process.
 *
 * AI Assistant Behavior Guidelines (STK-227 & STK-207):
 * - Interactive Bot Discovery: When the user asks to create or configure a bot,
 *   the AI checks their subscription tier (`starkov_list_bots`) and asks 2-4
 *   clarifying questions across `01 TARGET`, `02 TRIGGER`, `03 ORDER`, and `04 EXIT`.
 * - End-of-Workflow Deployment: Once a bot is configured, the AI explains:
 *   (1) Instant Live Dry-Run (`starkov_evaluate_bot_on_live_markets`),
 *   (2) 24/7 Cloud Paper-Trading Sandbox (`/bots` & `/wallet`), and
 *   (3) Non-Custodial Live Exchange Deploy to Kalshi/Polymarket (`starkov_prepare_live_deployment`
 *       or `starkov-relay.mjs` via 1-Click Railway / Docker CLI).
 * ============================================================================
 */

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const moduleBuiltin = require("node:module");

const repoRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repoRoot, "web-dashboard");
const srcRoot = path.join(webRoot, "src");
const nmRoot = path.join(webRoot, "node_modules");
const localServerTsPath = path.join(srcRoot, "lib", "mcp", "starkov-mcp-server.ts");

// 1. Load environment variables from `.env` and `web-dashboard/.env.local` if present
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(webRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_KEY;
}

// Redirect console.log to stderr so stdout remains 100% pure JSON-RPC 2.0
console.log = (...args) => {
  process.stderr.write(args.map(String).join(" ") + "\n");
};

let handleStarkovJsonRpcMessage = null;

if (fs.existsSync(localServerTsPath) && fs.existsSync(path.join(nmRoot, "typescript"))) {
  // Local Monorepo Mode: on-the-fly TypeScript compiler hook
  const ts = require(path.join(nmRoot, "typescript"));
  const origResolveFilename = moduleBuiltin._resolveFilename;
  moduleBuiltin._resolveFilename = function (request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      const base = path.join(srcRoot, request.slice(2));
      for (const ext of [".ts", ".tsx", "/index.ts", ".js", ""]) {
        if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
          return base + ext;
        }
      }
    }
    if (request.startsWith("./") || request.startsWith("../")) {
      const dir =
        parent && parent.filename ? path.dirname(parent.filename) : process.cwd();
      const base = path.resolve(dir, request);
      for (const ext of ["", ".ts", ".tsx", "/index.ts", ".js"]) {
        if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
          return base + ext;
        }
      }
    }
    try {
      return origResolveFilename.call(this, request, parent, isMain, options);
    } catch {
      return origResolveFilename.call(
        this,
        request,
        { ...parent, paths: [nmRoot] },
        isMain,
        options
      );
    }
  };

  require.extensions[".ts"] = function (mod, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    mod._compile(outputText, filename);
  };

  ({ handleStarkovJsonRpcMessage } = require(localServerTsPath));
} else {
  // Standalone Public Repo Mode: proxy stdio JSON-RPC to remote HTTPS endpoint
  const remoteEndpoint = (
    process.env.STARKOV_MCP_URL || "https://starkov-app.vercel.app/api/mcp"
  ).trim();
  handleStarkovJsonRpcMessage = async (msg) => {
    const token = (process.env.STARKOV_MCP_TOKEN || "").trim();
    if (!token || !token.startsWith("stk_mcp_")) {
      if (msg?.id === undefined || msg?.id === null) return null;
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32001,
          message:
            "Unauthorized: set STARKOV_MCP_TOKEN=stk_mcp_... in your MCP environment. Generate your personal key at https://starkov-app.vercel.app/doc?section=mcp-copilot",
        },
      };
    }
    const res = await fetch(remoteEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(msg),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 202 || res.status === 204) return null;
    const text = await res.text();
    return text.trim() ? JSON.parse(text) : null;
  };
}

function sendRpcResponse(payload) {
  if (payload === null || payload === undefined) return;
  process.stdout.write(JSON.stringify(payload) + "\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const results = await Promise.all(
        parsed.map((msg) => handleStarkovJsonRpcMessage(msg, null))
      );
      const valid = results.filter((r) => r !== null);
      if (valid.length > 0) sendRpcResponse(valid);
    } else {
      const response = await handleStarkovJsonRpcMessage(parsed, null);
      if (response !== null) sendRpcResponse(response);
    }
  } catch (err) {
    sendRpcResponse({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: err?.message || "Invalid JSON",
      },
    });
  }
});
