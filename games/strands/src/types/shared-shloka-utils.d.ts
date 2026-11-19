declare module '*shared/shloka-utils.js' {
  export function getShlokaTextFromUrl(search?: string): Promise<string | null>;
  export function splitShlokaWords(text: string): string[];
  export function splitWordIntoGraphemes(word: string): string[];
}
declare module '*shlokasToday/shlokasToday.js' {
  export function cleanShlokaText(text?: string): string;
}
