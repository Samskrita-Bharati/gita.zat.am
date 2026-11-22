/**
 * Passive game-visit tracking for all game pages with the shared navbar.
 * per 30 minutes to avoid refresh loops and excessive Firestore writes.
 */
import { auth, db } from "../auth/api/firebase-config.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { trackSiteEvent } from "./site-analytics.js";

const THROTTLE_MS = 30 * 60 * 1000;

export function getGameIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/(?:^|\/)games\/([a-zA-Z0-9_-]{1,80})(?:\/|$)/);
  return match ? match[1] : null;
}

export async function recordGameVisit() {
  const gameId = getGameIdFromPath();
  if (!gameId) return;

  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.emailVerified !== true) return;

  const key = `gg:visit:${user.uid}:${gameId}`;
  try {
    const lastVisit = Number(sessionStorage.getItem(key)) || 0;
    if (Date.now() - lastVisit < THROTTLE_MS) return;
    // Mark this tab before the network call to avoid concurrent duplicates.
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Session storage can be unavailable in restricted browser modes.
    // Firestore tracking can still proceed without local throttling.
  }
  const gameName = String(document.title || gameId)
    .trim()
    .slice(0, 120);

  try {
    await addDoc(collection(db, "gameVisits"), {
      uid: user.uid,
      gameId,
      gameName,
      path: window.location.pathname.slice(0, 250),
      visitedAt: serverTimestamp(),
    });
    // GA4 collection is separate from GG's Firestore admin dashboard.
    trackSiteEvent("game_page_visit", { game_id: gameId });
  } catch (error) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Storage unavailable. */
    }
    console.warn("GG visit tracking could not be saved:", error);
  }
}
