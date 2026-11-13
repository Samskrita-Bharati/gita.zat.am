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
      const schedule = getDailySchedule(verses);
      if (schedule.status === "upcoming") {
        container.replaceChildren(createUpcomingNotice());
      } else if (schedule.status === "complete") {
        container.textContent = "The daily shloka schedule is complete.";
      } else {
        container.replaceChildren(...schedule.verses.map((verse) => createVerseCard(verse, games)));
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

  const gamesPrompt = document.createElement("p");
  gamesPrompt.className = "today-verse-games-prompt";
  gamesPrompt.textContent = "Play games with this verse";

  const gamesLinks = document.createElement("div");
  gamesLinks.className = "today-verse-games";
  for (const game of games) {
    const link = document.createElement("a");
    link.href = /^https?:\/\//i.test(game.dir)
      ? game.dir
      : `./${game.dir}${game.dir.endsWith(".html") ? "" : "/"}`;
    link.textContent = game.title.trim();
    gamesLinks.append(link);
  }

  verseElement.append(reference, text, transliteration, gamesPrompt, gamesLinks);
  return verseElement;
}
