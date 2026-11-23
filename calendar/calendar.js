import { getDailySchedule, SCHEDULE_START } from "../shlokasToday/daily-schedule.mjs";
import { cleanShlokaText } from "../shlokasToday/shlokasToday.js";
import { auth, onAuthStateChanged } from "../auth/api/firebase-config.js";
import { getCompletedShlokaIds } from "../auth/api/streak.js";

const today = new Date();
const grid = document.getElementById("calendarGrid");
const details = document.getElementById("selectedDateVerses");
const gamePicker = document.getElementById("gamePicker");
const progressCachePrefix = "gita.shlokaProgress.v1.";
let loadedVerses;
let completedShlokaIds = new Set();
let loadedProgressMonth = "";
let progressRequestId = 0;
const progressReadsInFlight = new Map();

const cleanUrl = new URL(window.location.href);
cleanUrl.searchParams.delete("month");
cleanUrl.searchParams.delete("date");
window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);

const games = [
  { dir: "018-as", cover: "018-as/cover.svg", title: "Arrange" },
  { dir: "z18", cover: "z18/cover.svg", title: "BodhaPlay" },
  { dir: "059-fitb", cover: "059-fitb/cover.svg", title: "Fill in the Blank" },
  { dir: "fw/index.html", cover: "fw/cover.svg", title: "Word Search" },
  { dir: "strands", cover: "strands/cover.svg", title: "Suutram" },
];

function showGamePicker(anchor, verse) {
  gamePicker.replaceChildren();
  games.forEach((game) => {
    const link = document.createElement("a");
    link.className = "game-picker-option";
    link.href = `../games/${game.dir}${game.dir.endsWith(".html") ? "" : "/"}?id=${encodeURIComponent(verse.id)}`;
    link.setAttribute("aria-label", game.title);
    link.title = game.title;
    const icon = document.createElement("img");
    icon.src = `../games/${game.cover}`;
    icon.alt = game.title;
    link.appendChild(icon);
    gamePicker.appendChild(link);
  });
  gamePicker.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const width = gamePicker.offsetWidth;
  const height = gamePicker.offsetHeight;
  gamePicker.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  gamePicker.style.top = `${Math.max(8, rect.top - height - 8)}px`;
  gamePicker.querySelector("a")?.focus({ preventScroll: true });
}

document.addEventListener("click", (event) => {
  if (!gamePicker.hidden && !gamePicker.contains(event.target) && !event.target.closest(".verse-reference-link")) {
    gamePicker.hidden = true;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") gamePicker.hidden = true;
});

function isCompleted(verse) {
  return completedShlokaIds.has(String(verse.id));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
const firstCalendarMonth = new Date(SCHEDULE_START.year, SCHEDULE_START.month - 1, 1);
const lastCalendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

function getYearMonth(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function readProgressCache(userUid, month) {
  try {
    const cached = sessionStorage.getItem(`${progressCachePrefix}${userUid}_${month}`);
    if (cached === null) return null;
    const ids = JSON.parse(cached);
    return Array.isArray(ids) ? ids : null;
  } catch {
    return null;
  }
}

function writeProgressCache(userUid, month, ids) {
  try {
    sessionStorage.setItem(`${progressCachePrefix}${userUid}_${month}`, JSON.stringify(ids));
  } catch (error) {
    console.warn("[calendar] Could not cache shloka progress for this session:", error);
  }
}

function getCachedCompletedShlokas(userUid, month) {
  const cached = readProgressCache(userUid, month);
  if (cached !== null) return Promise.resolve(cached);

  const key = `${userUid}_${month}`;
  if (progressReadsInFlight.has(key)) return progressReadsInFlight.get(key);

  const request = getCompletedShlokaIds(userUid, month)
    .then((ids) => {
      writeProgressCache(userUid, month, ids);
      return ids;
    })
    .finally(() => progressReadsInFlight.delete(key));
  progressReadsInFlight.set(key, request);
  return request;
}

async function loadCompletedShlokas(user = auth.currentUser) {
  const month = getYearMonth(visibleMonth);
  const requestId = ++progressRequestId;
  if (loadedProgressMonth !== month) {
    completedShlokaIds = new Set();
    loadedProgressMonth = month;
    renderCalendar(loadedVerses);
  }
  if (!user) {
    completedShlokaIds = new Set();
    renderCalendar(loadedVerses);
    return;
  }

  try {
    const ids = await getCachedCompletedShlokas(user.uid, month);
    if (requestId !== progressRequestId || getYearMonth(visibleMonth) !== month || auth.currentUser?.uid !== user.uid) return;
    completedShlokaIds = new Set(ids.map(String));
    renderCalendar(loadedVerses);
  } catch (error) {
    if (requestId !== progressRequestId) return;
    completedShlokaIds = new Set();
    renderCalendar(loadedVerses);
    console.error("[calendar] Could not load shloka progress:", error);
  }
}

onAuthStateChanged(auth, (user) => {
  void loadCompletedShlokas(user);
});
window.addEventListener("focus", () => void loadCompletedShlokas());

document.getElementById("previousMonth").addEventListener("click", (event) => {
  event.preventDefault();
  if (visibleMonth <= firstCalendarMonth) return;
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderCalendar(loadedVerses);
  void loadCompletedShlokas();
});
document.getElementById("nextMonth").addEventListener("click", (event) => {
  event.preventDefault();
  if (visibleMonth >= lastCalendarMonth) return;
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderCalendar(loadedVerses);
  void loadCompletedShlokas();
});

function renderCalendar(verses) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = visibleMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  document.getElementById("monthHeading").textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(visibleMonth);
  const previousMonth = document.getElementById("previousMonth");
  const nextMonth = document.getElementById("nextMonth");
  const previousDisabled = visibleMonth <= firstCalendarMonth;
  const nextDisabled = visibleMonth >= lastCalendarMonth;
  previousMonth.setAttribute("aria-disabled", String(previousDisabled));
  previousMonth.tabIndex = previousDisabled ? -1 : 0;
  previousMonth.classList.toggle("disabled", previousDisabled);
  nextMonth.setAttribute("aria-disabled", String(nextDisabled));
  nextMonth.tabIndex = nextDisabled ? -1 : 0;
  nextMonth.classList.toggle("disabled", nextDisabled);
  grid.replaceChildren();

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday) => {
    const label = document.createElement("div");
    label.className = "weekday";
    label.textContent = weekday;
    label.setAttribute("role", "columnheader");
    grid.appendChild(label);
  });

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const number = cellIndex - firstDay + 1;
    const cell = document.createElement("div");
    cell.className = "day";
    cell.setAttribute("role", "gridcell");
    if (number >= 1 && number <= daysInMonth) {
      const date = new Date(year, month, number);
      const key = dateKey(date);
      if (key === dateKey(today)) cell.classList.add("today");
      const dayContent = document.createElement("div");
      dayContent.className = "day-link";
      const dayNumber = document.createElement("span");
      dayNumber.className = "day-number";
      dayNumber.textContent = number;
      dayContent.appendChild(dayNumber);
      if (verses && date <= selectedDate) {
        const schedule = getDailySchedule(verses, date);
        const references = document.createElement("span");
        references.className = "day-verses";
        schedule.verses.forEach((verse, index) => {
          if (index) references.appendChild(document.createElement("br"));
          const reference = document.createElement("a");
          reference.className = "verse-reference-link";
          const completed = isCompleted(verse);
          if (completed) reference.classList.add("completed");
          reference.href = "#";
          reference.textContent = `${verse.ch}.${verse.vn}`;
          reference.setAttribute("aria-label", `Choose a game for chapter ${verse.ch}, verse ${verse.vn}`);
          reference.addEventListener("click", (event) => {
            event.preventDefault();
            showGamePicker(reference, verse);
          });
          references.appendChild(reference);
          if (completed) {
            const checkmark = document.createElement("span");
            checkmark.className = "verse-completion-mark";
            checkmark.setAttribute("aria-label", "Completed");
            checkmark.textContent = " ✓";
            references.appendChild(checkmark);
          }
        });
        dayContent.appendChild(references);
      }
      cell.appendChild(dayContent);
    }
    grid.appendChild(cell);
  }
}

function renderDetails(verses) {
  document.getElementById("selectedDateHeading").textContent = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(selectedDate);
  const schedule = getDailySchedule(verses, selectedDate);
  if (schedule.status === "upcoming") {
    const start = new Date(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day);
    details.textContent = `Daily shlokas begin on ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(start)}.`;
    return;
  }
  details.replaceChildren(...schedule.verses.map((verse) => {
    const card = document.createElement("article");
    card.className = "calendar-verse";
    const heading = document.createElement("h3");
    heading.textContent = `Chapter ${verse.ch}, Verse ${verse.vn}`;
    const text = document.createElement("p");
    text.className = "calendar-verse-text";
    text.lang = "sa";
    text.textContent = cleanShlokaText(verse.txt).replace(/\n\s*\n/g, "\n");
    const transliteration = document.createElement("p");
    transliteration.className = "calendar-verse-transliteration";
    transliteration.textContent = cleanShlokaText(verse.trans);
    const status = document.createElement("p");
    status.className = "verse-completion";
    status.textContent = isCompleted(verse) ? "✓ Completed" : "Not completed yet";
    card.append(heading, text, transliteration, status);
    return card;
  }));
}

renderCalendar(null);
try {
  const response = await fetch(new URL("../assets/bhagavad-gita-verses.json", import.meta.url));
  if (!response.ok) throw new Error(`Verse data request failed: ${response.status}`);
  const verses = await response.json();
  if (!Array.isArray(verses) || verses.length < 2) throw new Error("Verse data must contain at least two verses.");
  loadedVerses = verses;
  renderCalendar(verses);
  renderDetails(verses);
} catch (error) {
  document.getElementById("calendarLoadStatus").textContent = "Shlokas could not be loaded. Please refresh the page to try again.";
  console.error(error);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void loadCompletedShlokas();
});
