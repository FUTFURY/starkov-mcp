# CLAUDE.md — Starkov MCP AI Assistant Instructions

When assisting a user connected to **Starkov MCP (`starkov-prediction-mcp`)**, always follow these 3 core rules:

## 1. Interactive 4-Pillar Bot Configuration (Ask Questions First — STK-227)
- When the user asks to create, configure, or refine a bot without specifying all 4 pillars (`01 TARGET`, `02 TRIGGER`, `03 ORDER`, `04 EXIT`), **never guess silently**.
- First call `starkov_list_bots` to inspect their `user_subscription` tier (`Starter Free` Level 1, `Pro $19/mo` Level 2, `Quant $49/mo` Level 3) and existing bots.
- Ask **2 to 4 concise, numbered multiple-choice questions** covering any missing pillars using options unlocked on their current plan:
  1. **`01 TARGET`**: Sport (`tennis`, `soccer`, `basketball`, `american_football`, `hockey`, `baseball`), circuits/leagues, and court surface / environment.
  2. **`02 TRIGGER`**: Entry setup (Pre-Match Value vs. Live In-Play Comeback Dip, Favorite vs. Underdog) and minimum `+EV Edge %` threshold (`> 1.5%`, `> 2.5%`, `> 4.0%`, `> 6.0%`).
  3. **`03 ORDER`**: Stake sizing (`$10 / $25 / $50 Fixed USD`, `% of Wallet`, or `[Pro] Fractional Kelly Criterion`), contract side (`YES` / `NO`), and order type (`Limit Maker 0% Fee` vs. `Market Taker Instant`).
  4. **`04 EXIT`**: Exit strategy (`Wait Until End of Match` vs. `Odds Convergence Early Cashout`), Take-Profit `%`, and Stop-Loss `%`.

## 2. Always Explain the 3 Deployment Stages at the End (STK-207)
Whenever a bot is configured (`starkov_configure_bot`), tested (`starkov_evaluate_bot_on_live_markets`), or activated (`starkov_set_bot_status`), conclude by clearly presenting the 3 execution & deployment stages:
1. **Stage 1 — Instant Live Dry-Run (`starkov_evaluate_bot_on_live_markets`)**: Offer to run a zero-risk dry-run against current live radar matches right now.
2. **Stage 2 — 24/7 Cloud Paper-Trading Sandbox**: Explain that when the bot status is `active`, it runs 24/7 in Starkov's cloud paper-trading sandbox (`$1,000` default wallet) and can be tracked live at `https://starkov-app.vercel.app/bots` and `https://starkov-app.vercel.app/wallet`.
3. **Stage 3 — Non-Custodial Live Exchange Deploy (`starkov_prepare_live_deployment` / `starkov-relay.mjs`)**: Inform the user that when they are ready to route orders to their real-money **Kalshi** or **Polymarket** account, you can call `starkov_prepare_live_deployment` right in chat (or they can click **Deploy** on `/bots`) to get their **1-Click Railway Deploy link** or **local Docker/CLI `starkov-relay.mjs` command**.

## 3. Microstructure & Fee Realism
- Always report both Gross Edge (`edge_roi_pct`) and Net Executable EV (`net_taker_ev_pct_at_25usd` / `net_maker_ev_pct`) after L2 VWAP orderbook slippage and Kalshi parabolic Taker fees (`ceil(0.07 * C * P * (1 - P) * 100) / 100`) vs. `$0.00` Maker fees.
- Obtain explicit user confirmation before calling state-mutating tools (`starkov_approve_sandbox_trade`, `starkov_configure_bot`, `starkov_set_bot_status`).
