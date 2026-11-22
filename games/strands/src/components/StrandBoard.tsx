import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Cell, Language, Theme } from '../types/gameTypes';
import { tr } from '../i18n';
import { cellKey, selectionIsValid } from '../utils/board';

type Props = {
  theme: Theme;
  selection: Cell[];
  found: Set<string>;
  revealed: Set<string>;
  disabled: boolean;
  onChange: (path: Cell[]) => void;
  onSubmit: (path: Cell[]) => void;
  language: Language;
  feedback: '' | 'correct' | 'wrong';
  showAnswers: boolean;
};

type Point = { x: number; y: number };

export default function StrandBoard({
  theme,
  selection,
  found,
  revealed,
  disabled,
  onChange,
  onSubmit,
  language,
  feedback,
  showAnswers,
}: Props) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Cell[]>(selection);
  const draggingRef = useRef(false);
  const [linePoints, setLinePoints] = useState<Point[]>([]);
  const [guideLines, setGuideLines] = useState<{id:string; points:Point[]; spangram:boolean; found:boolean}[]>([]);

  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const selected = new Set(selection.map(cellKey));
  const foundCell = new Map<string, 'sp' | 'found'>();
  theme.targets
    .filter((target) => found.has(target.id))
    .forEach((target) => target.path.forEach((cell) =>
     foundCell.set(
      cellKey(cell),
      target.featured ? 'sp' : 'found'
    )
    ));

  const revealedTargets = theme.targets.filter((target) => showAnswers || revealed.has(target.id));
  const revealCells = new Set(
    revealedTargets.flatMap((target) => target.path.map(cellKey)),
  );

  function centerForCell(cell: Cell): Point {
    const board = boardRef.current;
    if (!board) return {x:0,y:0};
    const boardRect = board.getBoundingClientRect();
    const el = board.querySelector<HTMLElement>(`[data-key="${cellKey(cell)}"]`);
    if (!el) return {x:0,y:0};
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
    };
  }

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const updatePaths = () => {
      setLinePoints(selection.map(centerForCell));
      const cellWidth = board.querySelector<HTMLElement>('.letter-cell')?.offsetWidth ?? 0;
      setGuideLines(
        theme.targets.filter((target) => found.has(target.id) || showAnswers || revealed.has(target.id)).map((target) => {
          const points = target.path.map(centerForCell);
          const end = points.at(-1);
          const previous = points.at(-2);
          if (end && previous) {
            const length = Math.hypot(end.x - previous.x, end.y - previous.y);
            if (length > 0) {
              // Stop near the final tile's edge so the arrow does not cover its letter.
              const trim = Math.min(cellWidth * 0.34, length / 2);
              end.x -= (end.x - previous.x) * trim / length;
              end.y -= (end.y - previous.y) * trim / length;
            }
          }
          return { id: target.id, spangram: target.featured, found: found.has(target.id), points };
        }),
      );
    };
    updatePaths();
    const observer = new ResizeObserver(updatePaths);
    observer.observe(board);
    return () => observer.disconnect();
  }, [selection, theme, found, revealed, showAnswers]);

  function begin(cell: Cell, pointerId: number, target: HTMLElement) {
    if (disabled) return;
    draggingRef.current = true;
    target.setPointerCapture?.(pointerId);
    selectionRef.current = [cell];
    onChange([cell]);
  }

  function extend(cell: Cell) {
    if (!draggingRef.current || disabled) return;
    const current = selectionRef.current;

    if (current.length === 0) {
      selectionRef.current = [cell];
      onChange([cell]);
      return;
    }

    // Dragging back over an already selected cell acts like undo/backtracking.
    const existingIndex = current.findIndex((selectedCell) => cellKey(selectedCell) === cellKey(cell));
    if (existingIndex >= 0) {
      if (existingIndex === current.length - 1) return;
      const shortened = current.slice(0, existingIndex + 1);
      selectionRef.current = shortened;
      onChange(shortened);
      return;
    }

    if (!selectionIsValid(current, cell)) return;
    const next = [...current, cell];
    selectionRef.current = next;
    onChange(next);
  }

  function finish() {
    if (!draggingRef.current || disabled) return;
    draggingRef.current = false;
    const path = selectionRef.current;
    if (path.length > 0) onSubmit(path);
  }

  return (
    <div className="board-wrap">
      <div
        ref={boardRef}
        className={`strand-board ${disabled ? 'board-disabled' : ''} ${feedback ? `board-feedback-${feedback}` : ''} ${showAnswers ? 'answer-mode' : ''}`}
        data-board-size={theme.cols}
        style={{ gridTemplateColumns: `repeat(${theme.cols}, 1fr)` }}
        onPointerMove={(event) => {
          if (!draggingRef.current || disabled) return;
          const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
          const cellEl = el?.closest<HTMLElement>('[data-cell="true"]');
          if (!cellEl) return;
          const row = Number(cellEl.dataset.row);
          const col = Number(cellEl.dataset.col);
          if (Number.isInteger(row) && Number.isInteger(col)) extend({ row, col });
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={(event) => {
          if (event.buttons === 0) finish();
        }}
      >
        {(guideLines.length > 0 || linePoints.length > 1) && (
          <svg className="path-overlay" aria-hidden="true">
            <defs>
              <marker id="guide-arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <marker id="guide-arrow-found" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <marker id="guide-arrow-gold" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>

            {guideLines.map((line) => (
              <polyline
                key={line.id}
                className={`guide-path ${line.spangram ? 'spangram-guide' : ''} ${line.found ? 'found-guide' : ''}`}
                points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            ))}

            {linePoints.length > 1 && (
              <polyline
                className="selection-path"
                points={linePoints.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
          </svg>
        )}

        {theme.grid.map((row, rowIndex) => row.map((token, colIndex) => {
          const cell = { row: rowIndex, col: colIndex };
          const key = cellKey(cell);
          const state = foundCell.get(key);
          return (
            <button
              key={key}
              type="button"
              className={`letter-cell ${selected.has(key) ? 'selected' : ''} ${state ?? ''} ${revealCells.has(key) ? 'revealed' : ''}`}
              onPointerDown={(event) => {
                event.preventDefault();
                begin(cell, event.pointerId, event.currentTarget);
              }}
              data-cell="true"
              data-key={key}
              data-row={rowIndex}
              data-col={colIndex}
              aria-label={`row ${rowIndex + 1} column ${colIndex + 1} ${token}`}
              disabled={disabled}
            >
              <span>{token}</span>
            </button>
          );
        }))}
      </div>

      <p className="board-help">
        {showAnswers
          ? (language === 'sa' ? 'उत्तरपन्थाः रेखया दर्शिताः। पुनः आरभ्य स्वयं प्रयतताम्।' : 'Full solution paths are shown. Restart the level to try it yourself.')
          : tr(language,'boardHelp')}
      </p>
    </div>
  );
}

