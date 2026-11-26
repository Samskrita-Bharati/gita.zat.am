import {
  collection,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  deleteField,
  FieldPath,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

import { auth, db } from "../auth/api/firebase-config.js";

import {
  getLeaderboardGames,
  getRawData,
  getMonthlyHistoryPage,
  invalidateLeaderboardCache,
} from "./leaderboard-utils.js";
import { rankGamePlayers } from "./score-ranking.mjs";
import { groupRankedGames, pageGamePlayers } from "./game-accordion.mjs";
import { openScoreShare } from "../games/shared/score-share.js";

// =====================================================
// PAGE STATE
// =====================================================

const state = {
  activeView: "overall",
  currentUser: null,
  currentRawData: [],
  allTimeGlobalHistory: [],
  leaderboardData: [],
  currentPage: 1,
  perPage: 10,
  games: [],
  gameMap: new Map(),
  profileCache: new Map(),
  levelOptionsCache: new Map(),
  expandedRows: new Set(),
  openGameId: null,
  gamePage: 1,
  shlokaVisible: new Map(),
  attemptsVisible: new Map(),
  openLevels: new Set(),
  historyRecords: [],
  historyCursor: null,
  historyHasMore: true,
  historySource: null,
  renderToken: 0,
};

// =====================================================
// ELEMENTS
// =====================================================

const gameSelect = document.getElementById("gameSelect");
const levelSelect = document.getElementById("levelSelect");
const timeSelect = document.getElementById("timeFilter");
const seasonDate = document.getElementById("seasonDate");
const scoringField = document.getElementById("scoringField");
const filterTitle = document.getElementById("filterTitle");
const filterRangeDisplay = document.getElementById("filterRangeDisplay");

const rankingSection = document.getElementById("rankingSection");
const rankingTitle = document.getElementById("rankingTitle");

const leaderboardTableHeader = document.getElementById(
  "leaderboardTableHeader",
);
const leaderboard = document.getElementById("leaderboard");
const leaderboardEmpty = document.getElementById("leaderboardEmpty");
const scoringHint = document.getElementById("lbScoringHint");
const pagination = document.getElementById("pagination");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageNum = document.getElementById("pageNum");
const totalPages = document.getElementById("totalPages");
const loadMoreHistoryBtn = document.getElementById("loadMoreHistoryBtn");

const myRankSignedOut = document.getElementById("myRankSignedOut");
const myRankContent = document.getElementById("myRankContent");
const myRankAvatar = document.getElementById("myRankAvatar");
const myRankName = document.getElementById("myRankName");
const myRankEmail = document.getElementById("myRankEmail");
const myRankPosition = document.getElementById("myRankPosition");
const myRankScore = document.getElementById("myRankScore");
const myRankScoreLabel = document.getElementById("myRankScoreLabel");
const myRankContext = document.getElementById("myRankContext");
const myRankContextLabel = document.getElementById("myRankContextLabel");
const myRankHint = document.getElementById("myRankHint");
const shareMyRank = document.getElementById("lbShareMyRank");
const heroShare = document.getElementById("lbHeroShare");
let currentShareResult = null;

const recentHistorySignedOut = document.getElementById(
  "recentHistorySignedOut",
);
const recentHistoryList = document.getElementById("recentHistoryList");
const viewAllHistoryBtn = document.getElementById("viewAllHistoryBtn");

const adminPanel = document.getElementById("adminPanel");
const adminContext = document.getElementById("adminContext");
const resetBtn = document.getElementById("resetBtn");
const resetHint = document.getElementById("resetHint");

// =====================================================
// GENERAL HELPERS
// =====================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getScoringSystem() {
  return (
    document.querySelector('input[name="scoringSystem"]:checked')?.value ||
    "totalScore"
  );
}

function formatNumberOrDash(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "—";
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const seconds = Math.floor(safe);

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0",
    )}`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatDateTime(timestamp) {
  if (!Number.isFinite(Number(timestamp))) {
    return "—";
  }

  return new Date(Number(timestamp)).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function maskEmail(email) {
  const value = String(email || "").trim();

  if (!value.includes("@")) {
    return value || "Signed in";
  }

  const [local, domain] = value.split("@");

  if (!local) {
    return `***@${domain}`;
  }

  if (local.length === 1) {
    return `${local}***@${domain}`;
  }

  return `${local[0]}***${local.at(-1)}@${domain}`;
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function getGameName(record) {
  if (record?.gameName) {
    return record.gameName;
  }

  return state.gameMap.get(record?.gameId) || record?.gameId || "Unknown Game";
}

function hasLevel(record) {
  return (
    !(
      record?.levelId === null ||
      record?.levelId === undefined ||
      record?.levelId === ""
    ) || Boolean(record?.levelName)
  );
}

function getLevelKey(record) {
  return record?.levelId === null ||
    record?.levelId === undefined ||
    record?.levelId === ""
    ? "__no_level__"
    : String(record.levelId);
}

function getLevelDisplay(record) {
  if (record?.levelName) {
    return record.levelName;
  }

  if (
    record?.levelId === null ||
    record?.levelId === undefined ||
    record?.levelId === ""
  ) {
    return "—";
  }

  return `Level ${record.levelId}`;
}

function isBetterAttempt(candidate, current) {
  if (!current) return true;

  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }

  if (candidate.timePlayed !== current.timePlayed) {
    return candidate.timePlayed < current.timePlayed;
  }

  return candidate.timestamp > current.timestamp;
}

function getFilterRange(mode, pickedDate) {
  const base = pickedDate ? new Date(`${pickedDate}T00:00:00`) : new Date();
  const pickedStart = new Date(base).setHours(0, 0, 0, 0);

  if (mode === "allDates") {
    return {
      newStart: 0,
      newEnd: Date.now(),
    };
  }

  let newStart = 0;
  let newEnd = Date.now();

  switch (mode) {
    case "daily": {
      newStart = pickedStart;
      newEnd = pickedStart + 86400000 - 1;
      break;
    }

    case "weekly": {
      const day = base.getDay();
      const sunday = new Date(base);
      sunday.setDate(base.getDate() - day);
      newStart = sunday.setHours(0, 0, 0, 0);

      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      newEnd = saturday.setHours(23, 59, 59, 999);
      break;
    }

    case "monthly": {
      newStart = new Date(base.getFullYear(), base.getMonth(), 1).getTime();
      newEnd =
        new Date(base.getFullYear(), base.getMonth() + 1, 1).getTime() - 1;
      break;
    }
  }

  return { newStart, newEnd };
}

function updateRangeDisplay() {
  if (timeSelect.value === "allDates") {
    filterRangeDisplay.textContent = "Showing: All Time Records";
    return;
  }

  const { newStart, newEnd } = getFilterRange(
    timeSelect.value,
    seasonDate.value,
  );

  filterRangeDisplay.textContent = `Showing: ${new Date(
    newStart,
  ).toLocaleDateString()} — ${new Date(newEnd).toLocaleDateString()}`;
}

function filterRawDataByRange(rawData) {
  const { newStart, newEnd } = getFilterRange(
    timeSelect.value,
    seasonDate.value,
  );

  return rawData.filter(
    (record) =>
      Number.isFinite(record.timestamp) &&
      record.timestamp >= newStart &&
      record.timestamp <= newEnd,
  );
}

// =====================================================
// USER PROFILE
// =====================================================

async function getUserProfile(uid) {
  if (!uid) {
    return {
      name: "Unknown Player",
      location: "Unknown",
    };
  }

  if (state.profileCache.has(uid)) {
    return state.profileCache.get(uid);
  }

  const userDocRef = doc(db, "users", uid, "public", "profile");
  const userSnap = await getDoc(userDocRef);

  let profile = {
    name: "Unknown Player",
    location: "Unknown",
  };

  if (userSnap.exists()) {
    const data = userSnap.data();
    const locationParts = String(data.location || "").split(/[，,]/);

    profile = {
      name: data.name || "Unknown Player",
      location: locationParts[locationParts.length - 1]?.trim() || "Unknown",
    };
  }

  state.profileCache.set(uid, profile);

  return profile;
}

async function attachProfiles(rows) {
  return Promise.all(
    rows.map(async (row) => {
      const profile = await getUserProfile(row.uid);

      return {
        ...row,
        username: profile.name,
        location: profile.location,
      };
    }),
  );
}

// =====================================================
// GAME + LEVEL FILTERS
// =====================================================

async function loadGameOptions() {
  state.games = await getLeaderboardGames();
  state.gameMap = new Map(state.games.map((game) => [game.id, game.name]));

  const options = state.games.map(
    (game) =>
      `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`,
  );

  gameSelect.innerHTML = [
    '<option value="all">All Games</option>',
    ...options,
  ].join("");
}

async function getKnownLevelsForGame(gameId) {
  if (!gameId || gameId === "all") {
    return [];
  }

  if (state.levelOptionsCache.has(gameId)) {
    return state.levelOptionsCache.get(gameId);
  }

  const attempts = await getRawData(0, Date.now(), gameId);
  const levels = new Map();

  attempts.forEach((record) => {
    const key = getLevelKey(record);

    if (key === "__no_level__") {
      return;
    }

    if (!levels.has(key)) {
      levels.set(key, {
        id: String(record.levelId),
        name: getLevelDisplay(record),
      });
    }
  });

  const sortedLevels = [...levels.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  state.levelOptionsCache.set(gameId, sortedLevels);

  return sortedLevels;
}

async function refreshLevelOptions() {
  const selectedGame = gameSelect.value;

  if (!selectedGame || selectedGame === "all") {
    levelSelect.innerHTML = '<option value="all">All Levels</option>';
    levelSelect.value = "all";
    levelSelect.disabled = true;
    return;
  }

  const levels = await getKnownLevelsForGame(selectedGame);

  if (levels.length === 0) {
    levelSelect.innerHTML = '<option value="all">No Levels</option>';
    levelSelect.value = "all";
    levelSelect.disabled = true;
    return;
  }

  const previousValue = levelSelect.value;

  levelSelect.innerHTML = [
    '<option value="all">All Levels</option>',
    ...levels.map(
      (level) =>
        `<option value="${escapeHtml(level.id)}">${escapeHtml(
          level.name,
        )}</option>`,
    ),
  ].join("");

  levelSelect.disabled = false;

  if (levels.some((level) => level.id === previousValue)) {
    levelSelect.value = previousValue;
  } else {
    levelSelect.value = "all";
  }
}

// =====================================================
// DATA FETCHING
// =====================================================

function getSourceGameForCurrentView() {
  if (state.activeView === "overall") {
    return "Global";
  }

  return gameSelect.value === "all" ? "Global" : gameSelect.value;
}

async function fetchCurrentRawData() {
  const sourceGame = getSourceGameForCurrentView();
  const { newStart, newEnd } = getFilterRange(
    timeSelect.value,
    seasonDate.value,
  );

  if (state.activeView === "history" && newStart === 0) {
    await loadMoreHistoryMonths({ reset: true });
    return;
  }
  state.currentRawData = await getRawData(newStart, newEnd, sourceGame);
  if (sourceGame === "Global" && newStart === 0) {
    state.allTimeGlobalHistory = state.currentRawData;
  }
}

async function loadMoreHistoryMonths({ reset = false } = {}) {
  const sourceGame = gameSelect.value === "all" ? "Global" : gameSelect.value;
  if (reset || state.historySource !== sourceGame) {
    state.historySource = sourceGame;
    state.historyRecords = [];
    state.historyCursor = null;
    state.historyHasMore = true;
  }
  // Limit work per interaction: 3 monthly docs/query, maximum 3 queries.
  // A user with sparse activity can explicitly request older months.
  for (let i = 0; i < 3 && state.historyHasMore; i++) {
    const page = await getMonthlyHistoryPage(sourceGame, {
      cursor: state.historyCursor,
      pageSize: 3,
    });
    state.historyCursor = page.cursor;
    state.historyHasMore = page.hasMore;
    const known = new Set(state.historyRecords.map((record) => record.key));
    for (const record of page.records) {
      if (!known.has(record.key)) state.historyRecords.push(record);
    }
    if (
      getCurrentUserHistory(state.historyRecords).length >=
      state.currentPage * state.perPage + 1
    ) {
      break;
    }
  }
  state.currentRawData = state.historyRecords;
}

async function loadAllTimeGlobalHistory() {
  // This shares the cached fetch from the default Overall (all-time) view,
  // rather than fetching the same global history twice on page load.
  if (!state.allTimeGlobalHistory.length) {
    state.allTimeGlobalHistory = await getRawData(0, Date.now(), "Global");
  }
}

// =====================================================
// OVERALL LEADERBOARD
// =====================================================

async function generateOverallLeaderboard(rawData) {
  const scoringSystem = getScoringSystem();
  const players = new Map();

  filterRawDataByRange(rawData).forEach((record) => {
    if (!record.uid || !record.gameId || record.gameId === "legacy") {
      return;
    }

    const score = Number(record.score);
    const timePlayed = Number(record.timePlayed) || 0;

    if (!Number.isFinite(score)) {
      return;
    }

    if (!players.has(record.uid)) {
      players.set(record.uid, {
        uid: record.uid,
        totalTimePlayed: 0,
        latestTimestamp: record.timestamp,
        bestByGameLevel: new Map(),
      });
    }

    const player = players.get(record.uid);

    player.totalTimePlayed += timePlayed;
    player.latestTimestamp = Math.max(player.latestTimestamp, record.timestamp);

    /*
    OVERALL MULTI-LEVEL RULE

    1. Keep only the player's best attempt for each distinct
       Game + Level combination.
    2. For each game, average those distinct level-best scores.
    3. Round that game contribution to the nearest whole number.
    4. Sum the per-game contributions for the player's Overall Score.

    A game without levels still has just one "__no_level__" bucket,
    so its contribution remains its single best score.

    If a game has real level-tagged attempts, an older untagged attempt
    is ignored for that game's Overall average rather than being treated
    as an extra fake level.
    */
    const levelKey = getLevelKey(record);
    const playerGameLevelKey = `${record.gameId}::${levelKey}`;
    const previousBest = player.bestByGameLevel.get(playerGameLevelKey);

    const candidate = {
      gameId: record.gameId,
      levelKey,
      score,
      timePlayed,
      timestamp: record.timestamp,
    };

    if (isBetterAttempt(candidate, previousBest)) {
      player.bestByGameLevel.set(playerGameLevelKey, candidate);
    }
  });

  let rows = [...players.values()]
    .map((player) => {
      const attemptsByGame = new Map();

      [...player.bestByGameLevel.values()].forEach((attempt) => {
        if (!attemptsByGame.has(attempt.gameId)) {
          attemptsByGame.set(attempt.gameId, []);
        }

        attemptsByGame.get(attempt.gameId).push(attempt);
      });

      const gameContributions = [];

      attemptsByGame.forEach((attempts, gameId) => {
        const taggedLevels = attempts.filter(
          (attempt) => attempt.levelKey !== "__no_level__",
        );

        const attemptsToAverage =
          taggedLevels.length > 0 ? taggedLevels : attempts;

        if (attemptsToAverage.length === 0) {
          return;
        }

        const scoreAverage =
          attemptsToAverage.reduce((sum, attempt) => sum + attempt.score, 0) /
          attemptsToAverage.length;

        const contributionScore = Math.round(scoreAverage);
        const contributionTime = attemptsToAverage.reduce(
          (sum, attempt) => sum + attempt.timePlayed,
          0,
        );

        const latestTimestamp = Math.max(
          ...attemptsToAverage.map((attempt) => attempt.timestamp),
        );

        gameContributions.push({
          gameId,
          score: contributionScore,
          timePlayed: contributionTime,
          latestTimestamp,
          levelsCount: attemptsToAverage.length,
        });
      });

      if (gameContributions.length === 0) {
        return null;
      }

      const totalScore = gameContributions.reduce(
        (sum, game) => sum + game.score,
        0,
      );

      const bestTimePlayed = gameContributions.reduce(
        (sum, game) => sum + game.timePlayed,
        0,
      );

      return {
        uid: player.uid,
        totalScore,
        totalTimePlayed: player.totalTimePlayed,
        totalTimePlayedDisplay: formatSeconds(player.totalTimePlayed),
        bestTimePlayed,
        bestTimePlayedDisplay: formatSeconds(bestTimePlayed),
        latestTimestamp: player.latestTimestamp,
        gamesCount: gameContributions.length,
        gameContributions,
      };
    })
    .filter(Boolean);

  rows.sort((a, b) => {
    if (scoringSystem === "totalTimePlayed") {
      if (b.totalTimePlayed !== a.totalTimePlayed) {
        return b.totalTimePlayed - a.totalTimePlayed;
      }
    } else if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }

    if (a.bestTimePlayed !== b.bestTimePlayed) {
      return a.bestTimePlayed - b.bestTimePlayed;
    }

    return b.latestTimestamp - a.latestTimestamp;
  });

  rows = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  return rows;
}

// =====================================================
// GAME + LEVEL LEADERBOARD
// =====================================================

async function generateGameLeaderboard(rawData) {
  return rankGamePlayers(filterRawDataByRange(rawData), {
    selectedGame: gameSelect.value,
    selectedLevel: levelSelect.value,
    scoringSystem: getScoringSystem(),
  }).map((row) => ({
    ...row,
    gameName: state.gameMap.get(row.gameId) || row.gameName,
    timeDisplay: formatSeconds(
      getScoringSystem() === "totalTimePlayed"
        ? row.totalTimePlayed
        : row.bestTimePlayed,
    ),
  }));
}

// =====================================================
// PERSONAL HISTORY
// =====================================================

function getCurrentUserHistory(rawData) {
  if (!state.currentUser) {
    return [];
  }

  const selectedGame = gameSelect.value;
  const selectedLevel = levelSelect.value;

  return filterRawDataByRange(rawData)
    .filter((record) => record.uid === state.currentUser.uid)
    .filter((record) => {
      if (selectedGame === "all") return true;
      return record.gameId === selectedGame;
    })
    .filter((record) => {
      if (selectedGame === "all" || selectedLevel === "all") return true;
      return getLevelKey(record) === selectedLevel;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getRecentUserHistory() {
  if (!state.currentUser) {
    return [];
  }

  return state.allTimeGlobalHistory
    .filter((record) => record.uid === state.currentUser.uid)
    .filter((record) => record.gameId && record.gameId !== "legacy")
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6);
}

// =====================================================
// VIEW + TABLE CONFIGURATION
// =====================================================

function setTableHeader(view) {
  leaderboardTableHeader.className = "leaderboard-table-header";
  leaderboardTableHeader.hidden = view === "game";

  if (view === "overall") {
    leaderboardTableHeader.classList.add("leaderboard-table-header-overall");
    leaderboardTableHeader.innerHTML = `
      <div>Rank</div>
      <div>Player</div>
      <div>Overall Score</div>
      <div>Ranked Games</div>
      <div>Time</div>
    `;
    return;
  }

  if (view === "game") {
    leaderboardTableHeader.classList.add(
      "leaderboard-table-header-game-players",
    );
    const label =
      levelSelect.value === "all" ? "Cumulative Points" : "Best Score / 100";
    leaderboardTableHeader.innerHTML = `
      <div>Rank</div><div>Player</div>
      <div>${label}</div><div>Time</div><div>Details</div>
    `;
    return;
  }

  leaderboardTableHeader.classList.add("leaderboard-table-header-history");
  leaderboardTableHeader.innerHTML = `
    <div>Date</div>
    <div>Game</div>
    <div>Level</div>
    <div>Score</div>
    <div>Time</div>
    <div>Result</div>
  `;
}

function updateDatePickerState() {
  const isAllTime = timeSelect.value === "allDates";

  seasonDate.disabled = isAllTime;
  seasonDate.setAttribute("aria-disabled", String(isAllTime));
  seasonDate.title = isAllTime
    ? "Choose Date is not used when Time Period is All Time."
    : "";
}

function updateViewControls() {
  updateDatePickerState();

  document.querySelectorAll(".lb-view-tab:not(.gg-referral-tab)").forEach((button) => {
    const referralVisible = document.getElementById('lbReferralView')?.hidden === false;
    const isActive = !referralVisible && button.dataset.view === state.activeView;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const isOverall = state.activeView === "overall";
  const isHistory = state.activeView === "history";

  gameSelect.disabled = isOverall;

  if (isOverall) {
    gameSelect.value = "all";
    levelSelect.value = "all";
    levelSelect.disabled = true;
    filterTitle.textContent = "Overall Leaderboard";
    rankingTitle.textContent = "Hall of Champions";
  } else if (state.activeView === "game") {
    filterTitle.textContent = "Game Leaderboard";
  } else {
    filterTitle.textContent = "My Game History";
  }

  scoringField.hidden = isHistory;
  rankingSection.hidden = !isOverall;

  setTableHeader(state.activeView);
  scoringHint.hidden = state.activeView !== "game";
  scoringHint.textContent =
    levelSelect.value === "all"
      ? "Cumulative points = sum of each player's best score for every completed level in the game. Expand a game, then tap View Shlokas to inspect scores and attempts."
      : "Selected level: rankings show each player's best score out of 100. Tap View Shlokas to inspect attempts.";
}

function getPodiumRows() {
  if (state.activeView !== "overall") {
    return [];
  }

  return state.leaderboardData.slice(0, 3);
}

// =====================================================
// RENDER PODIUM
// =====================================================

function renderPodium() {
  rankingSection.hidden = state.activeView !== "overall";

  if (rankingSection.hidden) {
    return;
  }

  const podiumRows = getPodiumRows();
  rankingTitle.textContent = "Hall of Champions";

  for (let i = 0; i < 3; i++) {
    const player = podiumRows[i];

    const username = document.getElementById(`name-${i + 1}`);
    const location = document.getElementById(`location-${i + 1}`);
    const score = document.getElementById(`score-${i + 1}`);

    username.textContent = player ? player.username : "---";
    location.textContent = player ? `📍 ${player.location}` : "---";

    if (!player) {
      score.textContent = "---";
      continue;
    }

    if (getScoringSystem() === "totalTimePlayed") {
      score.textContent = formatSeconds(player.totalTimePlayed);
    } else if (state.activeView === "overall") {
      score.textContent = player.totalScore.toLocaleString();
    } else {
      score.textContent = player.bestScore.toLocaleString();
    }
  }
}

// =====================================================
// RENDER MAIN TABLE
// =====================================================

function renderOverallRows(rows) {
  return rows
    .map(
      (row) => `
        <div class="row row-overall">
          <div class="rank">${row.rank}</div>

          <div class="player-cell">
            <strong>${escapeHtml(row.username)}</strong>
            <span>📍 ${escapeHtml(row.location)}</span>
          </div>

          <div class="score">${formatNumberOrDash(row.totalScore)}</div>

          <div class="games-count">${row.gamesCount}</div>

          <div class="time">${escapeHtml(
            getScoringSystem() === "totalTimePlayed"
              ? row.totalTimePlayedDisplay
              : row.bestTimePlayedDisplay,
          )}</div>
        </div>
      `,
    )
    .join("");
}

function playerGameKey(row) {
  return `${row.gameId}::${row.uid}`;
}

function levelRecordKey(row, level) {
  return `${playerGameKey(row)}::${level.levelKey}`;
}

function getShlokaName(level) {
  return (
    level.levelName ||
    (level.levelId == null ? "Game" : `Level ${level.levelId}`)
  );
}

function renderPlayerHistory(row) {
  const key = playerGameKey(row);
  const count = state.shlokaVisible.get(key) || 8;
  const visibleLevels = row.levels.slice(0, count);
  return `
    <div class="lb-player-history" id="history-${escapeHtml(encodeURIComponent(key))}">
      <div class="lb-player-history-title">
        <strong>Best scores by Shloka</strong>
        <span>${row.levelsCount} ${row.levelsCount === 1 ? "level" : "levels"} · ${row.attemptsCount} attempts</span>
      </div>
      ${visibleLevels
        .map((level) => {
          const id = levelRecordKey(row, level);
          const limit = state.attemptsVisible.get(id) || 5;
          return `
          <details class="lb-level-detail" data-open-level="${escapeHtml(id)}" ${state.openLevels.has(id) ? "open" : ""}>
            <summary>
              <span class="lb-level-name">${escapeHtml(getShlokaName(level))}
                <small>${level.attempts.length} ${level.attempts.length === 1 ? "attempt" : "attempts"}</small>
              </span>
              <span class="lb-level-best">${formatNumberOrDash(level.bestScore)} / 100</span>
              <span aria-hidden="true" class="lb-detail-chevron">⌄</span>
            </summary>
            <div class="lb-attempt-list">
              ${level.attempts
                .slice(0, limit)
                .map(
                  (attempt) => `
                <div class="lb-attempt-line">
                  <span>${escapeHtml(formatDateTime(attempt.timestamp))}</span>
                  <strong>${formatNumberOrDash(attempt.score)} / 100</strong>
                  <span>${escapeHtml(formatSeconds(attempt.timePlayed))}</span>
                </div>
              `,
                )
                .join("")}
              ${
                level.attempts.length > limit
                  ? `
                <button type="button" class="lb-more-link" data-action="more-attempts"
                  data-game="${escapeHtml(row.gameId)}" data-uid="${escapeHtml(row.uid)}"
                  data-level="${escapeHtml(level.levelKey)}">Show more attempts</button>
              `
                  : ""
              }
            </div>
          </details>
        `;
        })
        .join("")}
      ${
        row.levels.length > count
          ? `<button type="button" class="lb-more-link"
        data-action="more-levels" data-game="${escapeHtml(row.gameId)}"
        data-uid="${escapeHtml(row.uid)}">Show more Shlokas (${row.levels.length - count} remaining)</button>`
          : ""
      }
    </div>
  `;
}

function renderGameRows(rows) {
  return rows
    .map((row) => {
      const key = playerGameKey(row);
      const expanded = state.expandedRows.has(key);
      const score =
        levelSelect.value === "all" ? row.cumulativeScore : row.bestScore;
      return `
      <article class="lb-game-player" data-player-key="${escapeHtml(key)}">
        <div class="row row-game-player">
          <div class="rank" data-label="Rank">${row.rank}</div>
          <div class="player-cell">
            <strong>${escapeHtml(row.username || "Player")}</strong>
            <span>📍 ${escapeHtml(row.location || "Unknown")} · ${row.levelsCount} ${row.levelsCount === 1 ? "level" : "levels"}</span>
          </div>
          <div class="lb-game-player-score" data-label="${levelSelect.value === "all" ? "Cumulative" : "Best"}">
            <strong>${formatNumberOrDash(score)}</strong>
            <span>${levelSelect.value === "all" ? "Cumulative points" : "Best score / 100"}</span>
          </div>
          <div class="time" data-label="Time">${escapeHtml(row.timeDisplay)}</div>
          <button class="lb-player-expand" type="button" data-action="toggle-player"
            data-game="${escapeHtml(row.gameId)}" data-uid="${escapeHtml(row.uid)}"
            aria-expanded="${expanded}" aria-controls="history-${escapeHtml(encodeURIComponent(key))}">
            ${expanded ? "Hide history" : "View Shlokas"}<span aria-hidden="true"> ${expanded ? "⌃" : "⌄"}</span>
          </button>
        </div>
        ${expanded ? renderPlayerHistory(row) : ""}
      </article>
    `;
    })
    .join("");
}

// Games, not player rows, are the top-level units when All Games is chosen.
// Only the expanded game's current page is rendered, and only those players'
// profiles are loaded. No extra Firestore queries are needed for toggling.
function renderGameAccordions(groups) {
  return groups
    .map((group, index) => {
      const expanded = group.gameId === state.openGameId;
      const panelId = `lb-game-panel-${index}`;
      const page = expanded
        ? pageGamePlayers(group.players, state.gamePage, state.perPage)
        : null;
      const label = levelSelect.value === "all"
        ? "Cumulative Points" : "Best Score / 100";
      return `
        <section class="lb-game-accordion${expanded ? " is-open" : ""}">
          <h3 class="lb-game-accordion-heading">
            <button type="button" class="lb-game-toggle" data-action="toggle-game"
              data-game="${escapeHtml(group.gameId)}"
              aria-expanded="${expanded}" aria-controls="${panelId}">
              <span class="lb-game-group-icon" aria-hidden="true">🎮</span>
              <span class="lb-game-accordion-label">
                <strong>${escapeHtml(group.gameName)}</strong>
                <small>${group.players.length} ranked ${group.players.length === 1 ? "player" : "players"}</small>
              </span>
              <span class="lb-game-accordion-chevron" aria-hidden="true">⌄</span>
            </button>
          </h3>
          ${expanded ? `
            <div class="lb-game-accordion-panel" id="${panelId}">
              <div class="lb-game-accordion-columns" aria-hidden="true">
                <span>Rank</span><span>Player</span><span>${label}</span><span>Time</span><span>Details</span>
              </div>
              ${renderGameRows(page.rows)}
              ${page.totalPages > 1 ? `
                <nav class="lb-game-accordion-pagination" aria-label="${escapeHtml(group.gameName)} player rankings pages">
                  <button type="button" data-action="game-previous" ${page.page === 1 ? "disabled" : ""}>← Previous</button>
                  <span>Page ${page.page} of ${page.totalPages}</span>
                  <button type="button" data-action="game-next" ${page.page === page.totalPages ? "disabled" : ""}>Next →</button>
                </nav>` : ""}
            </div>` : `<div class="lb-game-accordion-panel" id="${panelId}" hidden></div>`}
        </section>`;
    })
    .join("");
}

function renderHistoryRows(rows) {
  return rows
    .map(
      (row) => `
        <div class="row row-history">
          <div class="history-date">${escapeHtml(formatDateTime(row.timestamp))}</div>

          <div class="game-name">${escapeHtml(getGameName(row))}</div>

          <div class="level-name">${escapeHtml(getLevelDisplay(row))}</div>

          <div class="score">${formatNumberOrDash(row.score)}</div>

          <div class="time">${escapeHtml(formatSeconds(row.timePlayed))}</div>

          <div class="result">
            <span class="lb-result-badge">${escapeHtml(
              row.meta?.result || "completed",
            )}</span>
          </div>
        </div>
      `,
    )
    .join("");
}

async function renderTable() {
  const token = ++state.renderToken;
  if (state.activeView === "game") {
    const groups = groupRankedGames(state.leaderboardData);
    const openedGroup = groups.find((group) => group.gameId === state.openGameId);
    const page = openedGroup
      ? pageGamePlayers(openedGroup.players, state.gamePage, state.perPage)
      : null;
    if (page) {
      state.gamePage = page.page;
      // An unopened accordion never triggers a player-profile read.
      await Promise.all(page.rows.map(async (row) => {
        const profile = await getUserProfile(row.uid);
        row.username = profile.name;
        row.location = profile.location;
      }));
    }
    if (token !== state.renderToken) return;
    leaderboardEmpty.hidden = groups.length > 0;
    leaderboard.innerHTML = renderGameAccordions(groups);
    pagination.hidden = true; // Player paging is inside the opened game.
    loadMoreHistoryBtn.hidden = true;
    return;
  }
  const data = state.leaderboardData;
  const total = data.length;
  const totalPageCount = Math.max(1, Math.ceil(total / state.perPage));
  if (state.currentPage > totalPageCount) state.currentPage = totalPageCount;
  const start = (state.currentPage - 1) * state.perPage;
  const pageRows = data.slice(start, start + state.perPage);

  // Profile reads are limited to the page on screen, not every ranked player.
  if (state.activeView !== "history") {
    const visible = new Map(pageRows.map((row) => [row.uid, row]));
    if (state.activeView === "overall") {
      data.slice(0, 3).forEach((row) => visible.set(row.uid, row));
    }
    await Promise.all(
      [...visible.values()].map(async (row) => {
        const profile = await getUserProfile(row.uid);
        row.username = profile.name;
        row.location = profile.location;
      }),
    );
  }
  if (token !== state.renderToken) return;
  leaderboardEmpty.hidden = total > 0;
  if (state.activeView === "overall") {
    leaderboard.innerHTML = renderOverallRows(pageRows);
    renderPodium();
  } else {
    leaderboard.innerHTML = renderHistoryRows(pageRows);
  }

  const hasRemoteHistory =
    state.activeView === "history" &&
    timeSelect.value === "allDates" &&
    state.historyHasMore;
  pageNum.textContent = String(state.currentPage);
  totalPages.textContent = `${totalPageCount}${hasRemoteHistory ? "+" : ""}`;
  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= totalPageCount && !hasRemoteHistory;
  pagination.hidden = total <= state.perPage && !hasRemoteHistory;
  loadMoreHistoryBtn.hidden = !hasRemoteHistory;
}

// =====================================================
// MY RANK
// =====================================================

function renderSignedOutRank() {
  currentShareResult = null;
  [shareMyRank, heroShare].forEach((button) => {
    if (button) {
      button.hidden = true;
      button.disabled = true;
    }
  });
  myRankSignedOut.hidden = false;
  myRankContent.hidden = true;
}

async function renderMyRank() {
  if (!state.currentUser) {
    renderSignedOutRank();
    return;
  }

  const profile = await getUserProfile(state.currentUser.uid);

  myRankSignedOut.hidden = true;
  myRankContent.hidden = false;

  myRankAvatar.textContent = getInitials(profile.name);
  myRankName.textContent = profile.name;
  myRankEmail.textContent = maskEmail(state.currentUser.email);

  let row = null;
  let contextValue = "—";
  let contextLabel = "Ranked Games";
  let scoreLabel = "Overall Score";
  let hint = "";
  let usingOverallRank = false;

  if (state.activeView === "game" && gameSelect.value !== "all") {
    row =
      state.leaderboardData.find(
        (item) => item.uid === state.currentUser.uid,
      ) || null;
    contextValue = row ? row.levelsCount : "—";
    contextLabel = levelSelect.value === "all" ? "Levels" : "Level";
    if (levelSelect.value !== "all") {
      contextValue =
        levelSelect.options[levelSelect.selectedIndex]?.text || "—";
      scoreLabel = "Best Score / 100";
    } else {
      scoreLabel = "Cumulative Points";
    }
    hint =
      levelSelect.value === "all"
        ? "Your cumulative points count only the best attempt for each Shloka."
        : "Showing your rank for this specific level.";
  } else if (state.activeView === "history") {
    await loadAllTimeGlobalHistory();
    const overallRows = await generateOverallLeaderboard(
      state.allTimeGlobalHistory,
    );
    row =
      overallRows.find((item) => item.uid === state.currentUser.uid) || null;
    contextValue = row?.gamesCount ?? "—";
    hint =
      "History includes repeat attempts; your Overall rank uses best scores.";
    usingOverallRank = true;
  } else {
    usingOverallRank = true;
    const overallRows =
      state.activeView === "overall"
        ? state.leaderboardData
        : await generateOverallLeaderboard(state.currentRawData);
    row =
      overallRows.find((item) => item.uid === state.currentUser.uid) || null;
    contextValue = row?.gamesCount ?? "—";
    if (state.activeView === "game") {
      hint =
        "Showing your Overall rank. Choose a game to see cumulative game points.";
    }
  }

  if (!row) {
    myRankPosition.textContent = "—";
    myRankScore.textContent = "—";
  } else {
    myRankPosition.textContent = String(row.rank);

    if (
      getScoringSystem() === "totalTimePlayed" &&
      state.activeView !== "history"
    ) {
      myRankScore.textContent = Number.isFinite(Number(row.totalTimePlayed))
        ? formatSeconds(row.totalTimePlayed)
        : "—";
      scoreLabel = "Time Played";
    } else {
      const scoreValue = usingOverallRank
        ? row.totalScore
        : row.cumulativeScore;
      myRankScore.textContent = formatNumberOrDash(scoreValue);
    }
  }

  myRankScoreLabel.textContent = scoreLabel;
  myRankContext.textContent =
    contextValue === null || contextValue === undefined || contextValue === ""
      ? "—"
      : String(contextValue);
  myRankContextLabel.textContent = contextLabel;
  myRankHint.textContent = hint;
  // Only share authenticated player's actual ranking data already loaded here.
  // A time-based rank is not advertised as a score-based rank.
  const isGame = state.activeView === "game" && gameSelect.value !== "all";
  const isLevel = isGame && levelSelect.value !== "all";
  currentShareResult =
    row &&
    Number.isFinite(
      Number(
        isGame
          ? isLevel
            ? row.bestScore
            : row.cumulativeScore
          : row.totalScore,
      ),
    )
      ? {
          score: isGame
            ? isLevel
              ? row.bestScore
              : row.cumulativeScore
            : row.totalScore,
          scoreType: isGame ? (isLevel ? "game" : "cumulative") : "overall",
          gameId: isGame ? row.gameId : "",
          gameName: isGame ? row.gameName : "Overall Leaderboard",
          levelName: isLevel
            ? levelSelect.options[levelSelect.selectedIndex]?.text
            : "",
          rank: getScoringSystem() === "totalTimePlayed" ? undefined : row.rank,
          levels: isGame && !isLevel ? row.levelsCount : undefined,
          playerName: profile.name,
        }
      : null;
  [shareMyRank, heroShare].forEach((button) => {
    if (!button) return;
    button.disabled = !currentShareResult;
    button.hidden = !currentShareResult;
    button.textContent = isGame
      ? "✦ Share My Game Score"
      : "✦ Share My Achievement";
  });
}

// =====================================================
// RECENT HISTORY SIDEBAR
// =====================================================

function renderRecentHistory() {
  if (!state.currentUser) {
    recentHistorySignedOut.hidden = false;
    recentHistoryList.innerHTML = "";
    return;
  }

  recentHistorySignedOut.hidden = true;

  const attempts = getRecentUserHistory();

  if (attempts.length === 0) {
    recentHistoryList.innerHTML = `
      <div class="lb-history-empty">
        No saved game attempts yet.
      </div>
    `;
    return;
  }

  recentHistoryList.innerHTML = attempts
    .map(
      (attempt) => `
        <article class="lb-history-preview-item">
          <div class="lb-history-preview-copy">
            <strong>${escapeHtml(getGameName(attempt))}</strong>
            ${
              hasLevel(attempt)
                ? `<span>${escapeHtml(getLevelDisplay(attempt))}</span>`
                : ""
            }
            <small>${escapeHtml(formatDateTime(attempt.timestamp))}</small>
          </div>

          <div class="lb-history-preview-score">
            ${formatNumberOrDash(attempt.score)}
          </div>
        </article>
      `,
    )
    .join("");
}

// =====================================================
// ADMIN CONTROLS
// =====================================================

function getSelectedAdminGame() {
  if (state.activeView === "overall" || gameSelect.value === "all") {
    return null;
  }

  return gameSelect.value;
}

function syncAdminControls() {
  const gameId = getSelectedAdminGame();

  if (!gameId) {
    resetBtn.disabled = true;
    adminContext.textContent = "Select one game to reset its leaderboard.";
    resetHint.textContent = "";
    return;
  }

  resetBtn.disabled = false;

  const gameName = state.gameMap.get(gameId) || gameId;
  adminContext.textContent = `Managing: ${gameName}`;

  resetHint.textContent = "";
}

// Reset is a privileged, deliberate admin operation. Remove the game's
// monthly docs AND its matching Global entries in the same batched write.
// Earlier versions deleted only game data, leaving stale Global ranks.
async function performReset(gameId) {
  const gameName = state.gameMap.get(gameId) || gameId;
  if (
    !confirm(
      `Delete ALL recorded scores for ${gameName}, including Global rankings? This cannot be undone.`,
    )
  )
    return;

  resetBtn.disabled = true;
  try {
    const historyColRef = collection(db, "leaderboards", gameId, "gameHistory");
    const historySnapshot = await getDocs(historyColRef);
    if (historySnapshot.empty) {
      alert(`Score histories for ${gameName} are already empty.`);
      return;
    }

    const months = historySnapshot.docs;
    let clearedGlobalEntries = 0;
    // Small batches avoid Firestore rules' per-batch document-access budget.
    for (let offset = 0; offset < months.length; offset += 4) {
      const group = months.slice(offset, offset + 4);
      const globalMonths = await Promise.all(
        group.map((history) =>
          getDoc(doc(db, "leaderboards", "Global", "gameHistory", history.id)),
        ),
      );
      const batch = writeBatch(db);
      group.forEach((history, index) => {
        batch.delete(history.ref);
        const globalSnap = globalMonths[index];
        if (!globalSnap.exists()) return;
        const globalData = globalSnap.data();
        const updates = ["updatedAt", serverTimestamp()];
        for (const key of Object.keys(globalData.entries || {})) {
          const meta = globalData.attemptMeta?.[key];
          const keyGame = key.split("_").slice(3).join("_");
          if (meta?.gameId !== gameId && keyGame !== gameId) continue;
          // Use FieldPath so unusual auth UIDs cannot break nested map keys.
          updates.push(new FieldPath("entries", key), deleteField());
          updates.push(new FieldPath("attemptMeta", key), deleteField());
          clearedGlobalEntries++;
        }
        if (updates.length > 2) batch.update(globalSnap.ref, ...updates);
      });
      await batch.commit();
    }

    invalidateLeaderboardCache(gameId);
    state.allTimeGlobalHistory = [];
    state.levelOptionsCache.delete(gameId);
    await refreshLevelOptions();
    await refreshData();
    await loadAllTimeGlobalHistory();
    renderRecentHistory();
    alert(
      `Reset complete: ${gameName} histories deleted and ${clearedGlobalEntries} matching Global entries removed.`,
    );
  } catch (error) {
    console.error("Reset failed:", error);
    alert(
      "Unable to complete reset. Some months may have changed; please review the affected rankings before retrying.",
    );
  } finally {
    resetBtn.disabled = false;
  }
}

// =====================================================
// MAIN REFRESH
// =====================================================

async function refreshData() {
  state.expandedRows.clear();
  state.shlokaVisible.clear();
  state.attemptsVisible.clear();
  state.openLevels.clear();
  updateViewControls();
  updateRangeDisplay();

  await fetchCurrentRawData();

  if (state.activeView === "overall") {
    state.leaderboardData = await generateOverallLeaderboard(
      state.currentRawData,
    );
  } else if (state.activeView === "game") {
    state.leaderboardData = await generateGameLeaderboard(state.currentRawData);
  } else {
    state.leaderboardData = getCurrentUserHistory(state.currentRawData);
  }

  state.currentPage = 1;
  state.gamePage = 1;

  await renderTable();
  await renderMyRank();
  renderRecentHistory();
  await syncAdminControls();
}

// =====================================================
// EVENTS
// =====================================================

let gameOptionsInitialized = false;

document
  .querySelectorAll(".lb-view-tab:not(.gg-referral-tab)")
  .forEach((button) => {
    button.addEventListener("click", async () => {
      const nextView = button.dataset.view || "overall";

      if (nextView === "game" && state.activeView !== "game") {
        state.openGameId =
          gameSelect.value === "all" ? null : gameSelect.value;

        state.gamePage = 1;
      }

      state.activeView = nextView;

      if (!gameOptionsInitialized) {
        await loadGameOptions();
        gameOptionsInitialized = true;
      }

      if (state.activeView === "overall") {
        gameSelect.value = "all";
        levelSelect.value = "all";
      } else {
        gameSelect.disabled = false;
        await refreshLevelOptions();
      }

      await refreshData();
    });
  });

gameSelect.addEventListener("change", async () => {
  state.openGameId = gameSelect.value === "all" ? null : gameSelect.value;
  state.gamePage = 1;
  await refreshLevelOptions();
  await refreshData();
});

levelSelect.addEventListener("change", async () => {
  await refreshData();
});

seasonDate.addEventListener("input", async () => {
  await refreshData();
});

timeSelect.addEventListener("change", async () => {
  await refreshData();
});

document.getElementById("scoring").addEventListener("change", async () => {
  if (state.activeView === "overall") {
    state.leaderboardData = await generateOverallLeaderboard(
      state.currentRawData,
    );
  } else if (state.activeView === "game") {
    state.leaderboardData = await generateGameLeaderboard(state.currentRawData);
  }

  state.currentPage = 1;
  state.gamePage = 1;

  await renderTable();
  await renderMyRank();
});

prevBtn.addEventListener("click", () => {
  if (state.currentPage <= 1) return;

  state.currentPage -= 1;
  void renderTable();
});

nextBtn.addEventListener("click", async () => {
  const totalPageCount = Math.max(
    1,
    Math.ceil(state.leaderboardData.length / state.perPage),
  );

  if (state.currentPage >= totalPageCount) {
    if (
      state.activeView === "history" &&
      timeSelect.value === "allDates" &&
      state.historyHasMore
    ) {
      await loadMoreHistoryMonths();
      state.leaderboardData = getCurrentUserHistory(state.historyRecords);
      if (state.leaderboardData.length <= state.currentPage * state.perPage) {
        await renderTable();
        return;
      }
    } else return;
  }
  state.currentPage += 1;
  await renderTable();
});

leaderboard.addEventListener(
  "toggle",
  (event) => {
    const detail = event.target;
    if (!(detail instanceof HTMLDetailsElement) || !detail.dataset.openLevel)
      return;
    if (detail.open) state.openLevels.add(detail.dataset.openLevel);
    else state.openLevels.delete(detail.dataset.openLevel);
  },
  true,
);

leaderboard.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "toggle-game") {
    state.openGameId = state.openGameId === button.dataset.game
      ? null : button.dataset.game;
    state.gamePage = 1;
    state.expandedRows.clear();
    state.openLevels.clear();
    const gameId = button.dataset.game;
    void renderTable().then(() => {
      // Keep keyboard focus on the accordion trigger after rerendering.
      [...leaderboard.querySelectorAll('button[data-action="toggle-game"]')]
        .find((trigger) => trigger.dataset.game === gameId)?.focus({ preventScroll: true });
    });
    return;
  }
  if (button.dataset.action === "game-previous" || button.dataset.action === "game-next") {
    state.gamePage += button.dataset.action === "game-next" ? 1 : -1;
    state.expandedRows.clear();
    state.openLevels.clear();
    void renderTable();
    return;
  }
  const key = `${button.dataset.game}::${button.dataset.uid}`;
  if (button.dataset.action === "toggle-player") {
    if (state.expandedRows.has(key)) state.expandedRows.delete(key);
    else state.expandedRows.add(key);
  } else if (button.dataset.action === "more-levels") {
    state.shlokaVisible.set(key, (state.shlokaVisible.get(key) || 8) + 8);
  } else if (button.dataset.action === "more-attempts") {
    const id = `${key}::${button.dataset.level}`;
    state.attemptsVisible.set(id, (state.attemptsVisible.get(id) || 5) + 10);
  }
  void renderTable();
});

loadMoreHistoryBtn.addEventListener("click", async () => {
  if (state.activeView !== "history" || !state.historyHasMore) return;
  loadMoreHistoryBtn.disabled = true;
  try {
    await loadMoreHistoryMonths();
    state.leaderboardData = getCurrentUserHistory(state.historyRecords);
    await renderTable();
  } finally {
    loadMoreHistoryBtn.disabled = false;
  }
});

viewAllHistoryBtn.addEventListener("click", async () => {
  state.activeView = "history";

  document.querySelectorAll(".lb-view-tab").forEach((button) => {
    const isActive = button.dataset.view === "history";

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  await refreshLevelOptions();
  await refreshData();
});

[shareMyRank, heroShare].forEach((button) =>
  button?.addEventListener("click", () => {
    if (currentShareResult) openScoreShare(currentShareResult);
  }),
);

resetBtn.addEventListener("click", async () => {
  const gameId = getSelectedAdminGame();

  if (!gameId) return;

  await performReset(gameId);
});

// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async (user) => {
  state.currentUser = user || null;

  let isAdmin = false;

  if (user) {
    try {
      const userDocRef = doc(db, "users", user.uid, "private", "account");
      const userSnap = await getDoc(userDocRef);

      isAdmin = userSnap.exists() && userSnap.data().isAdmin === true;
    } catch (error) {
      console.error("Unable to get user role:", error);
    }
  }

  adminPanel.style.display = isAdmin ? "block" : "none";

  await renderMyRank();
  renderRecentHistory();

  if (state.activeView === "history") {
    state.leaderboardData = getCurrentUserHistory(state.currentRawData);
    state.currentPage = 1;
    void renderTable();
  }
});

// =====================================================
// SPARKLE PARTICLE SYSTEM
// =====================================================

const canvas = document.getElementById("sparkleCanvas");
const ctx = canvas.getContext("2d");

let particles = [];
let hoveredCard = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = Math.random() * 6 + 1;
    this.speedX = (Math.random() - 0.5) * 3;
    this.speedY = (Math.random() - 0.5) * 3;
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.01;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.2;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.alpha -= this.decay;
    this.angle += this.spin;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color || "#3B82F6";
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

[1, 2, 3].forEach((rank) => {
  const element = document.getElementById(`card-${rank}`);

  if (!element) return;

  element.addEventListener("mouseenter", () => {
    hoveredCard = element;
  });

  element.addEventListener("mouseleave", () => {
    hoveredCard = null;
  });
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (hoveredCard) {
    const rect = hoveredCard.getBoundingClientRect();
    const color = hoveredCard.getAttribute("data-color");

    for (let i = 0; i < 2; i++) {
      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + Math.random() * rect.height;

      particles.push(new Particle(x, y, color));
    }
  }

  particles = particles.filter((particle) => {
    particle.update();
    particle.draw();

    return particle.alpha > 0;
  });

  requestAnimationFrame(animate);
}

// =====================================================
// INITIALIZE
// =====================================================

async function initializeLeaderboard() {
  try {
    // A direct referral deep link must not download all-time game histories.
    // Load the original leaderboard on demand if the player switches tabs.
    if (new URLSearchParams(window.location.search).get('view') !== 'referrals') {
      await loadGameOptions();
      gameOptionsInitialized = true;
      updateViewControls();
      await refreshData();
    }
    animate();
  } catch (error) {
    console.error("[Leaderboard] Failed to initialize:", error);

    leaderboardEmpty.hidden = false;
    leaderboardEmpty.textContent =
      "The leaderboard could not be loaded. Please try again.";
  }
}

await initializeLeaderboard();
