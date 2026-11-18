import type { Language } from '../types/gameTypes';

type Props = {
  open: boolean;
  language: Language;
  onClose: () => void;
};

export default function TutorialOverlay({ open, language, onClose }: Props) {
  if (!open) return null;
  const sa = language === 'sa';
  return (
    <div className="modal-backdrop tutorial-backdrop" role="dialog" aria-modal="true">
      <div className="tutorial-card">
        <div className="tutorial-badge">01</div>
        <small>{sa ? 'शीघ्रमार्गदर्शनम्' : 'QUICK TUTORIAL'}</small>
        <h2>{sa ? 'एवं क्रीडतु' : 'How to play'}</h2>

        <div className="tutorial-steps">
          <div>
            <b>1</b>
            <p>{sa ? 'प्रथमाक्षरे स्पृशित्वा धारयतु।' : 'Press and hold the first letter.'}</p>
          </div>
          <div>
            <b>2</b>
            <p>{sa ? 'प्रथमाक्षराद् अन्तिमाक्षरपर्यन्तं कर्षतु। तिर्यग्गमनमपि शक्यम्।' : 'Trace the word from its first letter to its last. Diagonal moves are allowed.'}</p>
          </div>
          <div>
            <b>3</b>
            <p>{sa ? 'अन्ते मुञ्चतु। सही शब्दः स्वयमेव लभ्यते।' : 'Release at the end. A correct word is discovered automatically.'}</p>
          </div>
        </div>

        <div className="tutorial-demo" aria-hidden="true">
          <span>अ</span><i/><span>ध्य</span><i className="diag"/><span>य</span>
        </div>

        <p className="tutorial-note">
          {sa
            ? 'प्रत्येककोष्ठे एकः अक्षरसमूहः अस्ति। निर्देशानन्तरं क्रीडा स्वतः आरभते।'
            : 'Each cell holds a Sanskrit grapheme. Close these instructions to play; the timer pauses while they are open.'}
        </p>

        <button className="tutorial-start" onClick={onClose}>
          {sa ? 'अवगतम्' : 'Got it'}
        </button>
      </div>
    </div>
  );
}

