import {
  auth,
  db,
} from "../../auth/api/firebase-config.js";

import {
  doc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const GAME_ID = "059-fitb";
const GAME_NAME = "Fill in the Blank";

// Wait for Firebase to restore the signed-in account.
export async function prepareLeaderboard() {
  await auth.authStateReady();
}

export function getPlayerUid() {
  return auth.currentUser?.uid ?? null;
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isBetter(candidate, current) {
  if (!current) {
    return true;
  }

  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }

  return candidate.elapsedMs < current.elapsedMs;
}

// Read the user's best result for this local calendar day.
function findTodaysBest(history, uid, day) {
  let best = null;

  for (const [key, rawScore] of Object.entries(
    history.entries ?? {},
  )) {
    const meta = history.attemptMeta?.[key] ?? {};
    const parts = key.split("_");

    const owner = meta.uid ?? parts[1];
    const timestamp = Number(
      meta.completedAt ?? parts[0],
    );

    const recordDay =
      meta.localDate ?? localDateKey(timestamp);

    const score = Number(rawScore);

    // New FITB records retain millisecond precision.
    // Existing records fall back to their recorded seconds.
    const elapsedMs = Number.isInteger(meta.elapsedMs)
      ? meta.elapsedMs
      : Number(parts[2]) * 1000;

    if (
      owner !== uid ||
      recordDay !== day ||
      !Number.isFinite(score) ||
      !Number.isFinite(elapsedMs)
    ) {
      continue;
    }

    const candidate = { score, elapsedMs };

    if (isBetter(candidate, best)) {
      best = candidate;
    }
  }

  return best;
}

export async function saveDailyImprovement({
  uid,
  score,
  elapsedMs,
  completedAt,
  outcome,
}) {
  await prepareLeaderboard();

  // Do not save a round under a different account.
  if (!uid || getPlayerUid() !== uid) {
    return {
      saved: false,
      reason: "not-signed-in",
    };
  }

  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100 ||
    !Number.isInteger(elapsedMs) ||
    elapsedMs < 0 ||
    elapsedMs > 60000 ||
    !Number.isSafeInteger(completedAt) ||
    completedAt <= 0 ||
    !["won", "lost", "timeout"].includes(outcome)
  ) {
    throw new Error("Invalid completed-round result.");
  }

  const localDate = localDateKey(completedAt);
  const monthId = localDate.slice(0, 7);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const gameParent = doc(
    db,
    "leaderboards",
    GAME_ID,
  );

  const globalParent = doc(
    db,
    "leaderboards",
    "Global",
  );

  const gameHistory = doc(
    db,
    "leaderboards",
    GAME_ID,
    "gameHistory",
    monthId,
  );

  const globalHistory = doc(
    db,
    "leaderboards",
    "Global",
    "gameHistory",
    monthId,
  );

  return runTransaction(db, async (transaction) => {
    // Read everything before writing.
    // If another tab changes the history, Firebase retries
    // this comparison against the updated records.
    const gameSnapshot =
      await transaction.get(gameHistory);

    const globalSnapshot =
      await transaction.get(globalHistory);

    const gameParentSnapshot =
      await transaction.get(gameParent);

    const globalParentSnapshot =
      await transaction.get(globalParent);

    const history = gameSnapshot.data() ?? {};
    const global = globalSnapshot.data() ?? {};

    const best = findTodaysBest(
      history,
      uid,
      localDate,
    );

    const candidate = { score, elapsedMs };

    // Worse scores, slower ties and exact ties do not write.
    if (!isBetter(candidate, best)) {
      return {
        saved: false,
        reason: "not-improved",
        best,
      };
    }

    // Preserve the existing leaderboard key format.
    let keyTimestamp = completedAt;
    let entryKey;

    do {
      entryKey =
        `${keyTimestamp}_${uid}_${elapsedSeconds}_${GAME_ID}`;

      keyTimestamp++;
    } while (
      Object.hasOwn(history.entries ?? {}, entryKey) ||
      Object.hasOwn(global.entries ?? {}, entryKey)
    );

    // Register the game without changing existing labels.
    for (const [reference, snapshot, label] of [
      [gameParent, gameParentSnapshot, GAME_NAME],
      [globalParent, globalParentSnapshot, "Global"],
    ]) {
      if (snapshot.exists()) {
        transaction.update(reference, {
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(reference, {
          label,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const attempt = {
      uid,
      gameId: GAME_ID,
      gameName: GAME_NAME,
      levelId: null,
      levelName: null,
      result: outcome === "won" ? "completed" : outcome,
      completedAt,
      elapsedSeconds,
      elapsedMs,
      localDate,
    };

    const update = {
      entries: {
        [entryKey]: score,
      },

      attemptMeta: {
        [entryKey]: attempt,
      },

      lastEntryKey: entryKey,
      updatedAt: serverTimestamp(),
    };

    // Both leaderboard copies are saved together.
    transaction.set(gameHistory, update, {
      merge: true,
    });

    transaction.set(globalHistory, update, {
      merge: true,
    });

    return {
      saved: true,
      best: candidate,
    };
  });
}