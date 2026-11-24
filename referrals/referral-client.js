/** Referral attribution and API client. Never writes directly to Firestore. */
import { REFERRAL_API_URL, REFERRAL_LINK_ORIGIN } from './config.js';

const ATTRIBUTION_KEY = 'gg_zatam_referral_attribution_v1';
const ATTRIBUTION_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const QUERY_LIMIT = 12000;
let leaderboardCache = null;
let statsCache = null;

export function workerConfigured() {
  try {
    const url = new URL(REFERRAL_API_URL);
    return url.protocol === 'https:' && !url.hostname.toLowerCase().includes('your-subdomain');
  } catch { return false; }
}

export function captureReferralFromUrl(search = window.location.search, storage = localStorage, now = Date.now()) {
  const param = new URLSearchParams(search).get('ref');
  const code = String(param || '').trim().toUpperCase();
  const existing = readReferral(storage, now);
  if (existing) return existing;
  if (!CODE_RE.test(code)) return null;
  try { storage.setItem(ATTRIBUTION_KEY, JSON.stringify({ code, capturedAt: now })); } catch { /* private browsing */ }
  return code;
}

export function readReferral(storage = localStorage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(ATTRIBUTION_KEY) || 'null');
    if (CODE_RE.test(saved?.code) && Number.isFinite(saved.capturedAt) &&
        now >= saved.capturedAt && now - saved.capturedAt <= ATTRIBUTION_MS) return saved.code;
    storage.removeItem(ATTRIBUTION_KEY);
  } catch { /* storage disabled */ }
  return null;
}

export function referralLink(code) {
  if (!CODE_RE.test(code)) throw new Error('Invalid referral code');
  const url = new URL('/auth/signup.html', REFERRAL_LINK_ORIGIN);
  url.searchParams.set('ref', code);
  return url.toString();
}

async function api(path, user, { method = 'GET', data } = {}) {
  if (!workerConfigured()) throw new Error('Referral service is not configured yet.');
  if (!user) throw new Error('Please sign in to use referrals.');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_LIMIT);
  try {
    const response = await fetch(`${REFERRAL_API_URL.replace(/\/$/, '')}/api/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(data ? { 'content-type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Referral service unavailable (${response.status})`);
    return payload;
  } finally { clearTimeout(timeout); }
}

export async function getReferralStatus(user, force = false) {
  if (!force && statsCache?.uid === user?.uid && Date.now() - statsCache.at < 120000) return statsCache.data;
  const data = await api('me', user);
  statsCache = { uid: user.uid, data, at: Date.now() };
  return data;
}
export async function getOrCreateReferralCode(user) {
  const data = await api('code', user, { method: 'POST' });
  statsCache = { uid: user.uid, data, at: Date.now() };
  return data;
}

export async function claimReferralOnSignup(user) {
  const code = readReferral();
  if (!code || !workerConfigured() || !user) return null;
  // Skip network/Firestore calls for obviously existing accounts; the Worker
  // independently enforces eligibility using Firebase Auth account metadata.
  const createdAt = Date.parse(user.metadata?.creationTime || '');
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000) return null;
  const response = await api('claim', user, { method: 'POST', data: { code } });
  if (response?.status === 'pending' || response?.status === 'confirmed') {
    try { localStorage.removeItem(ATTRIBUTION_KEY); } catch { /* ignore */ }
  }
  return response;
}

// Called only after a verified email sign-in or Google sign-in.
// Checking a claim costs at most one Firestore document read; a confirmed claim
// does not write again. Never block login because of a referral API outage.
export async function confirmReferralOnLogin(user) {
  if (!workerConfigured() || !user?.emailVerified) return null;
  const result = await api('confirm', user, { method: 'POST' });
  if (result?.status === 'confirmed') { statsCache = null; leaderboardCache = null; }
  return result;
}

export async function getReferralLeaderboard(user, force = false) {
  if (!force && leaderboardCache && Date.now() - leaderboardCache.at < 120000) return leaderboardCache.data;
  const data = await api('leaderboard', user);
  leaderboardCache = { at: Date.now(), data };
  return data;
}

export function clearReferralLeaderboardCache() { leaderboardCache = null; }
