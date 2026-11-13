import { loadVerses } from "../dailyChallenge/dailyChallenge.js";

export async function initializeShlokasToday(scheduleEntry) {
  const container = document.getElementById("todayVerses");
  if (!container) return;

  try {
    if (!Array.isArray(scheduleEntry?.shlokaIds) || scheduleEntry.shlokaIds.length < 2) {
      throw new Error("Today's schedule does not contain two shloka IDs.");
    }

    const verses = await loadVerses();
    const versesById = new Map(verses.map((verse) => [String(verse.id), verse]));
    const todayVerses = scheduleEntry.shlokaIds.map((id) => versesById.get(String(id)));

    if (todayVerses.some((verse) => !verse)) {
      throw new Error("Today's schedule references a shloka missing from verse.json.");
    }

    container.replaceChildren(...todayVerses.map(createVerseCard));
  } catch (error) {
    container.textContent = "Today's shlokas are not available.";
    console.error(error);
  }
}

function createVerseCard(verse) {
  const verseElement = document.createElement("article");
  verseElement.className = "today-verse";

  const reference = document.createElement("p");
  reference.className = "today-verse-reference";
  reference.textContent = `Chapter ${verse.ch}, Verse ${verse.vn}`;

  const text = document.createElement("p");
  text.className = "today-verse-text";
  text.textContent = verse.txt?.trim().replace(/\n\s*\n/g, "\n") || "";

  const transliteration = document.createElement("p");
  transliteration.className = "today-verse-transliteration";
  transliteration.textContent = verse.trans?.trim() || "";

  verseElement.append(reference, text, transliteration);
  return verseElement;
}
