import { auth, db, doc, onAuthStateChanged } from '../../auth/api/firebase-config.js';
import {
  collection, collectionGroup, getCountFromServer, getDoc, getDocFromServer,
  getDocs, limit, onSnapshot, orderBy, query, Timestamp, where,
} from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';
import { menu } from '../../app.js';
import { daysInRange, extractAttempts, localDayKey, monthIdsSince, summarizeGames } from './analytics-utils.mjs';

const access = document.getElementById('access-state');
const dashboard = document.getElementById('admin-dashboard');
const status = document.getElementById('data-status');
const rangeSelect = document.getElementById('date-range');
const refreshButton = document.getElementById('refresh-dashboard');
const fmt = new Intl.NumberFormat('en-CA');
const MAX_VISITS_FOR_CHART = 1200;
const numbers = (value) => fmt.format(value);
let currentLoad = 0;
let unsubscribeRole = null;
let grantedUid = null;

function text(id, value) {
  document.getElementById(id).textContent = String(value);
}
function setStatus(message, tone = '') {
  status.textContent = message;
  status.dataset.tone = tone;
}
function showAccess(title, message) {
  currentLoad++;
  dashboard.hidden = true;
  access.hidden = false;
  text('access-title', title);
  text('access-description', message);
}
function logoutRedirect() {
  dashboard.hidden = true;
  const login = new URL('../../auth/login.html', import.meta.url);
  login.searchParams.set('redirect', window.location.pathname + window.location.search + window.location.hash);
  window.location.replace(login.href);
}
function checkRole(uid) {
  return doc(db, 'users', uid, 'private', 'account');
}

const resetMeters = () => {
  ['stat-players','stat-signups','stat-visits','stat-scores','stat-active-users','stat-average-score']
    .forEach((id) => text(id, '—'));
};

function emptyNode(container, message) {
  container.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'gg-empty';
  empty.textContent = message;
  container.append(empty);
}
function appendPerson(container, title, detail, pill) {
  const line = document.createElement('div'); line.className = 'gg-person-row';
  const info = document.createElement('div');
  const name = document.createElement('div'); name.className = 'gg-person-name'; name.textContent = title;
  const sub = document.createElement('div'); sub.className = 'gg-person-detail'; sub.textContent = detail;
  info.append(name, sub);
  const badge = document.createElement('span'); badge.className = 'gg-person-label'; badge.textContent = pill;
  line.append(info, badge); container.append(line);
}
function niceDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date unavailable';
}
function startOfPeriod(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

async function loadProfiles(start) {
  const profiles = collectionGroup(db, 'public');
  const since = Timestamp.fromDate(start);
  const [all, newcomers, recentlyActive, recent, longest] = await Promise.all([
    getCountFromServer(profiles),
    getCountFromServer(query(profiles, where('createdAt', '>=', since))),
    getCountFromServer(query(profiles, where('lastLogin', '>=', since))),
    getDocs(query(profiles, orderBy('createdAt', 'desc'), limit(6))),
    getDocs(query(profiles, orderBy('streak', 'desc'), limit(6))),
  ]);
  return {
    total: all.data().count,
    newUsers: newcomers.data().count,
    active: recentlyActive.data().count,
    recent: recent.docs.map((record) => record.data()),
    streaks: longest.docs.map((record) => record.data()),
  };
}

async function loadVisits(start) {
  const visits = collection(db, 'gameVisits');
  const since = Timestamp.fromDate(start);
  const filtered = query(visits, where('visitedAt', '>=', since));
  const [count, sample] = await Promise.all([
    getCountFromServer(filtered),
    getDocs(query(visits, where('visitedAt', '>=', since), orderBy('visitedAt', 'desc'), limit(MAX_VISITS_FOR_CHART))),
  ]);
  return { count: count.data().count, recent: sample.docs.map((item) => item.data()) };
}

async function loadScores(start) {
  const months = monthIdsSince(start);
  // Same Global documents already written by games/shared/game-score.js.
  const snapshots = await Promise.all(months.map((month) => getDoc(doc(db, 'leaderboards', 'Global', 'gameHistory', month))));
  const data = snapshots.filter((snap) => snap.exists()).map((snap) => snap.data());
  return extractAttempts(data, start.getTime());
}

function renderProfiles(profiles) {
  text('stat-players', numbers(profiles.total));
  text('stat-signups', numbers(profiles.newUsers));
  text('stat-active-users', numbers(profiles.active));
  const recent = document.getElementById('recent-players'); recent.replaceChildren();
  if (!profiles.recent.length) emptyNode(recent, 'No registered profiles yet.');
  profiles.recent.forEach((p) => appendPerson(recent, String(p.name || 'Player').slice(0, 120), niceDate(p.createdAt), p.preferencesSet ? 'Ready' : 'New'));
  const streaks = document.getElementById('streak-list'); streaks.replaceChildren();
  if (!profiles.streaks.length) emptyNode(streaks, 'No streak data yet.');
  profiles.streaks.forEach((p, index) => appendPerson(streaks, String(p.name || 'Player').slice(0, 120), `Rank #${index + 1}`, `🔥 ${Number(p.streak) || 0} days`));
}

function renderVisitChart(days, visits) {
  const chart = document.getElementById('visits-chart'); chart.replaceChildren();
  const dailyKeys = daysInRange(days);
  const daily = new Map(dailyKeys.map((day) => [day, 0]));
  for (const visit of visits) {
    const date = visit.visitedAt?.toDate?.();
    if (!date) continue;
    const key = localDayKey(date);
    if (daily.has(key)) daily.set(key, daily.get(key) + 1);
  }
  // 90-day reports group into 13 weekly bars to remain legible.
  const groupSize = days > 30 ? 7 : 1;
  const entries = [...daily].map(([date, count]) => ({ date, count }));
  const bins = [];
  for (let i = 0; i < entries.length; i += groupSize) {
    const segment = entries.slice(i, i + groupSize);
    bins.push({ date: segment[0].date, count: segment.reduce((sum, row) => sum + row.count, 0) });
  }
  const highest = Math.max(1, ...bins.map((bin) => bin.count));
  bins.forEach((bin, i) => {
    const item = document.createElement('div'); item.className = 'gg-bar-item';
    const bar = document.createElement('span'); bar.className = 'gg-bar-fill';
    bar.style.height = `${Math.max(2, Math.round((bin.count / highest) * 145))}px`;
    bar.title = `${bin.date}: ${bin.count} recorded visits`;
    const label = document.createElement('span'); label.className = 'gg-bar-label';
    const show = bins.length <= 15 || i % 5 === 0 || i === bins.length - 1;
    label.textContent = show ? bin.date.slice(5) : '';
    item.append(bar, label); chart.append(item);
  });
}

function renderGames(catalog, visits, attempts) {
  const rows = summarizeGames(catalog, visits, attempts);
  const table = document.getElementById('game-table'); table.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 4; td.textContent = 'No games found in the catalog.'; tr.append(td); table.append(tr); return;
  }
  rows.forEach((game) => {
    const tr = document.createElement('tr');
    [game.name, numbers(game.visits), numbers(game.scores), game.scores ? `${Math.round(game.scoreTotal / game.scores)} / 100` : '—']
      .forEach((value) => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
    table.append(tr);
  });
}
function renderScores(attempts) {
  text('stat-scores', numbers(attempts.length));
  text('stat-average-score', attempts.length
    ? `${(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length).toFixed(1)} / 100` : '—');
  const list = document.getElementById('score-list'); list.replaceChildren();
  if (!attempts.length) { emptyNode(list, 'No score submissions for this period.'); return; }
  attempts.slice(0, 6).forEach((attempt) => {
    appendPerson(list, attempt.gameName || attempt.gameId || 'Unspecified game',
      niceDate(attempt.completedAt), `${attempt.score} / 100`);
  });
}

const catalog = menu.map((item) => ({
  id: String(item.dir || '').match(/(?:^|\/)games\/([a-zA-Z0-9_-]+)/)?.[1] || '',
  name: String(item.title || '').trim(),
})).filter((item) => item.id);

async function refreshReports() {
  const cycle = ++currentLoad;
  const days = Number(rangeSelect.value) || 30;
  const since = startOfPeriod(days);
  const periodLabel = `Last ${days} days`;
  text('visits-range', periodLabel);
  refreshButton.disabled = true;
  setStatus('Loading GG statistics from Firestore…');
  resetMeters();
  const [profiles, visits, scores] = await Promise.allSettled([
    loadProfiles(since), loadVisits(since), loadScores(since),
  ]);
  if (cycle !== currentLoad || dashboard.hidden) return;
  const errors = [];
  if (profiles.status === 'fulfilled') renderProfiles(profiles.value);
  else { errors.push('players & streaks'); console.error('Profile report failed:', profiles.reason); }
  if (visits.status === 'fulfilled') {
    text('stat-visits', numbers(visits.value.count));
    renderVisitChart(days, visits.value.recent);
    const sampled = visits.value.count > visits.value.recent.length;
    text('visit-note', sampled
      ? `Charts and per-game visits show the latest ${visits.value.recent.length} records; the visit total is exact. Larger reporting ranges need backend aggregation.`
      : 'Visits are recorded on authenticated game pages with the shared GG navbar (one per game per tab, per 30 minutes).');
  } else { errors.push('game visits'); console.error('Game visit report failed:', visits.reason); }
  if (scores.status === 'fulfilled') renderScores(scores.value);
  else { errors.push('scores'); console.error('Score report failed:', scores.reason); }
  renderGames(catalog,
    visits.status === 'fulfilled' ? visits.value.recent : [],
    scores.status === 'fulfilled' ? scores.value : []);
  text('updated-at', `Updated ${new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`);
  setStatus(errors.length
    ? `Some reports could not be loaded (${errors.join(', ')}). Check the GG Firestore rules and required collection-group indexes; other reports remain available.`
    : 'Reports loaded successfully. All data shown below comes from GG Firestore.',
    errors.length ? 'error' : 'success');
  refreshButton.disabled = false;
}

async function verifyAdmin() {
  showAccess('Checking access…', 'Please wait while we verify your administrator permissions.');
  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user || !user.emailVerified) { logoutRedirect(); return; }
    const accountRef = checkRole(user.uid);
    // Never show previously cached admin information while offline.
    const account = await getDocFromServer(accountRef);
    if (!account.exists() || account.data().isAdmin !== true) {
      showAccess('Admin Access Only', 'This area is only available to GG administrators. You can continue playing games and exploring the website.');
      return;
    }
    grantedUid = user.uid;
    access.hidden = true;
    dashboard.hidden = false;
    await refreshReports();
    unsubscribeRole?.();
    unsubscribeRole = onSnapshot(accountRef, (docSnap) => {
      if (!docSnap.exists() || docSnap.data().isAdmin !== true) {
        showAccess('Admin Access Only', 'Your administrator access is no longer available.');
      }
    }, (error) => {
      console.warn('Administrator role could not be monitored:', error);
      showAccess('Cannot verify access', 'Please check your connection and reload this page.');
    });
  } catch (error) {
    console.error('Admin access validation failed:', error);
    showAccess('Unable to verify access', 'We could not check your permissions. Check your connection or ask an administrator to review your Firestore account role.');
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user && grantedUid) {
    unsubscribeRole?.();
    grantedUid = null;
    logoutRedirect();
  }
});
rangeSelect.addEventListener('change', () => { if (!dashboard.hidden) void refreshReports(); });
refreshButton.addEventListener('click', () => { if (!dashboard.hidden) void refreshReports(); });
void verifyAdmin();
