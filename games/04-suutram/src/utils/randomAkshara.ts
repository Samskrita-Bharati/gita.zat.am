// Same approach as Word Search: random Sanskrit letters/syllables fill gaps.
// Use the board's seeded RNG so replay stays consistent for every player.
const VOWELS = ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ॠ', 'ए', 'ऐ', 'ओ', 'औ'];
const CONSONANTS = ['क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'क्ष', 'ज्ञ'];
const VOWEL_SIGNS = ['', 'ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ'];
function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}
export function randomAkshara(random: () => number): string {
  const vowel = random() < .25;
  const base = vowel ? pick(VOWELS, random) : pick(CONSONANTS, random) + pick(VOWEL_SIGNS, random);
  return base + (random() < .1 ? 'ः' : '');
}
