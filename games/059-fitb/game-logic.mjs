export const SCORES = [100, 85, 70, 50, 35];
const BANK = ['ज्ञानम्','शान्तिः','सत्यम्','कर्म','योगः','मनः','आत्मा','भक्तिः','धर्मः','फलम्','जीवनम्','सुखम्','दुःखम्','प्रकाशः','मित्रम्','जलम्'];
const normalize = word => word.normalize('NFC');

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function makePuzzle(text, splitWords, random = Math.random) {
  // Keep original whitespace and punctuation as separate display tokens.
  const cleaned = text.replace(/[।॥]*\s*[0-9०-९]+\.[0-9०-९]+\s*[।॥]*\s*$/u, '').trim();
  const tokens = cleaned.match(/[\p{L}\p{M}\u200c\u200d]+|[^\p{L}\p{M}\u200c\u200d]+/gu) || [];
  const words = splitWords(cleaned);

  if (words.length < 2) 
    throw new Error('This shloka does not contain enough words.');
  const eligible = [];
  let lineStart = 0;
  // Leave speaker introduction lines visible, including the name before उवाच.

  const introductions = new Set();
  for (const line of cleaned.split('\n')) {
    if (/उवाच/u.test(line)) for (let p = lineStart; p < lineStart + line.length; p++) introductions.add(p);
    lineStart += line.length + 1;
  }

  let position = 0;
  tokens.forEach((token, index) => {
    if (/^[\p{L}\p{M}\u200c\u200d]+$/u.test(token) && /\p{Script=Devanagari}/u.test(token) && !introductions.has(position)) eligible.push(index);
    position += token.length;
  });

  const candidates = shuffle(eligible, random);
  const first = candidates[0];
  const second = candidates.find(i => normalize(tokens[i]) !== normalize(tokens[first] || ''));

  if (first === undefined || second === undefined) 
    throw new Error('This shloka needs two different playable words.');

  const indices = [first, second].sort((a,b) => a-b);
  const answers = indices.map(i => tokens[i]);
  const occupied = new Set(tokens.map(normalize));
  const distractors = shuffle(BANK.filter(w => !occupied.has(normalize(w))), random).slice(0,4);

  if (distractors.length !== 4) 
    throw new Error('Not enough distinct word choices.');
  return { tokens, indices, answers, pool: shuffle([...answers, ...distractors], random) };

}

export function createRun(puzzle, now = Date.now()) {
  return { puzzle, choices: [null,null], locked: [false,false], submissions: 0, deadline: now + 60000, finished: false, score: null };
}

export function checkRun(run, now = Date.now()) {
  if (run.finished) 
    return 'finished';
  if (now >= run.deadline) 
    { run.finished = true; run.score = 0; return 'timeout'; }
  if (run.choices.some((w,i) => !run.locked[i] && w === null)) 
    return 'incomplete';

  run.submissions++;
  run.choices.forEach((word,i) => { if (normalize(word || '') === normalize(run.puzzle.answers[i])) run.locked[i] = true; });

  if (run.locked.every(Boolean)) 
    { run.finished = true; run.score = SCORES[run.submissions-1]; return 'won'; }
  if (run.submissions >= 5) 
    { run.finished = true; run.score = 0; return 'lost'; }
  run.choices = run.choices.map((word,i) => run.locked[i] ? word : null);
  return 'retry';
}
