const start = document.getElementById("start");
const reference = document.getElementById("reference");
const quote = document.getElementById("quote");
const input = document.getElementById("typedValue");
const message = document.getElementById("message");
const meaning = document.getElementById("meaning");

let gameData;
let round;
let wordElements = [];
let wordIndex = 0;
let mistakes = 0;
let playing = false;

input.hidden = true;

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.json();
}

async function loadGameData() {
  const [schedule, verses, typing, scorer] = await Promise.all([
    import("../../shlokasToday/daily-schedule.mjs"),
    fetchJson("../../assets/bhagavad-gita-verses.json"),
    fetchJson("./bhagavadgita.txt"),
    import("../shared/game-score.js").catch((error) => {
      console.error("Could not load the leaderboard.", error);
      return null;
    }),
  ]);

  return { schedule, verses, typing, scorer };
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function verseLabel(verse) {
  return `Chapter ${verse.ch}, Shloka ${verse.vn}`;
}

function getTypingVerse(verse, typing) {
  const chapterIndex = verse.ch - 1;
  const isChapter13Opening = verse.ch === 13 && verse.vn === 1;

  // The typing text omits Chapter 13's opening verse.
  // The English translation includes it.
  const textIndex = verse.vn - (verse.ch === 13 ? 2 : 1);
  const text = isChapter13Opening
    ? "arjuna uvAca, prakRtiM puruSaM caiva kSetraM kSetrajJameva ca, etadveditumicchAmi jJAnaM jJeyaM ca kezava"
    : typing.shlokas[chapterIndex]?.[textIndex];

  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`Typing text is unavailable for ${verseLabel(verse)}.`);
  }

  return {
    verse,
    text,
    translation: typing.meanings[chapterIndex]?.[verse.vn - 1],
  };
}

function renderVerses(verses) {
  quote.replaceChildren();
  wordElements = [];

  for (const [index, item] of verses.entries()) {
    const section = document.createElement("section");
    section.className = "typing-verse";

    const heading = document.createElement("h2");
    heading.textContent = `${index + 1}. ${verseLabel(item.verse)}`;
    section.append(heading);

    for (const line of item.text.split(",")) {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (!words.length) continue;

      const row = document.createElement("p");
      for (const word of words) {
        const span = document.createElement("span");
        span.textContent = word;
        wordElements.push(span);
        row.append(span, " ");
      }
      section.append(row);
    }

    quote.append(section);
  }
}

function showMeanings(verses) {
  const title = document.createElement("h2");
  title.textContent = "English Meanings";
  meaning.replaceChildren(title);

  for (const item of verses) {
    const heading = document.createElement("h3");
    heading.textContent = verseLabel(item.verse);

    const translation = document.createElement("p");
    translation.textContent = item.translation || "English translation unavailable.";

    meaning.append(heading, translation);
  }
}

start.addEventListener("click", async () => {
  start.disabled = true;
  message.textContent = "Loading today’s shlokas…";

  try {
    gameData ??= await loadGameData();

    const today = new Date();
    const scheduled = gameData.schedule.getDailySchedule(gameData.verses, today);
    if (scheduled.verses.length !== 2) {
      throw new Error("There are no scheduled shlokas for today.");
    }

    round = {
      date: localDateKey(today),
      verses: scheduled.verses.map((verse) => getTypingVerse(verse, gameData.typing)),
    };

    renderVerses(round.verses);
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
    start.disabled = false;
    return;
  }

  wordIndex = 0;
  mistakes = 0;
  reference.textContent = `Daily challenge · ${round.date}`;
  meaning.replaceChildren();
  message.textContent = "";
  input.value = "";
  input.removeAttribute("aria-invalid");
  wordElements[0].classList.add("highlight");

  gameData.scorer?.initGameScore({
    gameId: "057-gita-typing",
    gameName: "Gita Typing",
  });

  playing = true;
  start.hidden = true;
  input.hidden = false;
  input.focus();
});

input.addEventListener("input", (event) => {
  if (!playing || event.isComposing) return;

  const currentWord = wordElements[wordIndex];
  const expected = currentWord.textContent;
  const typed = input.value.trim();

  if (typed !== expected) {
    if (expected.startsWith(typed)) {
      input.removeAttribute("aria-invalid");
    } else if (!input.hasAttribute("aria-invalid")) {
      mistakes += 1;
      input.setAttribute("aria-invalid", "true");
    }
    return;
  }

  input.value = "";
  input.removeAttribute("aria-invalid");
  currentWord.classList.remove("highlight");
  wordIndex += 1;

  if (wordIndex < wordElements.length) {
    wordElements[wordIndex].classList.add("highlight");
  } else {
    void finishRound();
  }
});

async function finishRound() {
  playing = false;
  input.hidden = true;
  showMeanings(round.verses);

  const score = Math.max(0, 100 - mistakes * 5);
  const summary = `Both shlokas complete! ${score}/100 · Mistakes: ${mistakes}`;
  message.textContent = summary;

  start.textContent = "Replay";
  start.hidden = false;
  start.disabled = true;

  try {
    if (!gameData.scorer) {
      message.textContent = `${summary} · Leaderboard unavailable.`;
      return;
    }

    message.textContent = `${summary} · Saving…`;

    const [first, second] = round.verses;
    const result = await gameData.scorer.submitGameScore(score, {
      levelId: round.date,
      levelName: `Daily Typing · ${round.date}`,
      metrics: {
        mistakes,
        puzzleDate: round.date,
        firstShlokaId: first.verse.id,
        secondShlokaId: second.verse.id,
      },
    });

    message.textContent = result.ok
      ? `${summary} · Score saved to the leaderboard.`
      : `${summary} · Score could not be saved.`;
  } catch (error) {
    console.error("Could not confirm the leaderboard save.", error);
    message.textContent = `${summary} · Could not confirm the leaderboard save.`;
  } finally {
    start.disabled = false;
    start.focus();
  }
}