/** Safe, user-facing messages for Firebase Authentication / Firestore errors. */
export function authErrorMessage(error, flow = "login") {
  const code = error?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "This email already has an account. Please sign in instead. If you normally use Google, choose Sign in with Google, or use Forgot Password.";
    case "auth/account-exists-with-different-credential":
      return "This email is already registered using another sign-in method. Please sign in using the method you used before.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 8 characters).";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "We couldn't sign you in with those details. Check your email and password, or try another sign-in method.";
    case "auth/user-disabled":
      return "This account is disabled. Please contact the administrator.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled. Please try again when you're ready.";
    case "auth/cancelled-popup-request":
      return "Another sign-in window was opened. Please finish that attempt or try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.";
    case "auth/unauthorized-domain":
      return "Google sign-in isn't configured for this website address yet. Please contact the administrator.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled yet. Please contact the administrator.";
    case "auth/network-request-failed":
    case "unavailable":
      return "Unable to connect right now. Please check your internet connection and try again.";
    case "auth/too-many-requests":
    case "resource-exhausted":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "You're signed in, but we couldn't finish setting up your profile. Please try signing in again. If this continues, contact the administrator.";
    default:
      return flow === "signup"
        ? "We couldn't complete your sign-up. Please try again. If this continues, contact the administrator."
        : flow === "google"
          ? "We couldn't complete Google sign-in. Please try again. If this continues, contact the administrator."
          : "We couldn't sign you in. Please try again. If this continues, contact the administrator.";
  }
}
