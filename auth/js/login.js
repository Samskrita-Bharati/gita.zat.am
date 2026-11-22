import {
  login,
  signInWithGoogle,
  ensureUserDocument,
} from "../api/auth-api.js";
import {
  sendEmailVerification,
  signOut,
  auth,
} from "../api/firebase-config.js";

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

let unverifiedUser = null;

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const userCred = await login(email, password);
    const user = userCred.user;

    // Check if email is verified
    if (!user.emailVerified) {
      unverifiedUser = user;
      resendVerificationBtn.style.display = "block"; // Show resend button

      message.innerHTML =
        "Please verify your email before logging in. Check your inbox for the verification link.";
      message.style.color = "red";

      await signOut(auth);

      return;
    }

    await ensureUserDocument(user);

    // Check if preferences are set
    const { getCurrentUserProfile } = await import("../api/auth-api.js");
    const profile = await getCurrentUserProfile();

    message.innerHTML = "Login successful! Redirecting...";
    message.style.color = "green";

    setTimeout(() => {
      window.location.assign(
        profile && profile.preferencesSet
          ? getDestination()
          : getPreferencesUrl(),
      );
    }, 1000);
  } catch (error) {
    console.error(error);
    message.innerHTML = "Invalid email or password.";
    message.style.color = "red";
  }
});

const googleSignInBtn = document.getElementById("google-signin");
googleSignInBtn.addEventListener("click", async () => {
  try {
    const cred = await signInWithGoogle();
    const isNewUser = await ensureUserDocument(cred.user);
    console.log("isNewUser:", isNewUser, "Type:", typeof isNewUser);
    message.innerHTML = "Login successful! Redirecting...";
    message.style.color = "green";

    setTimeout(() => {
      window.location.assign(
        isNewUser ? getPreferencesUrl() : getDestination(),
      );
    }, 1000);
  } catch (error) {
    console.error(error);

    message.innerHTML = "Google sign-in failed. Please try again.";

    message.style.color = "red";
  }
});

// Resend verification email handler
if (resendVerificationBtn) {
  resendVerificationBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!unverifiedUser) {
      message.innerHTML = "Please try logging in first.";
      message.style.color = "red";
      return;
    }

    try {
      await sendEmailVerification(unverifiedUser);

      message.innerHTML = "Verification email sent! Please check your inbox.";
      message.style.color = "green";
    } catch (error) {
      console.error(error);

      // Handle rate limiting error
      if (error.code === "auth/too-many-requests") {
        message.innerHTML =
          "Too many requests. Please wait a few minutes and try again.";
      } else {
        message.innerHTML =
          "Failed to send verification email. Please try again.";
      }
      message.style.color = "red";
    }
  });
}
