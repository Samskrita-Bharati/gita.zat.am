import { makePuzzle, createRun, checkRun, SCORES } from "./game-logic.mjs";
import {
  showCompletedScoreShare,
  clearCompletedScoreShare,
} from "../shared/score-share.js";

import {
  showScorePopup, 
  closeScorePopup
} from "../shared/popup-built/score-popup.js?v=6"

import "../04-suutram/share-bridge.js"

window.showScorePopup = showScorePopup;
window.closeScorePopup = closeScorePopup;
 
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
  $("attempts").textContent = `${run.submissions} / 5`;
  $("score").textContent = run.finished ? run.score : SCORES[run.submissions];
  $("check").disabled =
    run.finished || run.choices.some((w, i) => !run.locked[i] && w === null);
  $("clear").disabled = run.finished;
}

function showShlokaMeaning() {
  const verse = source?.verse;

  const translation =
    typeof verse?.translation === "string"
      ? verse.translation.trim()
      : "";

  const meaning =
    typeof verse?.meaning === "string"
      ? verse.meaning.trim()
      : "";

  if (translation) {
    $("meaningText").textContent = translation;

    $("meaningDescription").textContent =
      "English translation of this shloka.";
  } else {
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

    $("meaningDescription").textContent =
      "English word meanings from this shloka.";
  }

  $("meaningSection").hidden = false;
}

function finish(outcome) {
  if (run.resultShown) return;

  run.resultShown = true;

  clearInterval(timer);

  const finalScore = run.score;

  const completedIn = Math.min(
    60,
    Math.max(
      0,
      Math.floor(
        (Date.now() - (run.deadline - 60000)) / 1000,
      ),
    ),
  );

  // Successful rounds use the shared popup.
  $("result").hidden = outcome === "won";

  $("resultTitle").textContent =
    outcome === "won"
      ? "Shloka complete!"
      : outcome === "timeout"
        ? "Time is up"
        : "No submissions left";

  $("finalScore").textContent = `${finalScore} / 100`;

  $("details").textContent =
    outcome === "won"
      ? `Solved on submission ${run.submissions} of 5.`
      : "Try another round when you are ready.";

  say(
    outcome === "won"
      ? "All three words are correct. Well done!"
      : "Round finished.",
    outcome === "won" ? "success" : "error",
  );

  render();

  // Meaning remains on the page after closing the popup.
  showShlokaMeaning();

  // Preserve your existing score-sharing integration.
  showCompletedScoreShare({
    score: finalScore,
    gameId: "059-fitb",
    gameName: "Fill in the Blanks",
    levelName: "Shloka challenge",
  });

  if (outcome !== "won") return;

  const breakdown = {
    wordPoints: 0,
    completionPoints: finalScore,
    speedBonus: 0,
    hintPenalty: 0,
    total: finalScore,
    elapsedSeconds: completedIn,
    hintsUsed: 0,
    stars:
      completedIn < 20
        ? 3
        : completedIn < 40
          ? 2
          : 1,
  };

  showScorePopup({
    title: `श्लोकः ${source.verse.ch}.${source.verse.vn}`,
    breakdown,
    bestScore: finalScore,
    leaderboard:
      `Round score: ${finalScore}/100. Not submitted to leaderboard.`,
    submittingScore: false,

    onReplay: () => {
      closeScorePopup();
      start();
    },

    onViewLeaderboard: () => {
      window.location.assign(
        "../../leaderboard/index.html",
      );
    },

    onBack: () => {
      window.location.assign("../../");
    },
  });
}

function showDailyShlokaReferences() {
  const references = source.dailyVerses.map((verse) => {
    const isCurrent =
      String(verse.id) === String(source.verse.id);

    return (
      `Chapter ${verse.ch}, Verse ${verse.vn}` +
      (isCurrent ? " (current)" : "")
    );
  });

  $("dailyShlokaReferences").textContent =
    `Daily shlokas: ${references.join(" • ")}`;
}

function start() {
  clearCompletedScoreShare();
  try {
    const puzzle = makePuzzle(source.text, source.previous, source.next);
    clearInterval(timer);
    run = createRun(puzzle);
    selected = 0;
    $("intro").hidden = true;
    $("board").hidden = false;
    showDailyShlokaReferences();
    $("result").hidden = true;
    $("meaningSection").hidden = true;
    $("meaningText").textContent = "";
    $("time").textContent = "1:00";
    $("time").classList.remove("time-warning");
    say("Select a blank, then choose its missing word.");
    render();
    timer = setInterval(updateTime, 200);
  } catch (error) {
    say(error.message, "error");
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
try {
  const { loadChallengeSource } = await import("./shloka-source.js");
  source = await loadChallengeSource();
  makePuzzle(source.text, source.previous, source.next); // Validate before offering a timed round.
  $("start").disabled = false;
  $("start").textContent = "Start Game";
  say("Ready. Your 60 seconds begin when you press Start Game.");
} catch (error) {
  $("start").textContent = "Shloka unavailable";
  say(
    error.message ||
      "Unable to load a playable shloka. Reopen the game from the shloka page.",
    "error",
  );
  console.error("[fill-in-the-blank]", error);
}
