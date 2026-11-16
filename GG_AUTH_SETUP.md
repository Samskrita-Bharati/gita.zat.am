# GG — Zat.am: protected games and Firestore setup

## Included changes

- The five games and `/leaderboard/` are invisible before Firebase Auth finishes initializing. Signed-out and unverified-email users are redirected to `/auth/login.html?redirect=...`.
- Successful login returns to the originally requested game or leaderboard; if preferences must be completed first, the destination is preserved through that step. Signup also preserves the return URL.
- Redirect destinations are restricted to recognized GG game/leaderboard routes on the same origin.
- New Firebase config uses `gg-zatam` rather than `zat-am-main`, including its existing GA4 measurement ID.
- Gita Typing Game's legacy offline caching was removed because it could serve cached, unprotected HTML.
- Firestore rules protect user data and require sign-in for public profiles and leaderboard reads. Score writes now append one identifiable key without permission to change previous scores.

## Before testing

1. Back up your current branch. Review the changes before merging.
2. In Firebase Console, choose **GG — Zat.am** (`gg-zatam`). Verify **Authentication > Sign-in method** has Google and Email/Password enabled.
3. In Authentication > Settings > Authorized domains, verify `gg.zat.am` (and the development origin, if applicable).
4. Open **Firestore Database > Rules**, replace its rules with this repository's `firestore.rules`, and review before publishing. Alternatively, after confirming CLI authentication and project target:

   ```bash
   firebase use
   firebase deploy --only firestore:rules --project gg-zatam
   ```

   This command deploys **rules only**, not Hosting or Firestore data. Never deploy to `zat-am-main` by mistake.
5. Publish your updated static HTML/JS through your existing website deployment process. Since `firebase.json` only contains Firestore configuration, `firebase deploy` does **not** currently deploy the GG website.

## Manual smoke test (browser + Firestore)

- In a private window, open each of the five `/games/.../` URLs directly and `/leaderboard/`; no protected content should be shown before the redirect to login.
- Sign in with an existing verified email/password user. Check that the original URL and its query string are restored.
- Sign up with email/password. Verify the account's email and login; check the return path remains correct. Repeat with Google sign-in.
- Test an account with no preferences: finish or skip preferences and confirm the original game is opened.
- Sign out while a protected page is open (e.g., from another tab); the protected page should hide and redirect.
- Verify the new account is created only inside `gg-zatam` and that one completed Arrange सुभाषितम् run creates a score in both the game and Global monthly histories.
- Confirm signed-out Firestore access to `leaderboards/...` and `users/{uid}/public/profile` is denied, and that another user cannot update or delete an existing score.
- Visit Gita Typing Game in a previously used browser and check for an old service worker/cache. A forced refresh or clearing the site's old cache may be necessary during rollout.
- For production, run Firestore Rules Emulator tests with authenticated and unauthenticated test contexts before publishing rules.

## Security boundaries and remaining work

- **Client-side guards do not make publicly hosted HTML, JS, or assets private.** For server-enforced page access, use a backend/Hosting architecture that validates Firebase sessions before serving content.
- **Client-scored games are not cheat-resistant**: these rules stop edits to pre-existing entries but a player can still falsify their **own** score. For trusted competitive leaderboards, implement server-validated game attempts.
- The existing streak algorithm runs in browser and is only partially constrained by rules; a trusted scheduled or transactional backend is needed for authoritative streaks.
- The old admin-reset logic clears per-game history but not related Global records; reconcile both in an admin-only backend before relying on resets.
- The browser-based Google Analytics SDK works independently of dashboard access, but check consent/privacy requirements for your audience before production.
- Existing GG's other four games do not yet integrate score submissions. This patch protects the pages, not yet introduces scoring for those games.
- The Firebase project is new; old ZAT users and scores are not automatically migrated.

Official docs:
- https://firebase.google.com/docs/reference/js/auth.auth#authstateready
- https://firebase.google.com/docs/firestore/security/rules-fields
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/auth/admin/manage-cookies
