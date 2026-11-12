# Starkov MCP Protocol & Non-Custodial Live Relay (`starkov-mcp` v1.2.0)

Official open-source **Model Context Protocol (MCP)** integration and **Non-Custodial Live Execution Relay (`starkov-relay.mjs`)** for **Starkov** — the quantitative sports prediction market platform for **Kalshi** and **Polymarket**.

- **Starkov Web Platform & Bot Studio**: [https://starkov-app.vercel.app/bots](https://starkov-app.vercel.app/bots)
- **Personal MCP Key & Prompt Book**: [https://starkov-app.vercel.app/doc?section=mcp-copilot](https://starkov-app.vercel.app/doc?section=mcp-copilot)
- **Remote Streamable HTTP MCP Endpoint**: `https://starkov-app.vercel.app/api/mcp`

---

## 1. Quick Setup (Connect Your AI Assistant in 30 Seconds)

First, sign in to [starkov-app.vercel.app/doc?section=mcp-copilot](https://starkov-app.vercel.app/doc?section=mcp-copilot) and copy your personal MCP token (`stk_mcp_...`).

### Claude Code (CLI)
```bash
claude mcp add --transport http starkov "https://starkov-app.vercel.app/api/mcp" --header "Authorization: Bearer stk_mcp_your_personal_token_here"
```

### Antigravity (CLI)
```bash
agy mcp add starkov "https://starkov-app.vercel.app/api/mcp" --header "Authorization: Bearer stk_mcp_your_personal_token_here"
```

### Codex (CLI)
```bash
codex mcp add starkov --url "https://starkov-app.vercel.app/api/mcp"
```

### Cursor / Windsurf / JSON Config (`mcp.json`)
```json
{
  "mcpServers": {
    "starkov": {
      "url": "https://starkov-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer stk_mcp_your_personal_token_here"
      }
    }
  }
}
```

### Claude Desktop (Stdio Bridge via `bin/starkov-mcp-bridge.mjs`)
If your MCP client only supports local `stdio` servers:
```json
{
  "mcpServers": {
    "starkov": {
      "command": "node",
      "args": ["/absolute/path/to/starkov-mcp/bin/starkov-mcp-bridge.mjs"],
      "env": {
        "STARKOV_MCP_TOKEN": "stk_mcp_your_personal_token_here"
      }
    }
  }
}
```

---

## 2. How the AI Assistant Guides You (From Idea to Live Deployment)

When connected to `starkov-prediction-mcp`, your AI assistant follows a structured **3-Stage Quantitative Workflow**:

### Step A — Interactive 4-Pillar Bot Discovery (Ask First, Never Guess)
When you ask your AI to create or optimize a bot (e.g. *"Build me a tennis bot"*), the AI will:
1. Call `starkov_list_bots` to check your current subscription tier (**Starter Free** Level 1, **Pro $19/mo** Level 2, or **Quant $49/mo** Level 3) and existing bots.
2. Ask you **2 to 4 concise multiple-choice questions** covering any missing pillars using options unlocked on your plan:
   - **`01 TARGET`**: Sport (`Tennis`, `Soccer`, `NBA`, `NFL`, `NHL`, `MLB`), circuits/leagues, and court surface / environment.
   - **`02 TRIGGER`**: Entry condition (Pre-Match Value vs. Live In-Play Comeback Dip, Favorite vs. Underdog) and minimum de-vigged `+EV Edge %` (`> 1.5%`, `> 2.5%`, `> 4.0%`, `> 6.0%`).
   - **`03 ORDER`**: Stake sizing (`$10 / $25 / $50 Fixed USD`, `% of Wallet`, or `[Pro] Fractional Kelly Criterion`), contract side (`YES` / `NO`), and order type (`Limit Maker 0% Fee` vs. `Market Taker Instant`).
   - **`04 EXIT`**: Exit discipline (`Wait Until End of Match` vs. `Odds Convergence Early Cashout`), Take-Profit `%`, and Stop-Loss `%`.

### Step B — Instant Live Dry-Run & 24/7 Cloud Paper Sandbox
Once your 4 pillars are configured via `starkov_configure_bot`:
- **Live Market Dry-Run (`starkov_evaluate_bot_on_live_markets`)**: The AI tests your bot right now against live and upcoming matches using Python's `evaluator.py` + `execution_simulator.py` (computing L2 VWAP orderbook slippage and official Kalshi/Polymarket fees).
- **24/7 Cloud Paper Sandbox**: When your bot status is `active`, Starkov's cloud engine monitors live games 24/7 and executes paper trades in your `$1,000` sandbox wallet at [https://starkov-app.vercel.app/wallet](https://starkov-app.vercel.app/wallet).

### Step C — Deploy to Live Kalshi & Polymarket (`starkov-relay.mjs`)
At the end of the workflow, when you are ready to route signals from your bot to your real-money **Kalshi** or **Polymarket** account:
- Ask your AI assistant: *"Prepare live deployment for my bot on Kalshi"* (`starkov_prepare_live_deployment`), **OR** click the **Deploy** button in the top bar of [https://starkov-app.vercel.app/bots](https://starkov-app.vercel.app/bots).
- Choose between:
  1. **1-Click Railway Cloud Deploy**: Opens the pre-filled Railway template for this repository (`Dockerfile` + `starkov-relay.mjs`). Paste your Kalshi/Polymarket keys into your own private Railway service and click **Deploy**.
  2. **Local Terminal / VPS / Docker CLI**: Run `node starkov-relay.mjs` directly on your own machine or server (requires Node.js 18+, zero external npm dependencies).

---

## 3. Available MCP Tools (10 Tools) & Built-in Documentation Resources

### MCP Tools
| Tool Name | Mode | Description |
| :--- | :--- | :--- |
| `starkov_get_live_opportunities` | Read-Only | Scans live & upcoming matches across Tennis, Soccer, NBA, NFL, NHL, and MLB with Bid/Ask/Spread, de-vigged fair probability, gross edge %, and post-fee / post-L2-VWAP-slippage Net EV %. |
| `starkov_propose_trade_plan` | Read-Only | **NOFX Frontier Copilot**: Proposes 3 side-by-side entry plans (`Plan A: Maker Limit $0 Fee`, `Plan B: Taker Market VWAP`, `Plan C: 3-Tranche DCA Ladder`) sized by Fractional Kelly. |
| `starkov_approve_sandbox_trade` | Write (Confirm) | Submits a human-approved trade into your paper-trading sandbox wallet (`bot_executions` / `user_wallets`). |
| `starkov_get_bot_schema` | Read-Only | Inspects all 64 Config Panel `slotId`s across `01 TARGET`, `02 TRIGGER`, `03 ORDER`, and `04 EXIT`, including per-user tier lock status. |
| `starkov_list_bots` | Read-Only | Lists all bots on your account (`#1`, `#2`, UUID, status, 4-pillar validation, and subscription tier) plus interactive coaching prompts. |
| `starkov_configure_bot` | Write (Confirm) | Creates or updates a 4-pillar bot and returns the complete 3-stage deployment playbook (`deployment_and_next_steps`). |
| `starkov_set_bot_status` | Write (Confirm) | Activates (`activate`), pauses (`pause`), archives (`archive`), or deletes (`delete`) a bot. |
| `starkov_evaluate_bot_on_live_markets` | Read-Only | Dry-runs a bot against live radar matches using Python's `evaluator.py` + `execution_simulator.py`. |
| `starkov_get_portfolio_and_logs` | Read-Only | Audits sandbox wallet balance, win rate %, net post-fee realized PnL, cumulative fees, average L2 VWAP slippage, and `N >= 100` statistical significance. |
| `starkov_prepare_live_deployment` | Write | Generates your bot's **1-Click Railway Deploy URL**, **`npx` / Docker CLI command**, and `.env` template (`STARKOV_BOT_TOKEN=stk_live_...`), or sends a live `PING_TEST` (`action: "ping_test"`) to verify your running relay connection. |
| `starkov_reset_sandbox_wallet` | Write (Confirm) | Resets or tops up your Paper-Trading Sandbox Wallet (`$1,000.00` default) and optionally clears past sandbox test executions/logs to start a clean `N >= 100` forward-test. |

### Built-in MCP Resources (`resources/list` & `resources/read`)
Your AI assistant can read any of these built-in reference documents directly over MCP:
- `starkov://docs/bot-builder-discovery-guide` — Interactive 4-Pillar Bot Builder & User Questioning Guide
- `starkov://docs/end-to-end-deploy-and-live-relay` — End-to-End Bot Lifecycle & Non-Custodial Live Deployment (`starkov-relay.mjs`)
- `starkov://docs/4-pillar-architecture-and-tiers` — 64-Slot Strategy Architecture & Subscription Tiers
- `starkov://docs/microstructure-vwap-and-fees` — Orderbook Microstructure, L2 VWAP Slippage & Exchange Fee Math

---

## 4. Running the Non-Custodial Live Relay (`starkov-relay.mjs`)

### Why Non-Custodial?
Starkov never asks for, sees, or stores your Kalshi RSA Private Key or Polymarket CLOB L2 keys. `starkov-relay.mjs` is a 100% open-source, zero-dependency Node.js 18+ script that polls your authenticated bot signal queue (`STARKOV_BOT_TOKEN=stk_live_...`) and signs orders locally using Node's built-in `node:crypto`.

### Option A: 1-Click Railway Deploy
Run `starkov_prepare_live_deployment` in your MCP client (or click **Deploy** on `/bots`) to open the pre-filled Railway template, paste your exchange credentials, and deploy in 1 click.

### Option B: Local CLI / VPS / Docker
```bash
git clone https://github.com/FUTFURY/starkov-mcp.git
cd starkov-mcp
cp .env.example .env
# Edit .env with your STARKOV_BOT_TOKEN (stk_live_...) and Kalshi/Polymarket API keys
node starkov-relay.mjs
```
Or run with Docker:
```bash
docker build -t starkov-relay .
docker run -d --name starkov-relay --env-file .env -p 8080:8080 starkov-relay
```
