import test from "node:test";
import assert from "node:assert/strict";
import { makePuzzle, createRun, checkRun, SCORES } from "./game-logic.mjs";

const split = (text) => text.trim().split(/\s+/u);
const text =
  "धृतराष्ट्र उवाच\n\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\n\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।1.1।।\n ";

test("two distinct answers, six unique choices, speaker and punctuation preserved", () => {
  for (let i = 0; i < 100; i++) {
    const p = makePuzzle(text, split);
    assert.equal(new Set(p.pool).size, 6);
    assert.notEqual(...p.answers);
    assert.ok(p.answers.every((w) => p.pool.includes(w)));
    assert.ok(!p.answers.includes("धृतराष्ट्र") && !p.answers.includes("उवाच"));
    assert.ok(!p.tokens.join("").includes("1.1"));
    assert.ok(p.tokens.join("").includes("युयुत्सवः।\n\n"));
  }
});

test("every permitted successful submission earns exact score", () => {
  for (let failures = 0; failures < 5; failures++) {
    const run = createRun(makePuzzle(text, split), 0);
    for (let i = 0; i < failures; i++) {
      run.choices = ["गलत", "गलत"];
      assert.equal(checkRun(run, 100), "retry");
    }
    run.choices = [...run.puzzle.answers];
    assert.equal(checkRun(run, 200), "won");
    assert.equal(run.score, SCORES[failures]);
  }
});

test("partial success locks and survives remaining retries", () => {
  const run = createRun(makePuzzle(text, split), 0);
  run.choices = [run.puzzle.answers[0], "गलत"];
  assert.equal(checkRun(run, 1), "retry");
  assert.deepEqual(run.locked, [true, false]);
  assert.deepEqual(run.choices, [run.puzzle.answers[0], null]);
  run.choices[1] = run.puzzle.answers[1];
  assert.equal(checkRun(run, 2), "won");
  assert.equal(run.score, 85);
});

test("five wrong submissions lose; incomplete checks cost nothing", () => {
  const run = createRun(makePuzzle(text, split), 0);
  assert.equal(checkRun(run, 1), "incomplete");
  assert.equal(run.submissions, 0);
  for (let i = 0; i < 5; i++) {
    run.choices = ["गलत", "गलत"];
    assert.equal(checkRun(run, 2), i === 4 ? "lost" : "retry");
  }
  assert.equal(run.score, 0);
  assert.equal(checkRun(run, 3), "finished");
});

test("deadline rejects even correct answers and cannot be extended by retries", () => {
  const run = createRun(makePuzzle(text, split), 1000);
  run.choices = [...run.puzzle.answers];
  assert.equal(checkRun(run, 61000), "timeout");
  assert.equal(run.score, 0);
});

test("not enough distinct words produces a useful error", () => {
  assert.throws(() => makePuzzle("योगः योगः", split), /two different/);
});
