import type { Language } from '../types/gameTypes';
import type { GitaPuzzle } from '../services/gitaContentService';

type Props = { puzzles: GitaPuzzle[]; active: number; completed: Set<string>; onSelect: (index: number) => void; language: Language };
export default function ShlokaSidebar({ puzzles, active, completed, onSelect, language }: Props) {
  return <section className="shloka-sidebar">
    <h2>{language === 'sa' ? 'श्लोकाः' : 'Shlokas'}</h2>
    <p>{language === 'sa' ? 'अस्य दिवसस्य श्लोकयुगलम्' : 'Selected day’s shlokas'}</p>
    <nav aria-label={language === 'sa' ? 'श्लोकं चिनोतु' : 'Choose a shloka'}>
      {puzzles.map((puzzle, index) => <button key={puzzle.id} type="button" className={index === active ? 'active' : ''} aria-current={index === active ? 'page' : undefined} onClick={() => onSelect(index)}>
        <span>{language === 'sa' ? 'श्लोकः' : 'Shloka'} {puzzle.reference}</span>
        {completed.has(puzzle.id) && <span aria-label={language === 'sa' ? 'समाप्तम्' : 'Completed'}>✓</span>}
      </button>)}
    </nav>
  </section>;
}
