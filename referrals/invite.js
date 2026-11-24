import { auth, onAuthStateChanged } from '../auth/api/firebase-config.js';
import { workerConfigured, getReferralStatus, getOrCreateReferralCode, getReferralLeaderboard, referralLink } from './referral-client.js';

const byId = (id) => document.getElementById(id);
const status = byId('ref-feedback');
const input = byId('ref-link');
const copyBtn = byId('ref-copy');
const shareBtn = byId('ref-native-share');
const whatsapp = byId('ref-whatsapp');
let currentLink = '';

function say(message, error = false) {
  status.textContent = message;
  status.classList.toggle('ref-error', error);
}

function renderPlayers(players) {
  const holder = byId('ref-top-list');
  holder.replaceChildren();
  if (!players.length) {
    const empty = document.createElement('p'); empty.className = 'ref-muted';
    empty.textContent = 'No confirmed referrals yet. Invite your first friend!';
    holder.append(empty); return;
  }
  players.forEach((player, index) => {
    const row = document.createElement('div'); row.className = 'ref-top-row';
    const rank = document.createElement('span'); rank.className = 'ref-position'; rank.textContent = `#${index + 1}`;
    const name = document.createElement('strong'); name.textContent = player.displayName;
    const count = document.createElement('span'); count.className = 'ref-points'; count.textContent = `${player.referralCount} invited`;
    row.append(rank, name, count); holder.append(row);
  });
}

async function load(user) {
  if (!workerConfigured()) {
    input.value = 'Referral service setup required';
    say('The referral service must be deployed and configured before invitations can be issued.', true);
    byId('ref-top-list').textContent = 'Not configured yet.';
    return;
  }
  try {
    // Code creation occurs only on this explicit Invite Friends page.
    const me = await getOrCreateReferralCode(user);
    currentLink = referralLink(me.referralCode);
    input.value = currentLink;
    copyBtn.disabled = false; shareBtn.disabled = false;
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`Join me to learn Sanskrit on GG — Zat.am! ${currentLink}`)}`;
    whatsapp.removeAttribute('aria-disabled');
    byId('ref-confirmed').textContent = String(me.referralCount || 0);
    say('Your invitation link is ready.');
  } catch (error) { say(error.message || 'Unable to prepare invitation.', true); }
  try {
    const data = await getReferralLeaderboard(user);
    renderPlayers(data.players || []);
    const idx = (data.players || []).findIndex((item) => item.uid === user.uid);
    byId('ref-rank').textContent = idx >= 0 ? `#${idx + 1}` : '—';
    byId('ref-rank-caption').textContent = idx >= 0 ? 'Among top 10 inviters' : 'Not currently in top 10';
  } catch {
    byId('ref-top-list').textContent = 'Referral rankings are temporarily unavailable.';
  }
}

copyBtn.addEventListener('click', async () => {
  if (!currentLink) return;
  try { await navigator.clipboard.writeText(currentLink); say('Link copied!'); }
  catch { input.select(); say('Select and copy the link above.'); }
});
shareBtn.addEventListener('click', async () => {
  if (!currentLink) return;
  try {
    if (navigator.share) await navigator.share({ title: 'Join me on GG — Zat.am', text: 'Learn Sanskrit with me!', url: currentLink });
    else { await navigator.clipboard.writeText(currentLink); say('Link copied — ready to share.'); }
  } catch (error) { if (error.name !== 'AbortError') say('Use Copy link to share your invitation.', true); }
});

onAuthStateChanged(auth, (user) => { if (user) void load(user); });
