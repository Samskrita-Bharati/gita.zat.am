# Gita Strands — content preview

Strands inside the Gita portal. This checkpoint replaces the original themed gameplay with two temporary Bhagavad Gita samples. It reuses the portal navbar and EN/SA language events.

## Run

From `games/strands`, run `npm ci` if dependencies are not installed, then `npm run dev`.

- Portal: `http://localhost:8443/`
- Sample shloka 1.1: `http://localhost:8443/games/strands/?id=1`
- Sample shloka 1.2: `http://localhost:8443/games/strands/?id=2`

Use the URL printed by Vite if the configured port is occupied.

## Content and board rules

- `src/data/sampleShlokas.ts` supplies temporary text and word arrays for IDs 1 and 2. Speaker labels remain in the displayed text but are excluded from these temporary target arrays. Final word arrays should come from the shared content functions.
- `src/services/gitaContentService.ts` adapts a shloka into the existing board model. Replace the sample loader with Yue's shared functions when their interface is available.
- Normalize words to NFC, remove verse-number/danda markers, deduplicate, and exclude words shorter than two grapheme cells or longer than the 36-cell capacity.
- Segment with `Intl.Segmenter('sa', { granularity: 'grapheme' })`. Unsupported browsers display an error instead of splitting Sanskrit into code units. Grapheme segmentation does not perform sandhi splitting.
- Seed selection by numeric shloka ID and puzzle version. Choose up to five eligible candidates, then prefer three targets that fit, falling back to two or one for sparse input. An empty eligible pool produces a clear error.
- Choose a compact board no larger than 6×6. Target paths use adjacent cells without overlap; remaining cells contain seeded filler graphemes.
- The same content/ID/version produces the same board with a compatible segmenter implementation. Replay does not choose new targets.
- Found words turn green. Hints reveal an unfound path. Show Answer does not complete or score a round.
- Sample navigation updates `?id=` and displays completed-shloka ticks. Confirming navigation away from an unfinished puzzle clears that run.

## Local progress and scoring

Completed samples and best scores are saved under Gita-specific local storage keys. Old theme progress is not reused. An unfinished puzzle is not restored yet.

The previous local scoring formula remains temporarily unchanged: 15 per word, 100 completion points, up to 100 speed bonus decreasing by 15 per completed minute, and 10 per hint. This is not a new agreed Gita scoring policy. No game leaderboard submissions or game account synchronization run in this preview.

The portal navbar keeps its existing authentication behaviour. The Strands React entry no longer imports its own Firebase theme loader, login hook, cloud-progress service, leaderboard service or audio service. Unused legacy modules, fixtures and their regression tests are retained for a later cleanup checkpoint; do not interpret their presence as an active integration.

## Tests

`npm run test:ci` runs the original fixture validation and 3,000-board regression suite, the new Gita puzzle tests, then TypeScript and the production build.

`npm run test:gita` verifies 500 Gita boards, deterministic replays, grapheme boundaries, duplicate/single-cell exclusion, target paths, complete grids, preview ID handling and sparse input.

Check manually: both sample URLs, shared EN/SA toggle, touch dragging, correct/incorrect selections, hints, answer mode, switching shlokas, completion ticks and local bests after reload. No live leaderboard writes are required for testing.

## Still pending

- Shared content functions and approved word sets for all shlokas.
- Local-date release checks and clamping to today's highest allowed ID. The current ID clamp is only for the two-sample preview, not daily access control.
- Handling dates before the release schedule begins.
- Unfinished progress resume and the agreed replay/no-repeat policy.
- Approved Gita scoring, new Firebase integration, completion reporting and streak rules.
- Production portal deployment integration. The local build produces the game HTML in `dist/games/strands/` plus hashed assets in `dist/assets/`; it is not a replacement deployment of the entire portal.
