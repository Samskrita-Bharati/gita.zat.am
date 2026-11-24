import type { Language, Theme } from '../types/gameTypes';
import { tr } from '../i18n';

type Props = { theme: Theme; found: Set<string>; revealed: Set<string>; language: Language; showAnswers?: boolean };
export default function WordPanel({ theme, found, revealed, language, showAnswers = false }: Props) {
  const required = theme.targets.filter(target => !target.bonus);
  const count = required.filter(target => found.has(target.id)).length;
  return <section className="word-panel">
    <div className="panel-title">
      <div><small>{tr(language, 'discoveries')}</small><strong>{showAnswers ? tr(language, 'answersShown') : `${count} ${tr(language, 'found')} • ${required.length - count} ${tr(language, 'left')}`}</strong></div>
      <span className="level-word-count">{required.length} {tr(language, 'words')}</span>
    </div>
    <div className="word-slot-list">
      {required.map(target => {
        const isFound = found.has(target.id);
        const visible = isFound || showAnswers;
        return <div key={target.id} className={`word-slot gita-word-slot ${isFound ? 'found' : ''} ${showAnswers && !isFound ? 'answer-revealed' : ''} ${revealed.has(target.id) && !visible ? 'hinted' : ''}`}>
          {visible ? <>
            <div className="found-word-copy"><strong lang="sa">{target.word}</strong></div>
            <span className="word-check">{isFound ? '✓' : '→'}</span>
          </> : <>
            <div className="blank-word" aria-label={tr(language, 'hiddenWord')}>{target.tokens.map((_, index) => <span key={index} className="blank-piece" />)}</div>
            <small className="slot-label">{tr(language, 'hiddenWord')}</small>
          </>}
        </div>;
      })}
    </div>
    <p className="discovery-help">{tr(language, 'discoveryHelp')}</p>
  </section>;
}
