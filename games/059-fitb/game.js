import { makePuzzle, createRun, checkRun, SCORES } from "./game-logic.mjs";

import {
  prepareLeaderboard,
  getPlayerUid,
  saveDailyImprovement,
} from "./leaderboard-score.js";

const $ = (id) => document.getElementById(id);
let source,
  run,
  selected = 0,
  timer;
function say(message, kind = "info") {
  $("status").textContent = message;
  $("status").className = `zatam-game-status zatam-game-status-${kind}`;
}
function updateTime() {
  if (!run || run.finished) return;
  const left = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
  $("time").textContent =
    `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  $("time").classList.toggle("time-warning", left <= 10);
  if (!left) {
    checkRun(run);
    finish("timeout");
  }
}
function active() {
  updateTime();
  return run && !run.finished;
}
function render() {
  $("verse").replaceChildren();
  run.puzzle.tokens.forEach((token, index) => {
    const slot = run.puzzle.indices.indexOf(index);
    if (slot < 0) {
      $("verse").append(document.createTextNode(token));
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `blank${selected === slot && !run.finished ? " selected" : ""}${run.locked[slot] ? " locked" : ""}`;
    button.textContent = run.choices[slot] || `【 ${slot + 1} 】`;
    button.disabled = run.locked[slot] || run.finished;
    button.setAttribute(
      "aria-label",
      `Blank ${slot + 1}: ${run.choices[slot] || "empty"}${run.locked[slot] ? ", correct and locked" : ""}`,
    );
    button.setAttribute("aria-pressed", String(selected === slot));
    button.onclick = () => {
      if (!active()) return;
      selected = slot;
      render();
    };
    $("verse").append(button);
  });
  $("pool").replaceChildren();
  run.puzzle.pool.forEach((word) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = word;
    const used = run.choices.includes(word);
    button.className = `word${used ? " used" : ""}`;
    button.disabled = used || run.finished;
    button.onclick = () => {
      if (!active() || run.locked[selected]) return;
      run.choices[selected] = word;
      const next = run.choices.findIndex(
        (w, i) => !run.locked[i] && w === null,
      );
      if (next >= 0) selected = next;
      render();
    };
    $("pool").append(button);
  });
  $("retries").textContent =
    `${Math.min(run.finished && run.locked.every(Boolean) ? run.submissions - 1 : run.submissions, 4)} / 4`;
  $("score").textContent = run.finished ? run.score : SCORES[run.submissions];
  $("check").disabled =
    run.finished || run.choices.some((w, i) => !run.locked[i] && w === null);
  $("clear").disabled = run.finished;
}

function setLeaderboardMessage(message, kind = "info") {
  let element = document.getElementById(
    "leaderboardSaveStatus",
  );

  if (!element) {
    element = document.createElement("p");
    element.id = "leaderboardSaveStatus";

    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");

    $("details").after(element);
  }

  element.className =
    `zatam-game-status zatam-game-status-${kind}`;

  element.textContent = message;
}

function showShlokaMeaning() {
  const verse = source?.verse;

  const translation = verse?.translation;
  const meaning = verse?.meaning;

  if (
    typeof translation === "string" &&
    translation.trim()
  ) {
    $("meaningText").textContent = translation.trim();
  } else if (
    typeof meaning === "string" &&
    meaning.trim()
  ) {
    const englishParts = meaning
      .split(";")
      .map((entry) => {
        const separator = entry.indexOf("—");

        return separator >= 0
          ? entry.slice(separator + 1).trim()
          : "";
      })
      .filter(Boolean);

    $("meaningText").textContent =
      englishParts.length > 0
        ? englishParts.join("; ")
        : "An English meaning is not available for this shloka.";
  } else {
    $("meaningText").textContent =
      "An English meaning is not available for this shloka.";
  }

  $("meaningSection").hidden = false;
}

async function saveFinishedRun(
  completedRun,
  outcome,
  completedAt,
) {
  const elapsedMs = Math.max(
    0,
    Math.min(
      60000,
      completedAt - completedRun.startedAt,
    ),
  );

  try {
    const result = await saveDailyImprovement({
      uid: completedRun.playerUid,
      score: completedRun.score,
      elapsedMs,
      completedAt,
      outcome,
    });

    // A previous round's save must not change the
    // messages displayed for a newer round.
    if (run !== completedRun) {
      return;
    }

    if (result.saved) {
      setLeaderboardMessage(
        "High score recorded to leaderboard.",
        "success",
      );

      return;
    }

    if (result.reason === "not-improved") {
      setLeaderboardMessage(
        `Today's best remains ${result.best.score}/100 ` +
          `in ${(result.best.elapsedMs / 1000).toFixed(2)} seconds.`,
      );

      return;
    }

    setLeaderboardMessage(
      "Score not saved. Sign in before starting a round " +
        "and stay signed in with the same account.",
      "error",
    );
  } catch (error) {
    console.error(
      "[059-fitb] Leaderboard save failed:",
      error,
    );

    if (run !== completedRun) {
      return;
    }

    setLeaderboardMessage(
      "Score could not be saved. Check your connection " +
        "and Firebase permissions.",
      "error",
    );
  }
}

function finish(outcome) {
  // Prevent duplicate saving for the same round.
  if (run.saveStarted) {
    return;
  }

  run.saveStarted = true;

  clearInterval(timer);

  const completedRun = run;

  // Background tabs may notice timeout late.
  // Their actual round still ends at the original deadline.
  const completedAt =
    outcome === "timeout"
      ? completedRun.deadline
      : Math.min(Date.now(), completedRun.deadline);

  $("result").hidden = false;

  $("resultTitle").textContent =
    outcome === "won"
      ? "Shloka complete!"
      : outcome === "timeout"
        ? "Time is up"
        : "No submissions left";

  $("finalScore").textContent =
    `${completedRun.score} / 100`;

  $("details").textContent =
    outcome === "won"
      ? `Solved on submission ${completedRun.submissions} of 5.`
      : "Try another round when you are ready.";

  say(
    outcome === "won"
      ? "All three words are correct. Well done!"
      : "Round finished.",
    outcome === "won" ? "success" : "error",
  );

  render();
  showShlokaMeaning();

  setLeaderboardMessage(
    "Checking today's best score…",
  );

  void saveFinishedRun(
    completedRun,
    outcome,
    completedAt,
  );
}

async function start() {
  // Prevent multiple starts while Firebase checks the account.
  if (start.preparing) return;

  start.preparing = true;

  try {
    await prepareLeaderboard();

    const playerUid = getPlayerUid();

    if (!playerUid) {
      say(
        "This page cannot detect your signed-in account. " +
          "Sign in using the navbar in this same browser tab.",
        "error",
      );

      return;
    }

    const puzzle = makePuzzle(
      source.text,
      source.previous,
      source.next,
    );

    clearInterval(timer);

    run = createRun(puzzle);

    // Capture the account and timing for this exact round.
    run.startedAt = run.deadline - 60000;
    run.playerUid = playerUid;
    run.saveStarted = false;

    selected = 0;

    $("intro").hidden = true;
    $("board").hidden = false;
    $("result").hidden = true;
    $("meaningSection").hidden = true;
    $("meaningText").textContent = "";

    $("time").textContent = "1:00";
    $("time").classList.remove("time-warning");

    setLeaderboardMessage("");

    say("Select a blank, then choose its missing word.");

    render();

    timer = setInterval(updateTime, 200);
  } catch (error) {
    console.error("[059-fitb] Could not start round:", error);

    say(
      "The round could not start. Check the browser Console.",
      "error",
    );
  } finally {
    start.preparing = false;
  }
}

$("start").onclick = start;

$("again").onclick = start;

$("check").onclick = () => {
  if (!active()) return;
  const result = checkRun(run);
  if (["won", "lost", "timeout"].includes(result)) {
    finish(result);
    return;
  }
  if (result === "incomplete") {
    say("Fill all three blanks before checking.");
    return;
  }
  selected = run.locked.findIndex((value) => !value);
  say(
    `${run.locked.filter(Boolean).length} of 3 words locked. Choose again for the remaining blanks. ${5 - run.submissions} submission${5 - run.submissions === 1 ? "" : "s"} left.`,
    "error",
  );
  render();
};

$("clear").onclick = () => {
  if (!active()) return;
  run.choices = run.choices.map((w, i) => (run.locked[i] ? w : null));
  selected = run.locked.findIndex((value) => !value);
  render();
  say("Unchecked choices cleared. Correct words remain locked.");
};

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateTime();
});

window.addEventListener("pageshow", updateTime);

try 
{
  const { loadChallengeSource } = await import("./shloka-source.js");
  source = await loadChallengeSource();
  try {
    await prepareLeaderboard();
  } catch (error) {
    console.warn(
      "[059-fitb] Account initialization failed:",
      error,
    );
  }
  makePuzzle(source.text, source.previous, source.next); // Validate before offering a timed round.
  $("start").disabled = false;
  $("start").textContent = "Start Game";
  say("Ready. Your 60 seconds begin when you press Start Game.");
} 
  catch (error) 
{
  $("start").textContent = "Shloka unavailable";
  say(
    error.message ||
      "Unable to load a playable shloka. Reopen the game from the shloka page.",
    "error",
  );
  console.error("[fill-in-the-blank]", error);
}
