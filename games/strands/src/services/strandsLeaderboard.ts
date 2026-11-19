import type { GitaPuzzle } from './gitaContentService';
import type { ScoreBreakdown } from '../types/gameTypes';

type SharedScores = {
  initGameScore(options: { gameId: string; gameName: string; levelId: string; levelName: string }): unknown;
  submitGameScore(score: number, options: { metrics: Record<string, string | number> }): Promise<{ ok: boolean; reason?: string }>;
};

export type ScoreStatus = 'saved' | 'not-signed-in' | 'unconfirmed';

function loadSharedScores(): Promise<SharedScores> {
  // The portal serves its native JS and Firebase modules. Resolve from the
  // game page, so both Vite and the deployed Strands bundle reuse that API.
  const url = new URL('../shared/game-score.js', window.location.href);
  return import(/* @vite-ignore */ url.href);
}

export function leaderboardScore(raw: number, maximum: number): number {
  return Math.max(0, Math.min(100, Math.round(raw * 100 / maximum)));
}

export function prepareStrandsScoreRun(
  puzzle: Pick<GitaPuzzle, 'verseId' | 'reference' | 'rows' | 'cols'>,
  load = loadSharedScores,
) {
  let cancelled = false;
  let submission: Promise<ScoreStatus> | undefined;

  const ready = load().then(api => {
    if (cancelled) return null;

    api.initGameScore({
      gameId: 'strands',
      gameName: 'Gita Strands',
      levelId: `${puzzle.reference}-${puzzle.rows}x${puzzle.cols}`,
      levelName: `Shloka ${puzzle.reference} – ${puzzle.rows}×${puzzle.cols}`,
    });

    return api;
  }).catch(() => null);

  return {
    cancel() { cancelled = true; },
    submit(result: ScoreBreakdown, maximum: number): Promise<ScoreStatus> {
      // A failed shared request may already have written the score before
      // recording shloka progress. Do not automatically retry it.
      submission ??= ready.then(async api => {
        if (!api || cancelled) return 'unconfirmed';
        const status = await api.submitGameScore(leaderboardScore(result.total, maximum), {
          metrics: { shlokaId: puzzle.verseId, playSeconds: result.elapsedSeconds, hints: result.hintsUsed, rawScore: result.total, maxRawScore: maximum },
        });
        return status.ok ? 'saved' : status.reason === 'not-signed-in' ? 'not-signed-in' : 'unconfirmed';
      }).catch(() => 'unconfirmed');
      return submission;
    },
  };
}
