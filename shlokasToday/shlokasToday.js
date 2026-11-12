// Daily shloka display. Replace getTodayVerses when date based selection is ready.
export async function initializeShlokasToday() {
  const container = document.getElementById("todayVerses");
  if (!container) return;

  try {
    const response = await fetch(new URL("../assets/verse.json", import.meta.url));
    if (!response.ok) throw new Error(`Verse data request failed: ${response.status}`);

    const verses = await response.json();
    if (!Array.isArray(verses) || verses.length < 2) {
      throw new Error("Verse data must contain at least two verses.");
    }

    container.replaceChildren(...getTodayVerses(verses).map(createVerseCard));
  } catch (error) {
    container.textContent = "Today's shlokas could not be loaded.";
    console.error(error);
  }
}

function getTodayVerses(verses) {
  return verses.slice(0, 2);
}

function createVerseCard(verse) {
  const card = document.createElement("article");
  card.className = "today-verse-card";

  const reference = document.createElement("p");
  reference.className = "today-verse-reference";
  reference.textContent = `Chapter ${verse.chapter_number}, Verse ${verse.verse_number}`;

  const text = document.createElement("p");
  text.className = "today-verse-text";
  text.textContent = verse.text?.trim() || "";

  const transliteration = document.createElement("p");
  transliteration.className = "today-verse-transliteration";
  transliteration.textContent = verse.transliteration?.trim() || "";

  card.append(reference, text, transliteration);
  return card;
}
