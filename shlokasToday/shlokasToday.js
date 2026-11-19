import { getDailySchedule, SCHEDULE_START } from "./daily-schedule.mjs";

export async function initializeShlokasToday(games = []) {
  const container = document.getElementById("todayVerses");
  const dateValue = document.getElementById("shlokasDateValue");
  const previousButton = document.getElementById("previousShlokaDay");
  const nextButton = document.getElementById("nextShlokaDay");
  if (!container || !dateValue || !previousButton || !nextButton) return;

  try {
    const response = await fetch(new URL("../assets/bhagavad-gita-verses.json", import.meta.url));
    if (!response.ok) throw new Error(`Verse data request failed: ${response.status}`);

    const verses = await response.json();
    if (!Array.isArray(verses) || verses.length < 2) {
      throw new Error("Verse data must contain at least two verses.");
    }

    let viewedDate = new Date();
    viewedDate.setHours(0, 0, 0, 0);

    function renderDay() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day);
      const selectedDate = new Date(viewedDate);

      dateValue.textContent = new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(selectedDate);
      setDateLinkAvailability(previousButton, selectedDate > startDate);
      setDateLinkAvailability(nextButton, selectedDate < today);

      const schedule = getDailySchedule(verses, selectedDate);
      if (schedule.status === "upcoming") {
        container.replaceChildren(createUpcomingNotice());
      } else {
        container.replaceChildren(...schedule.verses.map((verse) => createVerseCard(verse, games)));
      }
    }

    previousButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (previousButton.getAttribute("aria-disabled") === "true") return;
      viewedDate.setDate(viewedDate.getDate() - 1);
      renderDay();
    });
    nextButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (nextButton.getAttribute("aria-disabled") === "true") return;
      viewedDate.setDate(viewedDate.getDate() + 1);
      renderDay();
    });
    renderDay();

    // Refresh at local midnight and when returning to a previously hidden tab.
    let refreshTimer;
    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      refreshTimer = setTimeout(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        if (viewedDate.getTime() === yesterday.getTime()) {
          viewedDate = new Date();
          viewedDate.setHours(0, 0, 0, 0);
        }
        renderDay();
        scheduleRefresh();
      }, Math.max(1, tomorrow.getTime() - Date.now()));
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        renderDay();
        scheduleRefresh();
      }
    });
    scheduleRefresh();
  } catch (error) {
    container.textContent = "Today's shlokas could not be loaded.";
    console.error(error);
  }
}

function setDateLinkAvailability(link, isAvailable) {
  if (isAvailable) {
    link.href = "#";
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  } else {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
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
    .replace(/(?:॥|।{1,2})?\s*\d+\.\d+\s*(?:॥|।{1,2})?\s*$/u, "")
    .trim();
}

function createVerseCard(verse, games) {
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

  const copy = document.createElement("div");
  copy.className = "today-verse-copy";
  copy.append(text, transliteration);

  const gamesRow = document.createElement("div");
  gamesRow.className = "today-verse-games-row";
  const label = document.createElement("span");
  label.textContent = "Play in game:";

  const chooser = document.createElement("div");
  chooser.className = "game-picker";
  chooser.setAttribute("role", "group");
  chooser.setAttribute("aria-label", "Choose a game");

  games.forEach((game) => {
    const option = document.createElement("a");
    option.className = "game-picker-option";
    option.setAttribute("aria-label", game.title.trim());
    option.title = game.title.trim();
    if (!/^https?:\/\//i.test(game.dir)) {
      const gameDirectory = game.dir.replace(/\/[^/]+\.html$/i, "").replace(/\/+$/, "");
      const cover = document.createElement("img");
      cover.src = `./${gameDirectory}/cover.jpg`;
      cover.alt = "";
      cover.loading = "lazy";
      cover.onerror = () => cover.remove();
      option.append(cover);
    }
    const href = /^https?:\/\//i.test(game.dir)
      ? game.dir
      : `./${game.dir}${game.dir.endsWith(".html") ? "" : "/"}`;
    const gameUrl = new URL(href, document.baseURI);
    gameUrl.searchParams.set("id", verse.id);
    option.href = gameUrl.href;
    chooser.append(option);
  });

  gamesRow.append(label, chooser);

  verseElement.append(reference, copy, gamesRow);
  return verseElement;
}
