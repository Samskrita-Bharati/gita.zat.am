// Presentation-only helpers for GG's Game Leaderboard accordion.
// Game score totals/ranks are computed separately in score-ranking.mjs.
export function groupRankedGames(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!row?.gameId) continue;
    if (!byId.has(row.gameId)) {
      byId.set(row.gameId, {
        gameId: row.gameId,
        gameName: row.gameName || row.gameId,
        players: [],
      });
    }
    const group = byId.get(row.gameId);
    group.players.push(row);
  }
  return [...byId.values()].sort((a, b) =>
    a.gameName.localeCompare(b.gameName, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function pageGamePlayers(rows, requestedPage = 1, pageSize = 10) {
  const size = Math.max(1, Math.trunc(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage) || 1));
  return {
    page,
    totalPages,
    rows: rows.slice((page - 1) * size, page * size),
  };
}
