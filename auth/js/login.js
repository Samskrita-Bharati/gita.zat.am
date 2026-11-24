import {
  login,
  signInWithGoogle,
  ensureUserDocument,
  getCurrentUserProfile,
} from "../api/auth-api.js";
import {
  sendEmailVerification,
  signOut,
  auth,
} from "../api/firebase-config.js";
import { authErrorMessage } from "./auth-error-messages.js";
import { captureReferralFromUrl, claimReferralOnSignup, confirmReferralOnLogin } from "../../referrals/referral-client.js";

captureReferralFromUrl();
import {
  getDestination,
  getPreferencesUrl,
  preserveRedirectOnLink,
} from "./safe-redirect.js";

preserveRedirectOnLink(document.querySelector('a[data-cy="signup-link"]'));

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("signin-email");
const passwordInput = document.getElementById("signin-password");
const message = document.getElementById("message");
const resendVerificationBtn = document.getElementById("resend-verification");
const googleSignInBtn = document.getElementById("google-signin");
const emailSignInBtn = loginForm.querySelector('button[type="submit"]');

let unverifiedEmail = null;
let busy = false;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "red" : "green";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
}

function setBusy(value) {
  busy = value;
  emailSignInBtn.disabled = value;
  googleSignInBtn.disabled = value;
}

function redirectForProfile(profile) {
  const target = profile?.preferencesSet === true
    ? getDestination()
    : getPreferencesUrl();
  setTimeout(() => window.location.assign(target), 1000);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  resendVerificationBtn.style.display = "none";
  unverifiedEmail = null;

  try {
    const userCred = await login(emailInput.value.trim(), passwordInput.value);
    const user = userCred.user;
    if (!user.emailVerified) {
      unverifiedEmail = user.email;
      resendVerificationBtn.style.display = "block";
      showMessage("Please verify your email before signing in. Check your inbox or use Resend Verification Email.", true);
      await signOut(auth);
      return;
    }

    await ensureUserDocument(user);
    try { await confirmReferralOnLogin(user); }
    catch (error) { console.warn('Referral confirmation unavailable:', error); }
    const profile = await getCurrentUserProfile();
    showMessage("Sign-in successful! Redirecting...");
    redirectForProfile(profile);
  } catch (error) {
    console.error("Email sign-in failed:", error);
    showMessage(authErrorMessage(error, "login"), true);
  } finally {
    setBusy(false);
  }
});

googleSignInBtn.addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  try {
    const credential = await signInWithGoogle();
    await ensureUserDocument(credential.user);
    // Separate failure handling: an invalid invitation must not prevent
    // confirmation of a previously recorded valid claim.
    try { await claimReferralOnSignup(credential.user); }
    catch (error) { console.warn('Referral pending claim unavailable:', error); }
    try { await confirmReferralOnLogin(credential.user); }
    catch (error) { console.warn('Referral confirmation unavailable:', error); }
    const profile = await getCurrentUserProfile();
    showMessage("Google sign-in successful! Redirecting...");
    redirectForProfile(profile);
  } catch (error) {
    console.error("Google sign-in or profile setup failed:", error);
    showMessage(authErrorMessage(error, "google"), true);
  } finally {
    setBusy(false);
  }
});

// The sign-in flow signs out unverified users. Re-authenticate briefly to
// resend their verification email; sending from an old signed-out User
// object fails on many Firebase SDK versions.
resendVerificationBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!unverifiedEmail) {
    showMessage("Please try signing in first.", true);
    return;
  }
  if (emailInput.value.trim() !== unverifiedEmail || !passwordInput.value) {
    showMessage("Please enter the same email and password to resend verification.", true);
    return;
  }

  setBusy(true);
  try {
    const credential = await login(unverifiedEmail, passwordInput.value);
    if (credential.user.emailVerified) {
      showMessage("Your email is already verified. Please sign in normally.");
    } else {
      await sendEmailVerification(credential.user);
      showMessage("Verification email sent! Please check your inbox.");
    }
  } catch (error) {
    console.error("Resend verification failed:", error);
    showMessage(authErrorMessage(error, "login"), true);
  } finally {
    try { await signOut(auth); } catch (error) {
      console.warn("Failed to sign out after verification attempt:", error);
    }
    setBusy(false);
  }
});
