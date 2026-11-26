/** Dedicated referral view; does not modify any game leaderboard calculations. */
import { auth, onAuthStateChanged } from '../auth/api/firebase-config.js';
import { workerConfigured, getReferralStatus, getReferralLeaderboard } from '../referrals/referral-client.js';
const tab = document.getElementById('lbReferralTab');
const view = document.getElementById('lbReferralView');
const games = document.getElementById('lbGameViews');
const results = document.getElementById('lbReferralList');
const message = document.getElementById('lbReferralMessage');
let user = null;
let selected = false;
let requestId = 0;

function showReferrals() {
  selected = true;
  tab.classList.add('is-active');
  tab.setAttribute('aria-pressed', 'true');
  document.querySelectorAll('.lb-view-tab:not(.gg-referral-tab)').forEach((button) => {
    button.classList.remove('is-active'); button.setAttribute('aria-pressed', 'false');
  });
  view.hidden = false;
  games.hidden = true;
  void load();
}

function showGameViews() {
  selected = false;
  requestId++;
  tab.classList.remove('is-active'); tab.setAttribute('aria-pressed', 'false');
  view.hidden = true; games.hidden = false;
}

async function load() {
  const mine = document.getElementById('lbReferralMine');
  const rank = document.getElementById('lbReferralMyRank');
  const id = ++requestId;
  if (!user || !workerConfigured()) {
    results.textContent = workerConfigured() ? 'Sign in to see referrals.' : 'Referral service has not been configured yet.';
    message.textContent = '';
    return;
  }
  results.textContent = 'Loading the top 10 referrers…';
  message.textContent = '';
  try {
    // Only two requests on the first tab visit; subsequent visits reuse
    // the client-side leaderboard cache for two minutes.
    const [stats, ranking] = await Promise.all([
      getReferralStatus(user), getReferralLeaderboard(user),
    ]);
    if (id !== requestId || !selected) return;
    mine.textContent = String(stats.referralCount ?? 0);
    results.replaceChildren();
    const players = ranking.players || [];
    const index = players.findIndex((player) => player.uid === user.uid);
    rank.textContent = index < 0 ? '—' : `#${index + 1}`;
    if (!players.length) { results.textContent = 'No confirmed referrals yet — be the first to invite a friend!'; return; }
    players.forEach((player, idx) => {
      const line = document.createElement('article'); line.className = 'gg-referral-row';
      const medal = document.createElement('span'); medal.className = 'gg-referral-number';
      medal.textContent = `#${idx + 1}`;
      const person = document.createElement('strong');
      person.textContent = player.displayName;
      const count = document.createElement('span'); count.className = 'gg-referral-count';
      count.textContent = `${player.referralCount} ${player.referralCount === 1 ? 'referral' : 'referrals'}`;
      line.append(medal, person, count); results.append(line);
    });
  } catch (error) {
    if (id !== requestId) return;
    results.textContent = 'Unable to load referral rankings.';
    message.textContent = error.message || 'Please try again later.';
  }
}

tab.addEventListener('click', showReferrals);
document.querySelectorAll('.lb-view-tab:not(.gg-referral-tab)').forEach((button) => button.addEventListener('click', showGameViews));
onAuthStateChanged(auth, (nextUser) => { user = nextUser; if (selected) void load(); });
if (new URLSearchParams(window.location.search).get('view') === 'referrals') showReferrals();
