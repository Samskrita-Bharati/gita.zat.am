import type { Language, ScoreBreakdown } from '../types/gameTypes';
import ScoreBreakdownView from './ScoreBreakdown';
import { tr } from '../i18n';

type Props = {
  open: boolean;
  theme: string;
  breakdown: ScoreBreakdown | null;
  bestScore: number;
  onReplay: () => void;
  onViewLeaderboard: () => void;
  onBack: () => void;
  leaderboard: string;
  submittingScore: boolean;
  language: Language;
};

export default function ResultsModal(props: Props) {
  const { breakdown, language, submittingScore } = props;
  if (!props.open || !breakdown) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="result-card">
        <div className="result-confetti">✦</div>
        <small>{tr(language, 'puzzleComplete')}</small>
        <h2>{props.theme}</h2>

        <div className="stars">
          {[1, 2, 3].map((star) => (
            <span key={star} className={star <= breakdown.stars ? 'earned' : ''}>
              ★
            </span>
          ))}
        </div>

        <div className="result-score">
          {breakdown.total}
          <span>{tr(language, 'pointsThisRun')}</span>
        </div>

        <ScoreBreakdownView
          breakdown={breakdown}
          bestScore={props.bestScore}
          language={language}
        />

        {props.leaderboard && (
          <p className="leader-msg" role="status">{props.leaderboard}</p>
        )}

        <div className="result-actions three-actions">
          <button disabled={submittingScore} onClick={props.onBack}>
            {tr(language, 'games')}
          </button>
          <button disabled={submittingScore} onClick={props.onViewLeaderboard}>
            {language === 'sa' ? 'अङ्कतालिकां पश्यतु' : 'View Leaderboard'}
          </button>
          <button disabled={submittingScore} onClick={props.onReplay}>
            {tr(language, 'replay')}
          </button>
        </div>
      </div>
    </div>
  );
}