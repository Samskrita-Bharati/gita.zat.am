import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const game = new URL('../', import.meta.url);
for (const path of ['../shared/shloka-utils.js', '../../shlokasToday/daily-schedule.mjs', '../../shlokasToday/shlokasToday.js', '../../assets/bhagavad-gita-verses.json']) {
  if (!existsSync(new URL(path, game))) throw new Error(`Missing shared portal file: ${path}. Merge the team's current main branch first.`);
}
const app = new URL('src/App.tsx', game);
let source = readFileSync(app, 'utf8');
if (!source.includes('loadPreviewPuzzles') && !source.includes('loadShlokaPuzzles')) {
  throw new Error('This update requires the previous Gita shloka preview checkpoint. No App changes were made.');
}
source = source.replaceAll('Sample preview', 'Shared shloka').replaceAll('पूर्वावलोकनम्', 'श्लोकः');
writeFileSync(app, source);
console.log('Shared loader prerequisites checked; preview labels updated. Existing layout preserved.');
console.log(`App: ${fileURLToPath(app)}`);
