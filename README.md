# zat.am

Zat.am is a Sanskrit learning game hub. The site is a static Vite app with Firebase Authentication and Firestore-backed profiles, streaks, and a shared leaderboard.

## Run locally

```sh
npm install
npm run dev
```

Vite prints the local URL when the server starts.

## Project structure

- `index.html`, `app.js`, `styles.css` — home page and game list
- `games/` — retained games and game-specific code
- `about/`, `resources/`, `daily-challenges/`, `leaderboard/`, `contact/` — navigation pages
- `auth/` — login, registration, profile, preferences, and password reset
- `navbar/` — shared navigation template, styles, loader, and auth controls
- `shared/` — shared game styles
- `assets/` — 404 page and fallback images
- `legal/` — privacy page

The root `404.html` forwards to `assets/404.html`.
