# Arrange सुभाषितम्

A Sanskrit word-order game using the two Bhagavad Gita shlokas scheduled for
the current local date. Place the numbered cards onto the matching parts to
rebuild the selected shloka in its original order.

## How to play

1. Choose a number card, then choose the segment that belongs in that position.
   You can also drag the card onto its matching segment.
2. A correct match locks the card in place. A wrong match costs 5 points.
3. Complete every match to see your final score and save it to the leaderboard
   when signed in.
4. A URL such as `?id=1` selects that shloka when it is scheduled for today. Missing, invalid,
   or past IDs fall back to today's first shloka; IDs beyond today's second
   fall back to today's second shloka.

The game uses the shared `getShlokaTextFromUrl()` and `splitShlokaWords()`
functions. Verse punctuation is removed and consecutive words are grouped into
four parts for shorter verses or five parts for longer verses. A completed
shloka is marked in the current browser's calendar; the score submission also
includes the shloka ID and date when it can be saved to the leaderboard.

## Scoring

- Every shloka starts at 100 points.
- The timer begins with the first number-card selection or card drop.
- There is a time allowance of at least 30 seconds (15 seconds per segment for
  longer sayings). After that, the score loses 1 point for every 6 seconds.
- Each incorrect card-to-segment match deducts 5 points.
- Scores never fall below 0.

## Run locally

From the repository root, serve the site over HTTP, for example:

```sh
npx http-server . -p 8000 -c-1
```

Then open `http://localhost:8000/games/02-arrange/`. The game requires sign-in.

## Files

- `index.html` contains the game interaction logic, scoring, and
  leaderboard integration.
- `daily-shloka.mjs` selects today's verse and prepares its words using the
  shared shloka utilities.
- `../../css/global.css` provides shared design tokens and base styles.
- `../shared/game-theme.css` provides the shared Zat.am game shell.
- `ordering-game.css` provides the game-specific board layout and styling.
- `../shared/game-score.js` handles score submission and leaderboard status.
- `../../navbar/navbar-loader.js` loads the shared navigation.

## Responsive behavior

The board has two columns on wide screens. On tablet and phone screens, the
number cards and saying segments stack into a single easy-to-tap column. The
progress cards remain in a compact two-column grid, and card text wraps rather
than overflowing.

## Credits

The original drag-and-drop concept was based on
[Jason Chui's CodePen](https://codepen.io/JasonChui/pen/jeZywq), which cites an
[Elated.com drag-and-drop article](http://www.elated.com/articles/drag-and-drop-with-jquery-your-essential-guide/).
