import test from "node:test";
import assert from "node:assert/strict";
import {
  makePuzzle,
  createRun,
  checkRun,
  SCORES,
  adjacentDays,
  versesForDay,
  scheduleCycleLength,
  mostRecentDay,
} from "./game-logic.mjs";

const text =
  "धृतराष्ट्र उवाच\n\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\n\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।1.1।।";
const previous = [{ txt: "ज्ञानम् शान्तिः सत्यम् कर्म योगः मनः" }];
const next = [{ txt: "आत्मा भक्तिः धर्मः फलम् जीवनम् सुखम्" }];
const puzzle = () => makePuzzle(text, previous, next);

test("three distinct blanks and nine unique choices, exactly three per source", () => {
  const pools = new Set();
  for (let i = 0; i < 100; i++) {
    const p = puzzle();
    assert.equal(p.answers.length, 3);
    assert.equal(new Set(p.answers).size, 3);
    assert.equal(p.pool.length, 9);
    assert.equal(new Set(p.pool).size, 9);
    assert.equal(p.fromPrevious.length, 3);
    assert.equal(p.fromNext.length, 3);
    assert.ok(
      p.fromPrevious.every((word) => previous[0].txt.split(" ").includes(word)),
    );
    assert.ok(
      p.fromNext.every((word) => next[0].txt.split(" ").includes(word)),
    );
    assert.ok(p.answers.every((word) => p.pool.includes(word)));
    assert.ok(!p.answers.includes("उवाच") && !p.answers.includes("धृतराष्ट्र"));
    assert.ok(!p.tokens.join("").includes("1.1"));
    assert.ok(p.tokens.join("").includes("युयुत्सवः।\n\n"));
    pools.add(p.pool.join(" "));
  }
  assert.ok(pools.size > 1);
});
test("shared neighboring words are allocated without duplicates", () => {
  const p = makePuzzle(
    text,
    [{ txt: "ज्ञानम् शान्तिः सत्यम् कर्म योगः मनः" }],
    [{ txt: "ज्ञानम् शान्तिः सत्यम्" }],
    () => 0,
  );
  assert.equal(new Set(p.pool).size, 9);
  assert.ok(p.fromPrevious.every((w) => ["कर्म", "योगः", "मनः"].includes(w)));
});
test("neighbor words matching current shloka are excluded", () => {
  const p = makePuzzle(
    text,
    [{ txt: previous[0].txt + " कुरुक्षेत्रे" }],
    [{ txt: next[0].txt + " समवेता" }],
  );
  assert.ok(!p.fromPrevious.includes("कुरुक्षेत्रे"));
  assert.ok(!p.fromNext.includes("समवेता"));
});
test("insufficient source words report an error instead of using a hardcoded bank", () => {
  assert.throws(
    () => makePuzzle(text, [{ txt: "योगः" }], next),
    /neighboring days/,
  );
  assert.throws(
    () => makePuzzle("योगः योगः ज्ञानम्", previous, next),
    /three different/,
  );
});
test("day six neighbors are days five and seven with two verses each", () => {
  const verses = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
  const result = adjacentDays(verses, 5);
  assert.deepEqual(
    result.previous.map((v) => v.id),
    [9, 10],
  );
  assert.deepEqual(
    result.next.map((v) => v.id),
    [13, 14],
  );
});
test("even-length schedule wraps both boundaries", () => {
  const verses = Array.from({ length: 700 }, (_, i) => ({ id: i + 1 }));
  assert.equal(scheduleCycleLength(700), 350);
  assert.deepEqual(
    adjacentDays(verses, 0).previous.map((v) => v.id),
    [699, 700],
  );
  assert.deepEqual(
    adjacentDays(verses, 349).next.map((v) => v.id),
    [1, 2],
  );
});
test("701-verse schedule retains the shared continuous pairing", () => {
  const verses = Array.from({ length: 701 }, (_, i) => ({ id: i + 1 }));
  assert.equal(scheduleCycleLength(701), 701);
  assert.deepEqual(
    versesForDay(verses, 350).map((v) => v.id),
    [701, 1],
  );
  assert.deepEqual(
    adjacentDays(verses, 0).previous.map((v) => v.id),
    [700, 701],
  );
  assert.deepEqual(
    adjacentDays(verses, 700).next.map((v) => v.id),
    [1, 2],
  );
  assert.equal(mostRecentDay(700, 701, 350), 350);
  assert.equal(mostRecentDay(0, 701, 351), 350);
});
test("each successful submission earns the exact score", () => {
  for (let failures = 0; failures < 5; failures++) {
    const run = createRun(puzzle(), 0);
    for (let i = 0; i < failures; i++) {
      run.choices = ["गलत", "गलत", "गलत"];
      assert.equal(checkRun(run, 1), "retry");
    }
    run.choices = [...run.puzzle.answers];
    assert.equal(checkRun(run, 2), "won");
    assert.equal(run.score, SCORES[failures]);
  }
});
test("one or two correct words remain locked through retries", () => {
  for (const count of [1, 2]) {
    const run = createRun(puzzle(), 0);
    run.choices = run.puzzle.answers.map((w, i) => (i < count ? w : "गलत"));
    assert.equal(checkRun(run, 1), "retry");
    assert.equal(run.locked.filter(Boolean).length, count);
    for (let i = 0; i < count; i++)
      assert.equal(run.choices[i], run.puzzle.answers[i]);
    run.choices = [...run.puzzle.answers];
    assert.equal(checkRun(run, 2), "won");
    assert.equal(run.score, 85);
  }
});
test("incomplete checks cost nothing; five failures score zero", () => {
  const run = createRun(puzzle(), 0);
  assert.equal(checkRun(run, 1), "incomplete");
  assert.equal(run.submissions, 0);
  for (let i = 0; i < 5; i++) {
    run.choices = ["गलत", "गलत", "गलत"];
    assert.equal(checkRun(run, 2), i === 4 ? "lost" : "retry");
  }
  assert.equal(run.score, 0);
  assert.equal(checkRun(run, 3), "finished");
});
test("deadline rejects correct answers without a new timer", () => {
  const run = createRun(puzzle(), 1000);
  run.choices = [...run.puzzle.answers];
  assert.equal(checkRun(run, 61000), "timeout");
  assert.equal(run.score, 0);
});
