import { getShlokaTextFromUrl, splitShlokaWords } from '../../../shared/shloka-utils.js';
import { cleanShlokaText } from '../../../../shlokasToday/shlokasToday.js';
import type { ThemeData } from '../types/gameTypes';
import { eligibleWords } from '../utils/graphemes.ts';
import { seedFromId, seededRandom, shuffleWith } from '../utils/seededRandom.ts';

type VerseRecord = { id: number; ch: number; vn: number; txt: string };
export type ShlokaContent = { id: number; chapter: number; verse: number; text: string; words: string[] };
export type GitaPuzzle = ThemeData & { verseId: number; reference: string; text: string; seed: number };
// Shared word arrays change the target pool. Keep prior preview scores separate.
export const PUZZLE_VERSION = 2;
let recordsPromise: Promise<VerseRecord[]> | undefined;

function loadRecords(): Promise<VerseRecord[]> {
  recordsPromise ??= fetch(new URL('../../../../assets/bhagavad-gita-verses.json', import.meta.url))
    .then(async response => {
      if (!response.ok) throw new Error(`Verse data request failed: ${response.status}`);
      const records: unknown = await response.json();
      if (!Array.isArray(records) || !records.length || records.some(record =>
        !Number.isSafeInteger(record?.id) || record.id < 1 ||
        !Number.isInteger(record?.ch) || !Number.isInteger(record?.vn) || typeof record?.txt !== 'string')) {
        throw new Error('The shared verse data has an invalid format.');
      }
      return records as VerseRecord[];
    }).catch(error => { recordsPromise = undefined; throw error; });
  return recordsPromise;
}

function resolveRecord(records: VerseRecord[], text: string): VerseRecord {
  // The shared helper owns ID validation/date fallback. Never infer an ID from
  // the requested URL: it may have been changed by that fallback.
  const normalized = text.normalize('NFC');
  const matches = records.filter(record => cleanShlokaText(record.txt).normalize('NFC') === normalized);
  if (matches.length !== 1) throw new Error('Could not uniquely identify the shloka returned by the shared loader.');
  return matches[0];
}

export function buildGitaPuzzle(verse: ShlokaContent): GitaPuzzle {
  const id = `gita-${verse.id}-v${PUZZLE_VERSION}`;
  const seed = seedFromId(id);
  const candidates = shuffleWith(eligibleWords(verse.words), seededRandom(seed)).slice(0, 5);
  if (!candidates.length) throw new Error(`Shloka ${verse.chapter}.${verse.verse} has no words of at least two cells that fit the board.`);
  let selected: typeof candidates = [];
  for (let count = Math.min(3, candidates.length); count >= 1 && !selected.length; count--) {
    const choose = (start: number, picked: typeof candidates): void => {
      if (selected.length) return;
      if (picked.length === count) {
        if (picked.reduce((sum, item) => sum + item.tokens.length, 0) <= 36) selected = picked;
        return;
      }
      for (let i = start; i < candidates.length; i++) choose(i + 1, [...picked, candidates[i]]);
    };
    choose(0, []);
  }
  const cells = selected.reduce((sum, item) => sum + item.tokens.length, 0);
  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(cells))));
  const rows = Math.max(2, Math.ceil(cells / cols));
  return {
    id, seed, verseId: verse.id, reference: `${verse.chapter}.${verse.verse}`, text: verse.text,
    titleSanskrit: `श्लोकः ${verse.chapter}.${verse.verse}`, titleEnglish: `Shloka ${verse.chapter}.${verse.verse}`,
    clue: 'Find the hidden words from this shloka.', clueSanskrit: 'अस्मात् श्लोकात् गुप्तशब्दान् अन्वेषयतु।',
    icon: '', difficulty: 'Shared shloka', difficultySanskrit: 'श्लोकः', rows, cols,
    targets: selected.map((item, index) => ({ ...item, id: `${id}-word-${index + 1}`, transliteration: '', meaning: '', audioPath: '', featured: false, bonus: false })),
    startingHints: 3, themeWordPoints: 15, featuredWordPoints: 40, bonusWordPoints: 5,
    completionPoints: 100, maxSpeedBonus: 100, speedBonusLossPerMinute: 15, hintPenalty: 10,
    background: 'transparent',
  };
}

export async function loadShlokaPuzzles(search = window.location.search): Promise<GitaPuzzle[]> {
  const text = await getShlokaTextFromUrl(search);
  if (text === null) throw new Error('No shloka is available under the portal schedule yet.');
  const records = await loadRecords();
  const selected = resolveRecord(records, text);
  const makePuzzle = (record: VerseRecord, sharedText: string) => buildGitaPuzzle({
    id: record.id, chapter: record.ch, verse: record.vn, text: sharedText,
    words: splitShlokaWords(sharedText),
  });
  const puzzles = [makePuzzle(selected, text)];
  // Each day contains a pair. Keep the requested/resolved shloka first. Ask the
  // shared loader about its partner too, so this cannot expose a future verse.
  const firstId = records[0].id;
  const lastId = records[records.length - 1].id;
  const partnerId = selected.id % 2 ? selected.id + 1 : selected.id - 1;
  const partnerCandidates = selected.id === firstId ? [partnerId, lastId]
    : selected.id === lastId && selected.id % 2 ? [firstId] : [partnerId];
  for (const requestedPartner of partnerCandidates) {
    if (!records.some(record => record.id === requestedPartner) || requestedPartner === selected.id) continue;
    const partnerText = await getShlokaTextFromUrl(`?id=${requestedPartner}`);
    if (partnerText === null) continue;
    const partner = resolveRecord(records, partnerText);
    if (partner.id !== requestedPartner || partner.id === selected.id) continue;
    puzzles.push(makePuzzle(partner, partnerText));
    break;
  }
  return puzzles;
}

// Compatibility exports keep the existing App/layout untouched. The loader now
// uses shared content; it no longer reads sampleShlokas.ts or clamps to ID 2.
export const loadPreviewPuzzles = loadShlokaPuzzles;
export function previewIndex(_search: string): number { return 0; }
