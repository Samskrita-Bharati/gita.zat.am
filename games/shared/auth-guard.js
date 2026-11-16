/**
 * GG protected page guard.
 * Paired with an inline <head> visibility rule on every protected page.
 * This hides the page before first paint and redirects logged-out visitors.
 * IMPORTANT: this is client-side navigation protection, NOT private file hosting.
 */
import { auth, onAuthStateChanged } from "../../auth/api/firebase-config.js";

const projectRoot = new URL("../../", import.meta.url);
const loginPage = new URL("auth/login.html", projectRoot);
const html = document.documentElement;
let redirecting = false;

function redirectToLogin() {
  if (redirecting) return;
  redirecting = true;
  html.classList.remove("gg-authenticated");
  const destination = window.location.pathname + window.location.search + window.location.hash;
  const target = new URL(loginPage);
  target.searchParams.set("redirect", destination);
  window.location.replace(target.href);
}

function allowedToView(user) {
  // Match existing email/password login policy. Google accounts normally have
  // emailVerified = true, whereas unverified email/password signups must verify.
  return !!user && user.emailVerified === true;
}

try {
  await auth.authStateReady();
  if (!allowedToView(auth.currentUser)) {
    redirectToLogin();
  } else {
    html.classList.add("gg-authenticated");
    // If the visitor signs out in another tab while the page is open, hide
    // protected content immediately and send them to login.
    onAuthStateChanged(auth, (user) => {
      if (!allowedToView(user)) redirectToLogin();
    });
  }
} catch (error) {
  console.error("Unable to verify GG authentication:", error);
  redirectToLogin();
}
