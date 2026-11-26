import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeShareResult} from '../games/shared/score-share.js';

test('individual completion shares the score, not invented rank or player name',()=>{
  const result=normalizeShareResult({score:95,gameId:'018-as',gameName:'सुभाषितम्'});
  assert.equal(result.score,95);
  assert.equal(result.scoreType,'game');
  assert.equal(result.rank,null);
  assert.equal(result.playerName,'');
  assert.equal(result.url,'https://gg.zat.am/games/02-arrange/');
});

test('cumulative points may exceed 100; only actual numeric rankings are included',()=>{
  const result=normalizeShareResult({score:285,scoreType:'cumulative',gameId:'strands',rank:3,levels:4});
  assert.equal(result.score,285);assert.equal(result.rank,3);assert.equal(result.levels,4);
});

test('typing uses a duration card instead of fabricating a 0-100 leaderboard score',()=>{
  const result=normalizeShareResult({score:124,scoreType:'completion',gameId:'07-gitaTyping'});
  assert.equal(result.scoreType,'completion');assert.equal(result.score,124);
});

test('only approved project URLs are emitted and names have bounded length',()=>{
  const result=normalizeShareResult({score:80,gameId:'../unsafe?x=1',playerName:'X'.repeat(200)});
  assert.ok(result.url.startsWith('https://gg.zat.am/games/'));
  assert.equal(result.playerName.length,64);
  assert.equal(normalizeShareResult({score:1234,scoreType:'overall'}).url,'https://gg.zat.am/leaderboard/');
  assert.throws(()=>normalizeShareResult({score:-1}),TypeError);
});

test('share module requires no Firebase service or game-scoring import',()=>{
  const source=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/firebase-|getDocs\(|setDoc\(|writeBatch\(/);
});

test('share control uses completed-result containers, not a floating viewport button',()=>{
  const shareSource=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../games/shared/score-share.css',import.meta.url),'utf8');
  for (const selector of ['#successMessage','#finishMessage','#result','01-wordSearch']) assert.ok(shareSource.includes(selector));
  assert.match(shareSource,/actionRow\.prepend\(button\)/);
  assert.doesNotMatch(css,/\.gg-score-share-shortcut\s*\{/);
  assert.match(shareSource,/\["z18",\s*"strands",\s*"07-gitaTyping"\]/);
});

test('mobile sharing sends an actual PNG file and social fallbacks explain manual attachment',()=>{
  const shareSource=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  assert.match(shareSource,/navigator\.canShare\?\.\(\{\s*files:\s*\[previewFile\]\s*\}\)/);
  assert.match(shareSource,/navigator\s*\.share\(\{\s*files:\s*\[previewFile\]/);
  assert.match(shareSource,/downloadImage\(\)/);
  assert.match(shareSource,/attach the image/);
  assert.match(shareSource,/ClipboardItem/);
});

test('Strands and ZIM share actions are contextual and do not modify scoring functions',()=>{
  const strands=readFileSync(new URL('../games/04-suutram/share-bridge.js',import.meta.url),'utf8');
  const z18=readFileSync(new URL('../games/06-wordScramble/index.html',import.meta.url),'utf8');
  assert.match(strands,/card\.insertBefore\(shareButton, actions\)/);
  assert.match(strands,/openCompletedScoreShare\(\)/);
  assert.match(z18,/z18-result-share"\)\.addEventListener\("click", \(\) => openScoreShare/);
  assert.match(z18,/submitGameScore\(finalScore/);
});


test('Z18 finished-score dialog is responsive and keeps scoring/replay intact',()=>{
  const source=readFileSync(new URL('../games/06-wordScramble/index.html',import.meta.url),'utf8');
  assert.match(source,/z18-result-overlay/);
  assert.match(source,/z18-result-secondary-actions/);
  assert.match(source,/grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source,/role=\"status\" aria-live=\"polite\"/);
  assert.doesNotMatch(source,/const end = new Pane\(/);
  assert.match(source,/scoreFromPenalties\(\{\s*mistakes:\s*extraMoves,\s*hints:\s*giveUpCount,\s*mistakePenalty:\s*2,\s*hintPenalty:\s*GAME_CONFIG\.revealedWordPenalty,?\s*\}\)/);
  assert.match(source,/submitGameScore\(finalScore, \{/);
  assert.match(source,/window\.location\.reload\(\)/);
});


test('share checkbox resolves the signed-in public profile name and reacts to late profile loading',()=>{
  const shareSource=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  const navbar=readFileSync(new URL('../navbar/navbar-auth.js',import.meta.url),'utf8');
  assert.match(navbar,/publishShareIdentity\(user, profile\)/);
  assert.match(navbar,/publishShareIdentity\(null\)/);
  assert.match(navbar,/savedName \|\| authName/);
  assert.match(shareSource,/currentPlayerName\(\) \|\| data\.playerName/);
  assert.match(shareSource,/window\.addEventListener\(["']zatam:share-identity["'],\s*activeIdentityListener\)/);
  assert.match(shareSource,/checkbox\.disabled = !nextName/);
  assert.match(shareSource,/checkbox\.checked = false/);
  assert.doesNotMatch(shareSource,/\.email\.split\('@'\)/);
});


test('scorecard generation status is outside the preview and accessible without overlay',()=>{
  const shareSource=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../games/shared/score-share.css',import.meta.url),'utf8');
  assert.match(shareSource,/preview\.append\(image\)/);
  assert.match(shareSource,/dialog\.append\(\s*top,\s*description,\s*preview,\s*renderStatus,\s*privacy/);
  assert.match(shareSource,/renderStatus\.setAttribute\(["']role["'],\s*["']status["']\)/);
  assert.match(shareSource,/preview\.setAttribute\(["']aria-busy["']/);
  assert.match(shareSource,/updateRenderStatus\(\s*["']loading["']/);
  assert.match(shareSource,/updateRenderStatus\(["']ready["'],\s*["']Ready to share["']\)/);
  assert.doesNotMatch(shareSource,/preview\.append\(image,loading\)/);
  assert.doesNotMatch(css,/\.gg-share-loading\s*\{[^}]*position\s*:\s*absolute/);
  assert.match(css,/\.gg-share-render-spinner\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
});


test('share URLs follow the current folders without changing legacy Firebase IDs', () => {
  const urls = {
    'fw':'01-wordSearch',
    '01-wordSearch':'01-wordSearch',
    '018-as':'02-arrange',
    'strands':'04-suutram',
    '059-fitb':'05-fillBlank',
    'z18':'06-wordScramble',
    '07-gitaTyping':'07-gitaTyping',
  };
  for (const [gameId, pageFolder] of Object.entries(urls)) {
    assert.equal(normalizeShareResult({score:90,gameId}).url,
      `https://gg.zat.am/games/${pageFolder}/`);
  }
});

test('all six active games retain a completed-game share integration', () => {
  const wordSearch = readFileSync(new URL('../games/01-wordSearch/index.html', import.meta.url), 'utf8');
  const arrange = readFileSync(new URL('../games/02-arrange/index.html', import.meta.url), 'utf8');
  const typing = readFileSync(new URL('../games/07-gitaTyping/script.js', import.meta.url), 'utf8');
  const strands = readFileSync(new URL('../games/04-suutram/index.html', import.meta.url), 'utf8');
  const fillBlank = readFileSync(new URL('../games/05-fillBlank/game.js', import.meta.url), 'utf8');
  const scrambler = readFileSync(new URL('../games/06-wordScramble/index.html', import.meta.url), 'utf8');
  const shareSource = readFileSync(new URL('../games/shared/score-share.js', import.meta.url), 'utf8');
  assert.match(wordSearch, /submitGameScore\(finalScore\)/);
  assert.match(shareSource, /"01-wordSearch": "#bp26CelebrateOverlay \.bp26CelebrateBox"/);
  assert.match(arrange, /submit: submitGameScore/);
  assert.match(typing, /showCompletedScoreShare/);
  assert.match(strands, /src="\.\/share-bridge\.js"/);
  assert.match(fillBlank, /showCompletedScoreShare/);
  assert.match(scrambler, /id="z18-result-share"/);
  assert.match(scrambler, /openScoreShare/);
});

// Regression: Word Search's real completion modal stays visible until closed,
// and the shared Share Score action lives in that same modal.
test('Word Search completion stays open with contextual Share Score button', () => {
  const html=readFileSync(new URL('../games/01-wordSearch/index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../games/01-wordSearch/css/find.css',import.meta.url),'utf8');
  const shared=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  assert.match(html,/id="bp26CelebrateOverlay"[\s\S]*?role="dialog"/);
  assert.match(html,/id="bp26CelebrateActions"/);
  assert.match(html,/id="bp26CelebrateScoreValue"/);
  assert.match(html,/scoreCard\.hidden = score === null/);
  assert.match(html,/overlay\.style\.display = "flex"/);
  assert.doesNotMatch(html,/setTimeout\(\(\) => \{\s*overlay\.style\.display = "none"/);
  assert.match(html,/closeBtn\?\.addEventListener\("click", closeCompletion\)/);
  assert.match(shared,/"01-wordSearch": "#bp26CelebrateOverlay \.bp26CelebrateBox"/);
  assert.match(shared,/actionRow\.prepend\(button\)/);
  assert.match(css,/#bp26CelebrateActions|\.bp26CelebrateActions/);
  assert.match(html,/submitGameScore\(finalScore\)/);
});
