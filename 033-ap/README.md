# अन्विष्यन्तां पदानि

An archive of Sanskrit word search puzzles published in the monthly magazine *Sambhashana Sandesha* from 1996 to 1998. The collection is intended for Samskrita Bharati volunteers as a learning and teaching resource.

## How it works

- The landing page displays the available year covers (1996, 1997, and 1998).
- Selecting a year reloads the page with `?year=YYYY`.
- `js/sig.js` switches from the year archive to an embedded Amuse Labs date picker for that year's puzzle set (`sanskritbharatiusa-apYYYY`). The puzzles and their gameplay are hosted by Amuse Labs; they are not stored in this folder.
- The page uses the shared Zat.am game shell in `../shared/game-theme.css`. `game-layout.css` contains only archive-specific and iframe responsive layout rules.

## Files

- `index.html` — page structure, available years, and iframe mount point.
- `js/sig.js` — year selection, embedded puzzle URL, and legacy access check.
- `js/common.js` — shared legacy archive utilities; most are not used by this page's puzzle flow.
- `img/` — year cover images.
- `pp.htm`, `tos.htm` — purpose, privacy, and usage terms.

The page is responsive: year covers reflow through the Bootstrap grid, the archive card adapts its spacing on narrow screens, and the embedded game fills the available width with a viewport-aware mobile height.
