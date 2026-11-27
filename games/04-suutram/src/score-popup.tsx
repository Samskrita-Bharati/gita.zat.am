import { createRoot } from 'react-dom/client';
import ResultsModal from "./components/ResultsModal";
import type { ScoreBreakdown } from './types/gameTypes';
import originalHtml from '../index.dev.html?raw'

import './styles/global.css';
import './styles/game.css';
import './styles/responsive.css';
import './styles/portal.css';

type PopupOptions = {
    title: string;
    breakdown: ScoreBreakdown;
    bestScore: number;
    leaderboard?: string;
    submittingScore?: boolean;
    onReplay: () => void;
    onViewLeaderboard: () => void;
    onBack: () => void;
};

const popupContainer = document.createElement('div');
popupContainer.id = 'root';

document.body.appendChild(popupContainer);

const popupRoot = createRoot(popupContainer);

export function showScorePopup(options: PopupOptions) {
    popupRoot.render(
        <ResultsModal
            open={true}
            theme={options.title}
            breakdown={options.breakdown}
            bestScore={options.bestScore}
            leaderboard={options.leaderboard ?? ''}
            submittingScore={options.submittingScore ?? false}
            onReplay={options.onReplay}
            onViewLeaderboard={options.onViewLeaderboard}
            onBack={options.onBack}
            language="en"
        />
    );
}

const originalDocument = new DOMParser()
    .parseFromString(originalHtml, 'text/html');

originalDocument.querySelectorAll('style').forEach(style => {
    document.head.appendChild(style.cloneNode(true));
});

export function closeScorePopup() {
    popupRoot.render(null);
}