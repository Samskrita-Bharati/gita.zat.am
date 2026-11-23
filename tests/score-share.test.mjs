import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeShareResult } from "../games/shared/score-share.js";

test("individual completion shares the score, not invented rank or player name", () => {
  const result = normalizeShareResult({
    score: 95,
    gameId: "018-as",
    gameName: "सुभाषितम्",
  });
  assert.equal(result.score, 95);
  assert.equal(result.scoreType, "game");
  assert.equal(result.rank, null);
  assert.equal(result.playerName, "");
  assert.equal(result.url, "https://gg.zat.am/games/018-as/");
});

test("cumulative points may exceed 100; only actual numeric rankings are included", () => {
  const result = normalizeShareResult({
    score: 285,
    scoreType: "cumulative",
    gameId: "strands",
    rank: 3,
    levels: 4,
  });
  assert.equal(result.score, 285);
  assert.equal(result.rank, 3);
  assert.equal(result.levels, 4);
});

test("typing uses a duration card instead of fabricating a 0-100 leaderboard score", () => {
  const result = normalizeShareResult({
    score: 124,
    scoreType: "completion",
    gameId: "057-gita-typing",
  });
  assert.equal(result.scoreType, "completion");
  assert.equal(result.score, 124);
});

test("only approved project URLs are emitted and names have bounded length", () => {
  const result = normalizeShareResult({
    score: 80,
    gameId: "../unsafe?x=1",
    playerName: "X".repeat(200),
  });
  assert.ok(result.url.startsWith("https://gg.zat.am/games/"));
  assert.equal(result.playerName.length, 64);
  assert.equal(
    normalizeShareResult({ score: 1234, scoreType: "overall" }).url,
    "https://gg.zat.am/leaderboard/",
  );
  assert.throws(() => normalizeShareResult({ score: -1 }), TypeError);
});

test("share module requires no Firebase service or game-scoring import", () => {
  const source = readFileSync(
    new URL("../games/shared/score-share.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /firebase-|getDocs\(|setDoc\(|writeBatch\(/);
});
