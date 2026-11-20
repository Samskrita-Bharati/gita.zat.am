/** Pure helpers shared by the dashboard and offline tests. */
export function monthIdsSince(startDate, endDate = new Date()) {
  const ids = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= end && ids.length < 15) {
    ids.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ids;
}

export function daysInRange(days, now = new Date()) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  }
  return result;
}

export function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function extractAttempts(globalHistorySnapshots, sinceMs) {
  const attempts = [];
  for (const month of globalHistorySnapshots) {
    const entries = month.entries || {};
    const metadata = month.attemptMeta || {};
    for (const [key, rawScore] of Object.entries(entries)) {
      const score = Number(rawScore);
      if (!Number.isFinite(score) || score < 0 || score > 100) continue;
      const meta = metadata[key] || {};
      const parsedTime = Number(String(key).split('_')[0]);
      const completedAt = Number(meta.completedAt) || parsedTime;
      if (!Number.isFinite(completedAt) || completedAt < sinceMs || completedAt > Date.now() + 86_400_000) continue;
      attempts.push({
        key,
        score,
        completedAt,
        gameId: typeof meta.gameId === 'string' && meta.gameId ? meta.gameId : 'unknown',
        gameName: typeof meta.gameName === 'string' ? meta.gameName : '',
        uid: typeof meta.uid === 'string' ? meta.uid : '',
      });
    }
  }
  return attempts.sort((a, b) => b.completedAt - a.completedAt);
}

export function summarizeGames(catalog, visits, attempts) {
  const games = new Map();
  for (const { id, name } of catalog) {
    if (id) games.set(id, { id, name, visits: 0, scores: 0, scoreTotal: 0 });
  }
  for (const visit of visits) {
    const id = visit.gameId;
    if (typeof id !== 'string' || !id) continue;
    if (!games.has(id)) games.set(id, { id, name: visit.gameName || id, visits: 0, scores: 0, scoreTotal: 0 });
    games.get(id).visits += 1;
  }
  for (const attempt of attempts) {
    const id = attempt.gameId;
    if (!games.has(id)) games.set(id, { id, name: attempt.gameName || id, visits: 0, scores: 0, scoreTotal: 0 });
    games.get(id).scores += 1;
    games.get(id).scoreTotal += attempt.score;
  }
  return [...games.values()].sort((a, b) => b.visits - a.visits || b.scores - a.scores || a.name.localeCompare(b.name));
}
