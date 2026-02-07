import { loadConfig, assertAllowlistedUrl, audit, charge } from './guard.js';

const URL = 'https://api.hyperliquid.xyz/info';

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function ctxByCoin(snapshot, coin) {
  const universe = snapshot?.[0]?.universe;
  const ctxs = snapshot?.[1];
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) return null;
  const idx = universe.findIndex(x => x?.name === coin);
  if (idx < 0) return null;
  return ctxs[idx];
}

async function main() {
  const cfg = loadConfig();
  assertAllowlistedUrl(URL, cfg);

  // Cheap, fixed "cost" for API calls (for budget accounting). Adjust later.
  charge(0.01, cfg, 'hyperliquid:metaAndAssetCtxs');

  const snap = await postJson(URL, { type: 'metaAndAssetCtxs' });

  const coins = cfg?.strategy?.hyperliquid?.coins || ['BTC','ETH','HYPE'];
  const thr = Number(cfg?.strategy?.hyperliquid?.fundingThresholdPer8h ?? 0.0007);

  const rows = [];
  for (const c of coins) {
    const ctx = ctxByCoin(snap, c);
    if (!ctx) continue;
    const funding = num(ctx.funding);
    const markPx = num(ctx.markPx);
    const oi = num(ctx.openInterest);
    rows.push({ coin: c, funding, markPx, openInterest: oi });
  }

  const triggers = rows.filter(r => (r.funding ?? -1) > thr);

  audit({ kind: 'hyperliquid_scan', rows, threshold: thr, triggers: triggers.map(t => t.coin) });

  // Output human-readable summary
  console.log(JSON.stringify({ ok: true, threshold: thr, rows, triggers }, null, 2));
}

main().catch(e => {
  audit({ kind: 'error', where: 'hyperliquid_scan', message: String(e?.message || e) });
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }));
  process.exit(1);
});
