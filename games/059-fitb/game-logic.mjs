export const SCORES = [100, 85, 65, 50, 35];
const normalize = (word) => word.normalize("NFC");
const wrap = (value, length) => ((value % length) + length) % length;

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function cleanText(text) {
  return String(text ?? "")
    .replace(/[।॥]*\s*[0-9०-९]+\.[0-9०-९]+\s*[।॥]*\s*$/u, "")
    .trim();
}

export function wordTokens(text) {
  const tokens =
    cleanText(text).match(
      /[\p{L}\p{M}\u200c\u200d]+|[^\p{L}\p{M}\u200c\u200d]+/gu,
    ) || [];
  const eligible = [];
  // Speaker introductions remain visible and never become choices.
  const introductions = new Set();
  let lineStart = 0;
  for (const line of cleanText(text).split("\n")) {
    if (/उवाच/u.test(line)) {
      for (let p = lineStart; p < lineStart + line.length; p++)
        introductions.add(p);
    }
    lineStart += line.length + 1;
  }
  let position = 0;
  tokens.forEach((token, index) => {
    if (
      /^[\p{L}\p{M}\u200c\u200d]+$/u.test(token) &&
      /\p{Script=Devanagari}/u.test(token) &&
      !introductions.has(position)
    )
      eligible.push(index);
    position += token.length;
  });
  return { tokens, eligible };
}

export function scheduleCycleLength(verseCount, perDay = 2) {
  if (
    !Number.isInteger(verseCount) ||
    verseCount < 1 ||
    !Number.isInteger(perDay) ||
    perDay < 1
  )
    throw new Error("Invalid shloka schedule.");
  let a = verseCount,
    b = perDay;
  while (b) [a, b] = [b, a % b];
  return verseCount / a;
}

export function versesForDay(verses, dayIndex, perDay = 2) {
  scheduleCycleLength(verses.length, perDay);
  const first = wrap(dayIndex * perDay, verses.length);
  return Array.from(
    { length: Math.min(perDay, verses.length) },
    (_, offset) => verses[(first + offset) % verses.length],
  );
}

export function adjacentDays(verses, dayIndex, perDay = 2) {
  return {
    previous: versesForDay(verses, dayIndex - 1, perDay),
    next: versesForDay(verses, dayIndex + 1, perDay),
  };
}

// An id-only URL does not carry the original date. Associate it with its
// most recent scheduled occurrence on or before the current local day.
export function mostRecentDay(verseIndex, verseCount, todayIndex, perDay = 2) {
  const cycle = scheduleCycleLength(verseCount, perDay);
  for (let offset = 0; offset < cycle; offset++) {
    const day = todayIndex - offset;
    const first = wrap(day * perDay, verseCount);
    for (let i = 0; i < Math.min(perDay, verseCount); i++) {
      if ((first + i) % verseCount === verseIndex) return day;
    }
  }
  throw new Error("Selected shloka could not be matched to the schedule.");
}

function sourceWords(verses, occupied) {
  const unique = new Map();
  for (const verse of verses) {
    const { tokens, eligible } = wordTokens(verse.txt);
    for (const i of eligible) {
      const key = normalize(tokens[i]);
      if (!occupied.has(key)) unique.set(key, tokens[i]);
    }
  }
  return [...unique.values()];
}

export function makePuzzle(
  text,
  previousVerses,
  nextVerses,
  random = Math.random,
) {
  const { tokens, eligible } = wordTokens(text);
  const uniquePositions = new Map();
  for (const index of shuffle(eligible, random)) {
    const key = normalize(tokens[index]);
    if (!uniquePositions.has(key)) uniquePositions.set(key, index);
  }
  const indices = [...uniquePositions.values()]
    .slice(0, 3)
    .sort((a, b) => a - b);
  if (indices.length !== 3)
    throw new Error("This shloka needs three different playable words.");
  const answers = indices.map((index) => tokens[index]);
  const occupied = new Set(tokens.map(normalize));
  const previous = shuffle(sourceWords(previousVerses, occupied), random);
  const next = shuffle(sourceWords(nextVerses, occupied), random);

  // Allocate scarce previous-only words first. This avoids a random pick
  // using all words that the next day needs when the sources overlap.
  const nextSet = new Set(next.map(normalize));
  const previousOnly = previous.filter((word) => !nextSet.has(normalize(word)));
  const shared = previous.filter((word) => nextSet.has(normalize(word)));
  const fromPrevious = [...previousOnly, ...shared].slice(0, 3);
  const chosen = new Set(fromPrevious.map(normalize));
  const fromNext = next
    .filter((word) => !chosen.has(normalize(word)))
    .slice(0, 3);
  if (fromPrevious.length !== 3 || fromNext.length !== 3) {
    throw new Error(
      "The neighboring days do not contain enough distinct words for three choices from each day. Please select another shloka.",
    );
  }
  return {
    tokens,
    indices,
    answers,
    fromPrevious,
    fromNext,
    pool: shuffle([...answers, ...fromPrevious, ...fromNext], random),
  };
}

export function createRun(puzzle, now = Date.now()) {
  return {
    puzzle,
    choices: puzzle.answers.map(() => null),
    locked: puzzle.answers.map(() => false),
    submissions: 0,
    deadline: now + 60000,
    finished: false,
    score: null,
  };
}
export function checkRun(run, now = Date.now()) {
  if (run.finished) return "finished";
  if (now >= run.deadline) {
    run.finished = true;
    run.score = 0;
    return "timeout";
  }
  if (run.choices.some((w, i) => !run.locked[i] && w === null))
    return "incomplete";
  run.submissions++;
  run.choices.forEach((word, i) => {
    if (normalize(word || "") === normalize(run.puzzle.answers[i]))
      run.locked[i] = true;
  });
  if (run.locked.every(Boolean)) {
    run.finished = true;
    run.score = SCORES[run.submissions - 1];
    return "won";
  }
  if (run.submissions >= 5) {
    run.finished = true;
    run.score = 0;
    return "lost";
  }
  run.choices = run.choices.map((word, i) => (run.locked[i] ? word : null));
  return "retry";
}
