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
  assert.equal(result.url,'https://gg.zat.am/games/018-as/');
});

test('cumulative points may exceed 100; only actual numeric rankings are included',()=>{
  const result=normalizeShareResult({score:285,scoreType:'cumulative',gameId:'strands',rank:3,levels:4});
  assert.equal(result.score,285);assert.equal(result.rank,3);assert.equal(result.levels,4);
});

test('typing uses a duration card instead of fabricating a 0-100 leaderboard score',()=>{
  const result=normalizeShareResult({score:124,scoreType:'completion',gameId:'057-gita-typing'});
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
  for (const selector of ['#successMessage','#finishMessage','#result']) assert.ok(shareSource.includes(selector));
  assert.match(shareSource,/actionRow\.prepend\(button\)/);
  assert.doesNotMatch(css,/\.gg-score-share-shortcut\s*\{/);
  assert.match(shareSource,/\['z18','strands','057-gita-typing'\]/);
});

test('mobile sharing sends an actual PNG file and social fallbacks explain manual attachment',()=>{
  const shareSource=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  assert.match(shareSource,/navigator\.canShare\?\.\(\{files:\[previewFile\]\}\)/);
  assert.match(shareSource,/navigator\.share\(\{files:\[previewFile\]/);
  assert.match(shareSource,/downloadImage\(\)/);
  assert.match(shareSource,/attach the image/);
  assert.match(shareSource,/ClipboardItem/);
});

test('Strands and ZIM share actions are contextual and do not modify scoring functions',()=>{
  const strands=readFileSync(new URL('../games/strands/share-bridge.js',import.meta.url),'utf8');
  const z18=readFileSync(new URL('../games/z18/index.html',import.meta.url),'utf8');
  assert.match(strands,/card\.insertBefore\(shareButton, actions\)/);
  assert.match(strands,/openCompletedScoreShare\(\)/);
  assert.match(z18,/z18-result-share"\)\.addEventListener\("click", \(\) => openScoreShare/);
  assert.match(z18,/submitGameScore\(finalScore/);
});


test('Z18 finished-score dialog is responsive and keeps scoring/replay intact',()=>{
  const source=readFileSync(new URL('../games/z18/index.html',import.meta.url),'utf8');
  assert.match(source,/z18-result-overlay/);
  assert.match(source,/z18-result-secondary-actions/);
  assert.match(source,/grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source,/role=\"status\" aria-live=\"polite\"/);
  assert.doesNotMatch(source,/const end = new Pane\(/);
  assert.match(source,/scoreFromPenalties\(\{ mistakes: extraMoves, hints: giveUpCount, mistakePenalty: 2, hintPenalty: GAME_CONFIG.revealedWordPenalty \}\)/);
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
  assert.match(shareSource,/window\.addEventListener\('zatam:share-identity', activeIdentityListener\)/);
  assert.match(shareSource,/checkbox\.disabled = !nextName/);
  assert.match(shareSource,/checkbox\.checked = false/);
  assert.doesNotMatch(shareSource,/\.email\.split\('@'\)/);
});


test('scorecard generation status is outside the preview and accessible without overlay',()=>{
  const shareSource=readFileSync(new URL('../games/shared/score-share.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../games/shared/score-share.css',import.meta.url),'utf8');
  assert.match(shareSource,/preview\.append\(image\)/);
  assert.match(shareSource,/dialog\.append\(top,description,preview,renderStatus,privacy/);
  assert.match(shareSource,/renderStatus\.setAttribute\('role','status'\)/);
  assert.match(shareSource,/preview\.setAttribute\('aria-busy'/);
  assert.match(shareSource,/updateRenderStatus\('loading'/);
  assert.match(shareSource,/updateRenderStatus\('ready','Ready to share'\)/);
  assert.doesNotMatch(shareSource,/preview\.append\(image,loading\)/);
  assert.doesNotMatch(css,/\.gg-share-loading\s*\{[^}]*position\s*:\s*absolute/);
  assert.match(css,/\.gg-share-render-spinner\[hidden\]\s*\{display:none\}/);
});
