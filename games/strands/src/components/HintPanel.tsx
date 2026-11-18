import { useRef } from 'react';
import type { Language } from '../types/gameTypes';
import { tr } from '../i18n';

type Props = {
  hintsRemaining: number;
  wordHintCost: number;
  shlokaHintCost: number;
  canHint: boolean;
  activeWordHint: boolean;
  canReadShloka: boolean;
  shlokaText: string | null;
  onHint: () => void;
  onRevealShloka: () => void;
  language: Language;
  onShowAnswer: () => void;
  canShowAnswer: boolean;
};

export default function HintPanel({
  hintsRemaining, wordHintCost, shlokaHintCost, canHint, activeWordHint,
  canReadShloka, shlokaText, onHint, onRevealShloka, language,
  onShowAnswer, canShowAnswer
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sa = language === 'sa';
  return (
    <section className="strands-hints" aria-labelledby="strands-hints-title">
      <h2 id="strands-hints-title">{tr(language, 'hints')}</h2>
      <button type="button" className="hint-btn" onClick={onHint} disabled={!canHint}>
        {sa ? '१. शब्दमार्गः' : '1. Show a word path'} <span>−{wordHintCost}</span>
      </button>
      <p>{activeWordHint
        ? (sa ? 'नीलमार्गम् अनुसरतु।' : 'Follow the blue arrow.')
        : (sa ? `${hintsRemaining} अवशिष्टाः` : `${hintsRemaining} path hints left`)}</p>
      <button type="button" className="hint-btn" disabled={!canReadShloka} onClick={() => {
        onRevealShloka();
        dialog.current?.showModal();
      }}>
        {sa ? '२. पूर्णश्लोकः' : '2. Read the full shloka'}
        <span>{shlokaText !== null ? (sa ? 'प्रकाशितः' : 'Unlocked') : `−${shlokaHintCost}`}</span>
      </button>
      <button type="button" className="answer-btn" onClick={onShowAnswer} disabled={!canShowAnswer}>
        {sa ? 'उत्तराणि दर्शयतु' : 'Show all answers (ends run)'}
      </button>
      <dialog ref={dialog} className="strands-shloka-dialog" aria-labelledby="strands-shloka-title">
        <h2 id="strands-shloka-title">{sa ? 'पूर्णश्लोकः' : 'Full shloka'}</h2>
        {shlokaText !== null && <p lang="sa">{shlokaText.replace(/\n(?:[^\S\n]*\n)+/g, '\n')}</p>}
        <form method="dialog"><button type="submit" className="answer-btn">{sa ? 'पिधानम्' : 'Close'}</button></form>
      </dialog>
    </section>
  );
}
