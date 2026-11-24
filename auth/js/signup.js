import {
  signUp,
  updateUserProfile,
  ensureUserDocument,
} from "../api/auth-api.js";
import {
  sendEmailVerification,
  signOut,
  auth,
} from "../api/firebase-config.js";
import { authErrorMessage } from "./auth-error-messages.js";
import { captureReferralFromUrl, claimReferralOnSignup } from "../../referrals/referral-client.js";

captureReferralFromUrl();
import { getSafeRedirect, preserveRedirectOnLink } from "./safe-redirect.js";

preserveRedirectOnLink(document.querySelector('a[data-cy="login-link"]'));

const signupForm = document.getElementById("signup-form");
const nameInput = document.getElementById("signup-name");
const emailInput = document.getElementById("signup-email");
const passwordInput = document.getElementById("signup-password");
const confirmPasswordInput = document.getElementById("signup-cpassword");
const message = document.getElementById("message");
const submitButton = signupForm.querySelector('button[type="submit"]');
let submitting = false;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "red" : "green";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
}

function redirectToLogin() {
  const loginUrl = new URL("../login.html", import.meta.url);
  const redirect = getSafeRedirect();
  if (redirect) loginUrl.searchParams.set("redirect", redirect);
  window.location.assign(loginUrl.href);
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (name.length > 120) {
    showMessage("Your name must be 120 characters or fewer.", true);
    return;
  }
  if (password !== confirmPasswordInput.value) {
    showMessage("Passwords do not match. Please try again.", true);
    return;
  }
  if (password.length < 8) {
    showMessage("Password must be at least 8 characters.", true);
    return;
  }

  submitting = true;
  submitButton.disabled = true;
  showMessage("Creating your account...");
  let createdUser = null;

  try {
    const userCred = await signUp(email, password);
    createdUser = userCred.user;

    // The account now exists in Firebase Auth. Treat Firestore profile setup
    // and verification email delivery as separate operations. Otherwise a
    // denied profile write can look like a failed sign-up and users will see
    // email-already-in-use when they retry.
    try {
      await updateUserProfile(createdUser, { displayName: name });
    } catch (error) {
      console.warn("Could not sync signup display name:", error);
    }

    let setupError = null;
    try {
      await ensureUserDocument(createdUser, { name });
    } catch (error) {
      setupError = error;
      console.error("Account created, but Firestore profile setup failed:", error);
    }

    // Store an immutable pending referral while the account is still signed in.
    // Referral outages must never prevent ordinary user registration.
    try {
      await claimReferralOnSignup(createdUser);
    } catch (error) {
      console.warn('Referral pending claim could not be recorded:', error);
    }

    let verificationError = null;
    try {
      await sendEmailVerification(createdUser);
    } catch (error) {
      verificationError = error;
      console.error("Account created, but verification email failed:", error);
    }

    await signOut(auth);

    if (setupError || verificationError) {
      showMessage(
        setupError && verificationError
          ? "Your account was created, but profile setup and verification-email delivery could not be completed. Please contact the administrator instead of signing up again."
          : setupError
            ? "Your account was created, but profile setup isn't finished. Check your email for the verification link, then sign in to finish setup. Do not create another account."
            : "Your account was created, but we couldn't send the verification email. Sign in and use Resend Verification Email.",
        true,
      );
      return;
    }

    showMessage("Account created! Please check your email to verify your account before signing in.");
    setTimeout(redirectToLogin, 4000);
  } catch (error) {
    console.error("Sign-up failed:", error);
    // A successful Firebase Auth account creation cannot be rolled back by
    // client-side Firestore errors. Never tell the user to sign up again.
    showMessage(
      createdUser
        ? "Your account was created, but setup wasn't completed. Please use the login page or contact the administrator; do not register again."
        : authErrorMessage(error, "signup"),
      true,
    );
    if (createdUser) {
      try { await signOut(auth); } catch (signOutError) {
        console.warn("Could not sign out after partial signup:", signOutError);
      }
    }
  } finally {
    // Once Firebase Auth creates an account, do not let a second click
    // trigger an expected email-already-in-use error before navigating away.
    if (!createdUser) {
      submitting = false;
      submitButton.disabled = false;
    }
  }
});
