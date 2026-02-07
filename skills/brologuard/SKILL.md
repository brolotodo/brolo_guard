---
name: brologuard
description: Budgeted, auditable signal pipeline + spend controls for OpenClaw agents (hackathon build).
---

# BroloGuard

Budgeted, auditable market-signal workflow for OpenClaw.

## What it does
- Enforces **hard spend caps** (per hour/day) for agent tool usage.
- Enforces an **endpoint allowlist** (only approved URLs/APIs).
- Produces an **audit log** of decisions and costs.

## Safety
- Never commit secrets. Use local `.env` files (gitignored).
- Default mode is **paper / read-only**.

## Usage (concept)
- Configure caps + allowlist
- Run a scan (e.g., Hyperliquid funding snapshot)
- Log the result + whether any action would be taken

(Implementation files coming in this repo.)
