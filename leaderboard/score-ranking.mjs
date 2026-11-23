// Pure GG leaderboard aggregation. Every submission remains a 0–100 score.
// Group by player + game for All Levels; never award points for replaying a
// level, and never count old untagged records as an extra level when tagged
// records exist for that player's game.
export function levelKeyOf(attempt) {
  return attempt?.levelId == null || attempt.levelId === ""
    ? "__no_level__"
    : String(attempt.levelId);
}

export function isBetterAttempt(candidate, current) {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;
  if (candidate.timePlayed !== current.timePlayed) return candidate.timePlayed < current.timePlayed;
  return candidate.timestamp > current.timestamp;
}

export function rankGamePlayers(records, {
  selectedGame = "all", selectedLevel = "all", scoringSystem = "totalScore",
} = {}) {
  const games = new Map();
  for (const record of records) {
    if (!record?.uid || !record.gameId || record.gameId === "legacy") continue;
    if (selectedGame !== "all" && record.gameId !== selectedGame) continue;
    const levelKey = levelKeyOf(record);
    if (selectedGame !== "all" && selectedLevel !== "all" && levelKey !== selectedLevel) continue;
    const score = Number(record.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) continue;
    const timePlayed = Math.max(0, Number(record.timePlayed) || 0);
    const gameKey = `${record.gameId}\u0000${record.uid}`;
    if (!games.has(gameKey)) {
      games.set(gameKey, {
        uid: record.uid,
        gameId: record.gameId,
        gameName: record.gameName || record.gameId,
        levels: new Map(),
        attempts: [],
        totalTimePlayed: 0,
        latestTimestamp: 0,
      });
    }
    const player = games.get(gameKey);
    player.gameName = record.gameName || player.gameName;
    player.attempts.push(record);
    player.totalTimePlayed += timePlayed;
    player.latestTimestamp = Math.max(player.latestTimestamp, Number(record.timestamp) || 0);
    if (!player.levels.has(levelKey)) {
      player.levels.set(levelKey, { levelKey, levelId: record.levelId ?? null,
        levelName: record.levelName || null, attempts: [], best: null });
    }
    const level = player.levels.get(levelKey);
    if (record.levelName) level.levelName = record.levelName;
    level.attempts.push(record);
    const candidate = { score, timePlayed, timestamp: Number(record.timestamp) || 0 };
    if (isBetterAttempt(candidate, level.best)) level.best = candidate;
  }

  const byGame = new Map();
  for (const player of games.values()) {
    let levels = [...player.levels.values()];
    if (selectedLevel === "all" && levels.some((level) => level.levelKey !== "__no_level__")) {
      levels = levels.filter((level) => level.levelKey !== "__no_level__");
    }
    levels.sort((a, b) => (a.levelName || String(a.levelId || ""))
      .localeCompare(b.levelName || String(b.levelId || ""), undefined, { numeric: true, sensitivity: "base" }));
    if (!levels.length) continue;
    const cumulativeScore = levels.reduce((sum, level) => sum + level.best.score, 0);
    const bestTimePlayed = levels.reduce((sum, level) => sum + level.best.timePlayed, 0);
    const row = {
      uid: player.uid,
      gameId: player.gameId,
      gameName: player.gameName,
      groupKey: player.gameId,
      score: levels.length === 1 && selectedLevel !== "all" ? levels[0].best.score : cumulativeScore,
      bestScore: Math.max(...levels.map((level) => level.best.score)),
      cumulativeScore,
      levelsCount: levels.length,
      attemptsCount: player.attempts.length,
      totalTimePlayed: player.totalTimePlayed,
      bestTimePlayed,
      timestamp: player.latestTimestamp,
      levels: levels.map((level) => ({
        levelKey: level.levelKey, levelId: level.levelId, levelName: level.levelName,
        bestScore: level.best.score, bestTimePlayed: level.best.timePlayed,
        attempts: level.attempts.slice().sort((a,b) => b.timestamp - a.timestamp),
      })),
    };
    if (!byGame.has(player.gameId)) byGame.set(player.gameId, []);
    byGame.get(player.gameId).push(row);
  }

  const ranked = [];
  for (const rows of byGame.values()) {
    rows.sort((a,b) => {
      if (scoringSystem === "totalTimePlayed") {
        if (a.totalTimePlayed !== b.totalTimePlayed) return b.totalTimePlayed - a.totalTimePlayed;
      } else if (a.cumulativeScore !== b.cumulativeScore) {
        return b.cumulativeScore - a.cumulativeScore;
      }
      if (a.bestTimePlayed !== b.bestTimePlayed) return a.bestTimePlayed - b.bestTimePlayed;
      return b.timestamp - a.timestamp;
    });
    rows.forEach((row, index) => ranked.push({ ...row, rank: index + 1 }));
  }
  ranked.sort((a,b) => a.gameName.localeCompare(b.gameName, undefined, { numeric: true, sensitivity: "base" }) || a.rank - b.rank);
  return ranked;
}
