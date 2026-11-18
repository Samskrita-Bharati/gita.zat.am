import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  Cell,
  ScoreBreakdown,
  Theme,
} from './types/gameTypes';
import { loadShlokaPuzzle } from './services/gitaContentService';
import type { GitaPuzzle } from './services/gitaContentService';

import { pathText, targetForPath } from './utils/board';



import { tr } from './i18n';
import { usePortalLanguage } from './hooks/usePortalLanguage';

import GameHeader from './components/GameHeader';

import StrandBoard from './components/StrandBoard';

import WordPanel from './components/WordPanel';

import HintPanel from './components/HintPanel';

import TimerCard, { speedBonusFor } from './components/TimerCard';

import ResultsModal from './components/ResultsModal';

import TutorialOverlay from './components/TutorialOverlay';

import ShowAnswerModal from './components/ShowAnswerModal';

import { generateBoard } from './utils/generateBoard';
import { seedFromId } from './utils/seededRandom';
import { leaderboardScore, prepareStrandsScoreRun } from './services/strandsLeaderboard';

import { applyHintCosts, SHLOKA_HINT_COST } from './utils/hintScore';

const COMPLETED_KEY =
  'gita-strands:completed:v1';

const BEST_SCORES_KEY =
  'gita-strands:best:v1';

const TUTORIAL_KEY =
  'gita-strands:tutorial-seen:v1';

function loadCompleted() {

  try {

    const value = JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]');

    return new Set<string>(Array.isArray(value) ? value : []);

  } catch { return new Set<string>(); }

}

function loadBestScores() {

  try {

    const value = JSON.parse(localStorage.getItem(BEST_SCORES_KEY) || '{}');

    return value && typeof value === 'object' ? value as Record<string,number> : {};

  } catch { return {}; }

}

export default function App() {

  const [sourceTheme,setSourceTheme] = useState<GitaPuzzle>();
  const [loadError,setLoadError] = useState('');

  const [selection,setSelection] = useState<Cell[]>([]);

  const [found,setFound] = useState(new Set<string>());

  const [revealed,setRevealed] = useState(new Set<string>());

  const [completed,setCompleted] = useState<Set<string>>(() => loadCompleted());

  const [bestScores,setBestScores] = useState<Record<string,number>>(() => loadBestScores());

  const [wordPoints,setWordPoints] = useState(0);

  const [hintsRemaining,setHintsRemaining] = useState(0);

  const [hintsUsed,setHintsUsed] = useState(0);
  const [shlokaRevealed, setShlokaRevealed] = useState(false);

  const [started,setStarted] = useState(false);

  const [elapsedSeconds,setElapsedSeconds] = useState(0);

  const [message,setMessage] = useState('');

  const [done,setDone] = useState(false);

  const [breakdown,setBreakdown] = useState<ScoreBreakdown|null>(null);

  const [leaderboard,setLeaderboard] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);
  const pendingScore = useRef(false);
  const scoreRun = useRef<ReturnType<typeof prepareStrandsScoreRun> | null>(null);
  const [pageSeed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0]);

  const language = usePortalLanguage();

  const [tutorialOpen,setTutorialOpen] = useState(() => localStorage.getItem(TUTORIAL_KEY) !== '1');

  const [boardFeedback,setBoardFeedback] = useState<''|'correct'|'wrong'>('');

  const [showAnswerConfirm,setShowAnswerConfirm] = useState(false);

  const [answerMode,setAnswerMode] = useState(false);

  const [boardVersion,setBoardVersion] = useState(0);

  const theme = useMemo(() => {
    if (!sourceTheme) return undefined;

    const generated = generateBoard(sourceTheme, seedFromId(`${sourceTheme.id}:${pageSeed}:${boardVersion}`));

    return generated;
  }, [sourceTheme, boardVersion, pageSeed]);

  const requiredTargets = useMemo(

  () => theme?.targets.filter((target) => !target.bonus) ?? [],

  [theme],

);

const foundRequiredCount = useMemo(

  () =>

    requiredTargets.filter((target) =>

      found.has(target.id),

    ).length,

  [requiredTargets, found],

);

  useEffect(() => {

    loadShlokaPuzzle()

      .then(setSourceTheme)

      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));

  }, []);

  useEffect(() => { localStorage.setItem(COMPLETED_KEY,JSON.stringify([...completed])); }, [completed]);

  useEffect(() => { localStorage.setItem(BEST_SCORES_KEY,JSON.stringify(bestScores)); }, [bestScores]);

  useEffect(() => {
    if (!sourceTheme) return;
    const url = new URL(window.location.href);
    url.searchParams.set('id', String(sourceTheme.verseId));
    window.history.replaceState(null, '', url);
  }, [sourceTheme]);

  function readyMessage() {

    return language === 'sa' ? 'समीपकोष्ठान् योजयित्वा श्लोकपदानि अन्वेषयतु।' : 'Connect adjacent letters to find the shloka words.';

  }

  function resetRun(nextTheme = theme) {
    scoreRun.current?.cancel();
    scoreRun.current = null;


    setSelection([]);

    setFound(new Set());

    setRevealed(new Set());

    setWordPoints(0);

    setHintsUsed(0);
    setShlokaRevealed(false);

    setHintsRemaining(nextTheme?.startingHints ?? 0);

    setStarted(true);

    setElapsedSeconds(0);

    setMessage(readyMessage());

    setDone(false);

    setBreakdown(null);

    setLeaderboard('');

    setBoardFeedback('');

    setShowAnswerConfirm(false);

    setAnswerMode(false);

  }

  function restartCurrentTheme() {
    setBoardVersion((version) => version + 1);
  }

  useEffect(() => {

    if (theme) resetRun(theme);

    // Each level/replay starts fresh; only completed levels and best scores persist.

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [boardVersion, sourceTheme?.id]);

  useEffect(() => {

    if (!started && !done) setMessage(readyMessage());

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [language]);

  useEffect(() => {

    if (!started || done || answerMode || tutorialOpen || !sourceTheme) return;
    scoreRun.current ??= prepareStrandsScoreRun(sourceTheme);

    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);

    return () => window.clearInterval(timer);

  }, [started,done,answerMode,tutorialOpen,sourceTheme,boardVersion]);

const hasInProgressRun = Boolean(

  theme &&

  started &&

  !done &&

  !answerMode &&

  foundRequiredCount < requiredTargets.length

);

  useEffect(() => {

    const warnBeforeUnload = (event:BeforeUnloadEvent) => {

      if (!hasInProgressRun && !pendingScore.current) return;

      event.preventDefault();

      event.returnValue = '';

    };

    window.addEventListener('beforeunload',warnBeforeUnload);

    return () => window.removeEventListener('beforeunload',warnBeforeUnload);

  }, [hasInProgressRun]);

  const totalBestPoints = useMemo(

    () => Object.values(bestScores).reduce((sum,score) => sum + (Number(score)||0),0),

    [bestScores]

  );

  const runDisplayPoints = breakdown?.total ?? wordPoints;

  function flashBoard(type:'correct'|'wrong') {

    setBoardFeedback('');

    window.requestAnimationFrame(() => {

      setBoardFeedback(type);

      window.setTimeout(() => setBoardFeedback(''), 420);

    });

  }

  function closeTutorial() {

    setTutorialOpen(false);

    localStorage.setItem(TUTORIAL_KEY,'1');

  }

  function calculateBreakdown(
    activeTheme: Theme,
    finalWordPoints: number,
  ): ScoreBreakdown {

    const speedBonus = speedBonusFor(activeTheme,elapsedSeconds);

    const { total, hintPenalty: penalty, hintsUsed: totalHintsUsed } = applyHintCosts(
      finalWordPoints + activeTheme.completionPoints + speedBonus,
      activeTheme.completionPoints,
      hintsUsed,
      activeTheme.hintPenalty,
      shlokaRevealed,
    );

    const minutes = elapsedSeconds / 60;

    const stars:1|2|3 =

      totalHintsUsed === 0 && minutes < 3 ? 3 :

      minutes < 6 ? 2 : 1;

    return {

      wordPoints:finalWordPoints,

      completionPoints:activeTheme.completionPoints,

      speedBonus,

      hintPenalty:penalty,

      total,

      elapsedSeconds,

      hintsUsed: totalHintsUsed,

      stars

    };

  }

  async function submit(path:Cell[]) {

    if (!theme || !sourceTheme || path.length === 0 || !started || done || pendingScore.current) {

      setSelection([]);

      return;

    }

    const target = targetForPath(theme,path);

    const selectedText = pathText(theme,path).trim();

    if (target && !found.has(target.id)) {

      flashBoard('correct');

      const nextFound = new Set(found).add(target.id);

    const gained = target.bonus

    ? theme.bonusWordPoints

    : target.featured

      ? theme.featuredWordPoints

      : theme.themeWordPoints;

      const nextWordPoints = wordPoints + gained;

      setFound(nextFound);

      setWordPoints(nextWordPoints);

      setRevealed((current) => {

        const next = new Set(current);

        next.delete(target.id);

        return next;

      });

      setMessage(

  target.bonus

    ? (

        language === 'sa'

          ? `अतिरिक्तशब्दः! ${target.word} +${gained}`

          : `Bonus word! ${target.word} — ${target.meaning} +${gained}`

      )

    : target.featured

      ? (

          language === 'sa'

            ? `विशिष्टशब्दः! ${target.word} +${gained}`

            : `Featured Word! ${target.word} — ${target.meaning} +${gained}`

        )

      : (

          language === 'sa'

            ? `${target.word} +${gained}`

            : `${target.word} — ${target.meaning} +${gained}`

        )

);

      const nextRequiredCount = requiredTargets.filter(

        (item) => nextFound.has(item.id),

      ).length;

      if (nextRequiredCount === requiredTargets.length) {

        const finalBreakdown = calculateBreakdown(theme,nextWordPoints);

        setBreakdown(finalBreakdown);

        setDone(true);

        const nextCompleted = new Set(completed).add(theme.id);

        setCompleted(nextCompleted);

        const previousBest = bestScores[theme.id] ?? 0;

        const nextBestScores = {...bestScores,[theme.id]:Math.max(previousBest,finalBreakdown.total)};

        setBestScores(nextBestScores);

        const maximum = theme.completionPoints + theme.maxSpeedBonus +
          requiredTargets.reduce((sum, word) => sum + (word.featured ? theme.featuredWordPoints : theme.themeWordPoints), 0);
        const onlineScore = leaderboardScore(finalBreakdown.total, maximum);
        const sa = language === 'sa';
        pendingScore.current = true;
        setSubmittingScore(true);
        setLeaderboard(sa ? 'अङ्काः प्रेष्यन्ते…' : 'Submitting leaderboard score…');
        setSelection([]);
        // The shared API uses the current URL to record verse completion.
        const url = new URL(window.location.href);
        url.searchParams.set('id', String(sourceTheme.verseId));
        window.history.replaceState(null, '', url);
        const run = scoreRun.current ??= prepareStrandsScoreRun(sourceTheme);
        const status = await run.submit(finalBreakdown, maximum);
        setLeaderboard(status === 'saved'
          ? (sa ? `अङ्काः रक्षिताः: ${onlineScore}/100` : `Leaderboard score saved: ${onlineScore}/100.`)
          : status === 'not-signed-in'
            ? (sa ? 'स्थानीयाङ्काः रक्षिताः। अङ्कप्रेषणाय प्रवेशं करोतु।' : 'Local score saved. Sign in before playing to submit leaderboard scores.')
            : (sa ? 'स्थानीयाङ्काः रक्षिताः। प्रेषणं न सुनिश्चितम्।' : 'Local score saved. Leaderboard submission could not be confirmed.'));
        pendingScore.current = false;
        setSubmittingScore(false);
        return;
      }

    } else if (target) {

      flashBoard('wrong');

      setMessage(language === 'sa' ? `${target.word} पूर्वमेव लब्धः।` : `${target.word} is already found.`);

    } else {

      flashBoard('wrong');

      setMessage(language === 'sa'

        ? (selectedText ? `“${selectedText}” अस्य विषयस्य शब्दः नास्ति।` : 'अन्यं पन्थानं प्रयतताम्।')

        : (selectedText ? `“${selectedText}” is not one of this shloka's target words.` : 'Try another path.'));

    }

    setSelection([]);

  }

  const canUseHints = Boolean(theme && started && !done && !answerMode && !tutorialOpen);
  const canUsePathHint = canUseHints && hintsRemaining > 0 && revealed.size === 0;

  function useHint() {
    if (!theme || !canUsePathHint) return;
    const target = requiredTargets.find((item) => !found.has(item.id));
    if (!target) return;
    setHintsRemaining((count) => count - 1);
    setHintsUsed((count) => count + 1);
    setRevealed(new Set([target.id]));
    setMessage(language === 'sa'
      ? `नीलमार्गम् अनुसरतु। अन्तिमाङ्काः −${theme.hintPenalty}।`
      : `Follow the blue arrow. Final score −${theme.hintPenalty}.`);
  }

  function revealShloka() {
    if (!canUseHints || shlokaRevealed) return;
    setShlokaRevealed(true);
    setMessage(language === 'sa'
      ? `पूर्णश्लोकः प्रकाशितः। अन्तिमाङ्काः −${SHLOKA_HINT_COST}।`
      : `Full shloka unlocked. Final score −${SHLOKA_HINT_COST}.`);
  }

  function requestShowAnswer() {

    if (done || answerMode) return;

    setShowAnswerConfirm(true);

  }

  function confirmShowAnswer() {

    if (!theme) return;

    setShowAnswerConfirm(false);

    setSelection([]);

    setFound(new Set());

    setRevealed(new Set(theme.targets.map((target) => target.id)));

    setWordPoints(0);

    setHintsUsed(0);
    setShlokaRevealed(false);

    setHintsRemaining(theme.startingHints);

    setStarted(false);

    setElapsedSeconds(0);

    setBreakdown(null);

    setLeaderboard('');

    setAnswerMode(true);

    setMessage(language === 'sa'

      ? 'उत्तरपन्थाः दर्शिताः। अस्य प्रयासस्य प्रगतिः न रक्षिता।'

      : 'Answer mode: this run has been cleared and will not count as a completion.');

  }

  if (loadError) return <main className="load-state"><h1>Gita Strands</h1><p>{loadError}</p></main>;

  if (!theme || !sourceTheme) return <main className="load-state"><h1>Gita Strands</h1><p>Loading puzzle data…</p></main>;

  return (

    <div className="portal-game-shell">

      <main className="game-main" style={{background:theme.background}}>

        <section className="theme-banner">

          <div className="theme-heading">

            <h2>{language === 'sa' ? theme.titleSanskrit : theme.titleEnglish}</h2>

          </div>

          <div className="theme-meta">

            <b>{theme.rows} × {theme.cols}</b>

            <b>{theme.targets.length} {tr(language, 'words')}</b>

            <button className="tutorial-help-btn" onClick={() => setTutorialOpen(true)} aria-label="How to play">?</button>

          </div>

        </section>

        <div className="game-grid">

          <section className="board-card">

            <div className="status-line">

              <div><small>{tr(language,'currentMessage')}</small><strong>{message}</strong></div>

                <span>

                  {answerMode

                    ? 'Answers shown'

                    : `${foundRequiredCount}/${requiredTargets.length} ${tr(language,'found')}`}

                </span>              </div>

            {!answerMode && (

<div

  className="level-progress"

  aria-label={`${foundRequiredCount} of ${requiredTargets.length} required words found`}

>

  <div

    className="level-progress-fill"

    style={{

      width: `${

        requiredTargets.length

          ? (foundRequiredCount / requiredTargets.length) * 100

          : 0

      }%`,

    }}

  />

</div>

)}

            <TimerCard

              elapsedSeconds={elapsedSeconds}

              language={language}

              theme={theme}

            />

            <StrandBoard

              theme={theme}

              selection={selection}

              found={found}

              revealed={revealed}

              disabled={!started || done || answerMode || tutorialOpen}

              onChange={setSelection}

              onSubmit={submit}

              language={language}

              feedback={boardFeedback}

              showAnswers={answerMode}

            />

            {answerMode && (

              <div className="answer-mode-bar">

                <div>

                  <strong>{language === 'sa' ? 'उत्तरमोड्' : 'Answer Mode'}</strong>

                  <span>{language === 'sa' ? 'अस्य प्रयासस्य अङ्काः न रक्ष्यन्ते।' : 'This run will not be saved or scored.'}</span>

                </div>

                <button onClick={restartCurrentTheme}>{language === 'sa' ? 'पुनः आरभताम्' : 'Restart Puzzle'}</button>

              </div>

            )}

          </section>

          <aside className="strands-right-sidebar" aria-label={language === 'sa' ? 'प्रगतिः शब्दाश्च' : 'Progress and words'}>
            <GameHeader
              totalPoints={totalBestPoints}
              runPoints={runDisplayPoints}
              bestScore={bestScores[theme.id] ?? 0}
              foundCount={foundRequiredCount}
              requiredCount={requiredTargets.length}
              language={language}
            />
            <HintPanel
              hintsRemaining={hintsRemaining}
              wordHintCost={theme.hintPenalty}
              shlokaHintCost={SHLOKA_HINT_COST}
              canHint={canUsePathHint}
              activeWordHint={!answerMode && revealed.size > 0}
              canReadShloka={canUseHints}
              shlokaText={shlokaRevealed ? sourceTheme.text : null}
              onHint={useHint}
              onRevealShloka={revealShloka}
              language={language}
              onShowAnswer={requestShowAnswer}
              canShowAnswer={!done && !answerMode && !tutorialOpen}
            />
            <WordPanel theme={theme} found={found} revealed={revealed} language={language} showAnswers={answerMode} />
          </aside>

        </div>

      </main>

      <ResultsModal

        open={done}

        theme={theme.titleSanskrit}

        breakdown={breakdown}

        bestScore={bestScores[theme.id] ?? 0}

        leaderboard={leaderboard}
        submittingScore={submittingScore}

        onReplay={restartCurrentTheme}

        onBack={() => window.location.assign(new URL('../../', window.location.href))}

        language={language}

      />

      <TutorialOverlay open={tutorialOpen && !answerMode && !showAnswerConfirm} language={language} onClose={closeTutorial} />

      <ShowAnswerModal

        open={showAnswerConfirm}

        language={language}

        onCancel={() => setShowAnswerConfirm(false)}

        onConfirm={confirmShowAnswer}

      />

    </div>

  );

}

