import { copyFileSync, cpSync, renameSync, rmSync } from 'node:fs';

const game = new URL('../', import.meta.url);
const output = new URL('dist/games/strands/', game);
const page = new URL('index.html', output);

if (process.argv.includes('--publish')) {
  const assets = new URL('built/', game);
  // Replace only the generated Strands assets; the rest of the portal stays in place.
  rmSync(assets, { recursive: true, force: true });
  cpSync(new URL('built/', output), assets, { recursive: true });
  copyFileSync(page, new URL('index.html', game));
} else {
  renameSync(new URL('index.dev.html', output), page);
}
