#!/usr/bin/env node
/**
 * ============================================================================
 * STARKOV REMOTE MCP STDIO-TO-HTTPS BRIDGE (v1.2.0)
 * ============================================================================
 * Zero-dependency Node.js 18+ bridge that connects any stdio-based MCP client
 * (Claude Desktop, Cursor, Windsurf, Zed, Antigravity, or Codex) to Starkov's
 * Streamable HTTP JSON-RPC 2.0 MCP Server (`https://starkov-app.vercel.app/api/mcp`).
 *
 * Security Guarantee:
 * - Authenticates strictly with your personal `STARKOV_MCP_TOKEN` (`stk_mcp_...`).
 * - Zero database credentials or exchange private keys are required here.
 *
 * Usage in `claude_desktop_config.json` / `mcp_config.json`:
 * {
 *   "mcpServers": {
 *     "starkov": {
 *       "command": "node",
 *       "args": ["/path/to/starkov-mcp/bin/starkov-mcp-bridge.mjs"],
 *       "env": {
 *         "STARKOV_MCP_TOKEN": "stk_mcp_your_personal_token_here"
 *       }
 *     }
 *   }
 * }
 * ============================================================================
 */

import readline from "node:readline";

const MCP_ENDPOINT = (
  process.env.STARKOV_MCP_URL || "https://starkov-app.vercel.app/api/mcp"
).trim();
const MCP_TOKEN = (process.env.STARKOV_MCP_TOKEN || "").trim();

function sendRpcResponse(payload) {
  if (payload === null || payload === undefined) return;
  process.stdout.write(JSON.stringify(payload) + "\n");
}

async function forwardJsonRpcToRemote(rpcPayload) {
  if (!MCP_TOKEN || !MCP_TOKEN.startsWith("stk_mcp_")) {
    const id = Array.isArray(rpcPayload) ? null : (rpcPayload?.id ?? null);
    if (id === undefined || id === null) return null;
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32001,
        message:
          "Missing or invalid STARKOV_MCP_TOKEN environment variable. Generate your personal `stk_mcp_...` key at https://starkov-app.vercel.app/doc?section=mcp-copilot",
      },
    };
  }

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${MCP_TOKEN}`,
    },
    body: JSON.stringify(rpcPayload),
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 202 || res.status === 204) {
    return null;
  }

  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    sendRpcResponse({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: err?.message || "Invalid JSON" },
    });
    return;
  }

  try {
    const response = await forwardJsonRpcToRemote(parsed);
    if (response !== null) {
      sendRpcResponse(response);
    }
  } catch (err) {
    const id = Array.isArray(parsed) ? null : (parsed?.id ?? null);
    if (id !== undefined && id !== null) {
      sendRpcResponse({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: `Starkov MCP Bridge network error: ${err?.message || "Failed to reach MCP endpoint"}`,
        },
      });
    }
  }
});
