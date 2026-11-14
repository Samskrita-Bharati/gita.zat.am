import { getDailySchedule, SCHEDULE_START } from "./daily-schedule.mjs";

export async function initializeShlokasToday(games = []) {
  const container = document.getElementById("todayVerses");
  if (!container) return;

  try {
    const response = await fetch(new URL("../assets/bhagavad-gita-verses.json", import.meta.url));
    if (!response.ok) throw new Error(`Verse data request failed: ${response.status}`);

    const verses = await response.json();
    if (!Array.isArray(verses) || verses.length < 2) {
      throw new Error("Verse data must contain at least two verses.");
    }

    function renderToday() {
      const today = new Date();
      const dateParam = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
      const schedule = getDailySchedule(verses, today);
      if (schedule.status === "upcoming") {
        container.replaceChildren(createUpcomingNotice());
      } else if (schedule.status === "complete") {
        container.textContent = "The daily shloka schedule is complete.";
      } else {
        container.replaceChildren(...schedule.verses.map((verse) => createVerseCard(verse, games, dateParam)));
      }
    }

    renderToday();

    // Refresh at local midnight and when returning to a previously hidden tab.
    let refreshTimer;
    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      refreshTimer = setTimeout(() => {
        renderToday();
        scheduleRefresh();
      }, Math.max(1, tomorrow.getTime() - Date.now()));
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        renderToday();
        scheduleRefresh();
      }
    });
    scheduleRefresh();
  } catch (error) {
    container.textContent = "Today's shlokas could not be loaded.";
    console.error(error);
  }
}

function createUpcomingNotice() {
  const startDate = new Date(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day);
  const notice = document.createElement("article");
  notice.className = "upcoming-notice";

  const eyebrow = document.createElement("p");
  eyebrow.className = "upcoming-notice-eyebrow";
  eyebrow.textContent = "A daily practice";

  const title = document.createElement("h3");
  title.className = "upcoming-notice-title";
  title.textContent = "A little wisdom, every day.";

  const description = document.createElement("p");
  description.className = "upcoming-notice-description";
  description.textContent = "Discover two new Bhagavad Gita shlokas each day.";

  const dateLabel = document.createElement("p");
  dateLabel.className = "upcoming-notice-date";
  dateLabel.append("Beginning ");
  const date = document.createElement("time");
  date.dateTime = `${SCHEDULE_START.year}-${String(SCHEDULE_START.month).padStart(2, "0")}-${String(SCHEDULE_START.day).padStart(2, "0")}`;
  date.textContent = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(startDate);
  dateLabel.append(date);

  notice.append(eyebrow, title, description, dateLabel);
  return notice;
}

export function cleanShlokaText(value = "") {
  return value
    .replace(/(?:॥|।।)?\s*\d+\.\d+\s*(?:॥|।।)\s*$/u, "")
    .trim();
}

function createVerseCard(verse, games, dateParam) {
  const verseElement = document.createElement("article");
  verseElement.className = "today-verse";

  const reference = document.createElement("p");
  reference.className = "today-verse-reference";
  reference.textContent = `Chapter ${verse.ch}, Verse ${verse.vn}`;

  const text = document.createElement("p");
  text.className = "today-verse-text";
  text.textContent = cleanShlokaText(verse.txt).replace(/\n\s*\n/g, "\n");

  const transliteration = document.createElement("p");
  transliteration.className = "today-verse-transliteration";
  transliteration.textContent = cleanShlokaText(verse.trans);

  const gamesRow = document.createElement("div");
  gamesRow.className = "today-verse-games-row";
  const label = document.createElement("span");
  label.className = "today-verse-games-label";
  label.textContent = "Play in game:";

  let selectedGame = 0;
  const chooser = document.createElement("div");
  chooser.className = "game-picker";
  chooser.setAttribute("role", "group");
  chooser.setAttribute("aria-label", "Choose a game");

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "game-picker-arrow";
  previous.setAttribute("aria-label", "Previous game");
  previous.textContent = "‹";

  const viewport = document.createElement("div");
  viewport.className = "game-picker-viewport";
  const track = document.createElement("div");
  track.className = "game-picker-track";
  const options = games.map((game, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "game-picker-option";
    option.textContent = game.title.trim();
    option.setAttribute("aria-pressed", String(index === selectedGame));
    option.addEventListener("click", () => selectGame(index));
    track.append(option);
    return option;
  });
  viewport.append(track);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "game-picker-arrow";
  next.setAttribute("aria-label", "Next game");
  next.textContent = "›";

  const play = document.createElement("a");
  play.className = "play-btn game-picker-play";
  play.textContent = "▶";
  play.setAttribute("aria-label", "Play selected game");

  function selectGame(index) {
    selectedGame = (index + games.length) % games.length;
    options.forEach((option, optionIndex) => {
      option.setAttribute("aria-pressed", String(optionIndex === selectedGame));
    });
    track.style.transform = `translateX(-${selectedGame * 100}%)`;
    const game = games[selectedGame];
    const href = /^https?:\/\//i.test(game.dir)
      ? game.dir
      : `./${game.dir}${game.dir.endsWith(".html") ? "" : "/"}`;
    const gameUrl = new URL(href, document.baseURI);
    gameUrl.searchParams.set("date", dateParam);
    play.href = gameUrl.href;
  }
  previous.addEventListener("click", () => selectGame(selectedGame - 1));
  next.addEventListener("click", () => selectGame(selectedGame + 1));
  selectGame(selectedGame);

  chooser.append(previous, viewport, next);
  gamesRow.append(label, chooser, play);

  verseElement.append(reference, text, transliteration, gamesRow);
  return verseElement;
}
