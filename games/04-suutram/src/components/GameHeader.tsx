import type { Language } from '../types/gameTypes';
import { tr } from '../i18n';

type Props = {
  totalPoints: number;
  runPoints: number;
  bestScore: number;
  foundCount: number;
  requiredCount: number;
  language: Language;
};

// Game statistics only. Navigation, language and login belong to the portal navbar.
export default function GameHeader({ totalPoints, runPoints, bestScore, foundCount, requiredCount, language }: Props) {
  const title = language === 'sa' ? 'प्रगतिः' : 'Your progress';
  return (
    <section className="strands-score-panel" aria-label={title}>
      <h2>{title}</h2>
      <dl className="strands-score-list">
        <div><dt>{tr(language, 'thisRun')}</dt><dd>{runPoints}</dd></div>
        <div><dt>{tr(language, 'bestTheme')}</dt><dd>{bestScore}</dd></div>
        <div><dt>{tr(language, 'bestTotal')}</dt><dd>{totalPoints}</dd></div>
        <div><dt>{language === 'sa' ? 'लब्धाः शब्दाः' : 'Words found'}</dt><dd>{foundCount} / {requiredCount}</dd></div>
      </dl>
    </section>
  );
}
