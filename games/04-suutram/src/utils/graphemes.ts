import { splitWordIntoGraphemes } from '../../../shared/shloka-utils.js';

// Clean target words only; preserve the shared text for the reader panel.
export function cleanTargetWord(value: string): string {
  return value.normalize('NFC')
    .replace(/[।॥०-९0-9.,;:!?"“”‘’()[\]{}]/gu, '')
    .trim();
}
export function splitIntoCells(word: string): string[] {
  return splitWordIntoGraphemes(word.normalize('NFC'));
}
export function eligibleWords(words: readonly string[], maxCells = 36) {
  const seen = new Set<string>();
  const result: { word: string; tokens: string[] }[] = [];
  for (const value of words) {
    const word = cleanTargetWord(value);
    if (!word || /\s/u.test(word) || !/\p{L}/u.test(word) || seen.has(word)) continue;
    const tokens = splitIntoCells(word);
    if (tokens.length < 2 || tokens.length > maxCells) continue;
    seen.add(word);
    result.push({ word, tokens });
  }
  return result;
}
