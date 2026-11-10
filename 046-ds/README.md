# गगननौका (Gagananauka)

Gagananauka is a Sanskrit-themed space survival game. Enter a player name, then
steer the ship with **W**, **A**, **S**, and **D**. Small and medium screens, as
well as touch devices, also show direction buttons. Each move advances the
robots; avoid them and let them pass the bottom of the play field to earn
points.

## Scoring and leaderboard

The default is one point per five robots passed. Change `obstaclesPerPoint` in
`score-config.js` to adjust the number of robots needed for a point. The score
is shown in Arabic and Devanagari numerals. When a collision ends a run, the
game submits the score to the shared leaderboard, capped at its 0–100 range.
Players must be signed in to save leaderboard scores. **Play again** starts a
new run and resets its score and obstacle count.

## Page and responsive layout

The page uses the shared Zat.am game shell, status cards, play area, buttons,
and themed name and game-over dialogs. The space field and its objects keep
game-specific styling. The field and controls adapt to desktop, mobile, and
landscape screens.

## Project files

- `index.html` — Game layout, dialogs, touch controls, navigation, and shared
  leaderboard initialization.
- `jssp.js` — Movement, obstacle updates, collisions, score display, and score
  submission.
- `score-config.js` — Obstacles required per point.
- `sp.css` — Space field and responsive styles.
- `bp.png` — Space background.
- `ufo.png` — Player ship image.
- `../shared/game-theme.css` — Shared game page and component styles.
- `../js/game-score.js` — Shared leaderboard integration.
- `../js/navbar-loader.js` — Shared site navigation.
