import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const STATE_PATH = path.join(ROOT, 'logs', 'state.json');
const AUDIT_PATH = path.join(ROOT, 'logs', 'audit.jsonl');

function nowIso() {
  return new Date().toISOString();
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function hourKey(d = new Date()) {
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

export function loadConfig() {
  const cfgPath = process.env.BROLOGUARD_CONFIG || path.join(ROOT, 'src', 'config.json');
  if (fs.existsSync(cfgPath)) return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  // fallback to example
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'config.example.json'), 'utf8'));
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return {
      day: dayKey(),
      hour: hourKey(),
      spentDayUsd: 0,
      spentHourUsd: 0,
      counters: {}
    };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {
      day: dayKey(),
      hour: hourKey(),
      spentDayUsd: 0,
      spentHourUsd: 0,
      counters: {}
    };
  }
}

function saveState(st) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(st, null, 2));
}

export function audit(event) {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: nowIso(), ...event }) + '\n');
}

export function assertAllowlistedUrl(url, cfg) {
  const allowed = new Set(cfg?.allowlist?.urls || []);
  if (!allowed.has(url)) {
    audit({ kind: 'blocked_url', url });
    throw new Error(`URL not allowlisted: ${url}`);
  }
}

export function charge(costUsd, cfg, label = 'unknown') {
  const caps = cfg?.caps || {};
  const perHour = Number(caps.perHourUsd ?? 0);
  const perDay = Number(caps.perDayUsd ?? 0);

  const st = loadState();
  const dk = dayKey();
  const hk = hourKey();

  if (st.day !== dk) {
    st.day = dk;
    st.spentDayUsd = 0;
  }
  if (st.hour !== hk) {
    st.hour = hk;
    st.spentHourUsd = 0;
  }

  const nextDay = st.spentDayUsd + costUsd;
  const nextHour = st.spentHourUsd + costUsd;

  if (perDay > 0 && nextDay > perDay) {
    audit({ kind: 'cap_hit', scope: 'day', label, costUsd, spentDayUsd: st.spentDayUsd, capUsd: perDay });
    throw new Error(`Daily cap hit (${nextDay.toFixed(2)} > ${perDay.toFixed(2)})`);
  }
  if (perHour > 0 && nextHour > perHour) {
    audit({ kind: 'cap_hit', scope: 'hour', label, costUsd, spentHourUsd: st.spentHourUsd, capUsd: perHour });
    throw new Error(`Hourly cap hit (${nextHour.toFixed(2)} > ${perHour.toFixed(2)})`);
  }

  st.spentDayUsd = nextDay;
  st.spentHourUsd = nextHour;
  saveState(st);

  audit({ kind: 'charge', label, costUsd, spentDayUsd: st.spentDayUsd, spentHourUsd: st.spentHourUsd });
}
