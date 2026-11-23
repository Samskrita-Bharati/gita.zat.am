export const SHLOKA_HINT_COST = 20;

export function applyHintCosts(
  baseScore: number,
  completionFloor: number,
  wordHintsUsed: number,
  wordHintCost: number,
  shlokaRevealed: boolean,
) {
  const pathCost = wordHintsUsed * wordHintCost;
  const verseCost = shlokaRevealed ? SHLOKA_HINT_COST : 0;
  return {
    // Preserve the existing floor for word hints; the full shloka always costs 20.
    total: Math.max(completionFloor, baseScore - pathCost) - verseCost,
    hintPenalty: pathCost + verseCost,
    hintsUsed: wordHintsUsed + Number(shlokaRevealed),
  };
}
