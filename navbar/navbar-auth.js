import {
  auth,
  onAuthStateChanged,
  signOut,
  db,
  doc,
  getDoc,
} from "../auth/api/firebase-config.js";

import { getCurrentUserProfile } from "../auth/api/auth-api.js";

import { updateStreak } from "../auth/api/streak.js";
import { resolveAvatarState, safePhotoURL } from "../auth/js/avatar-state.js";

// Prevent duplicate initialization
let navbarInitialized = false;

// Share Score uses the same public display name already loaded for the navbar.
// Publish it once per authentication state change; no additional Firestore
// request is needed, and signed-out users never inherit a previous name.
function publishShareIdentity(user, profile = null) {
  if (user && auth.currentUser?.uid !== user.uid) return;
  const savedName = String(profile?.name || '').trim();
  const authName = String(user?.displayName || '').trim();
  const identity = user ? {
    uid: user.uid,
    playerName: (savedName || authName).slice(0, 64),
  } : null;
  window.zatamShareIdentity = identity;
  window.dispatchEvent(new CustomEvent('zatam:share-identity', { detail: identity }));
}

// =====================================================
// LANGUAGE LABELS
// =====================================================

const languageNames = {
  1: "Devanagari",
  be: "Bengali",
  gu: "Gujarati",
  ka: "Kannada",
  ml: "Malayalam",
  te: "Telugu",
  ta: "Tamil",
};

// =====================================================
// NAVBAR TRANSLATIONS
// =====================================================

const navbarTranslations = {
  en: {
    navGames: "Daily Challenge",
    navContest: "Calendar",
    navLeaderboard: "Leaderboard",

    login: "↪ Login",
    signup: "Sign Up",

    leaderboardDropdown: "Leaderboard",

    profile: "Profile",
    adminDashboard: "Admin Dashboard",
    logout: "Logout",

    langButton: "🌐 EN / SA",
  },

  sa: {
    navGames: "Daily Challenge",
    navContest: "Calendar",
    navLeaderboard: "श्रेष्ठसूची",

    login: "↪ प्रवेशः",
    signup: "पञ्जीकरणम्",

    leaderboardDropdown: "श्रेष्ठसूची",

    profile: "परिचयः",
    adminDashboard: "प्रशासनम्",
    logout: "निर्गमः",

    langButton: "🌐 SA / EN",
  },
};

// =====================================================
// DEFAULT PROFILE AVATAR
// =====================================================

function fallbackAvatarMarkup(large = false) {
  return `
    <span class="zatam-profile-fallback ${large ? "large" : ""}">
      👤
    </span>
  `;
}

// =====================================================
// LOCALIZED GREETING
//
// This still uses the user's preferred script.
// It is separate from EN / SA website language.
// =====================================================

function getLocalizedNamaste(langCode) {
  switch (langCode) {
    case "be":
      return "নমস্তে";

    case "gu":
      return "નમસ્તે";

    case "ka":
      return "ನಮಸ್ತೆ";

    case "ml":
      return "നമസ്തേ";

    case "te":
      return "నమస్తే";

    case "ta":
      return "நமஸ்தே";

    default:
      return "Namaste";
  }
}

// =====================================================
// MAIN INITIALIZER
// =====================================================

export async function initNavbarAuth() {
  if (navbarInitialized) {
    return;
  }

  navbarInitialized = true;

  // ===========================================
  // GET ELEMENTS AFTER NAVBAR HAS BEEN INJECTED
  // ===========================================

  const loggedOut = document.getElementById("logged-out");

  const loggedIn = document.getElementById("logged-in");

  const profileBtn = document.getElementById("profile-btn");

  const dropdown = document.getElementById("profile-dropdown");

  const userEmailDropdown = document.getElementById("user-email-dropdown");

  const usernameDisplay = document.getElementById("username");

  const streakDisplay = document.getElementById("streak");

  const userLanguageRow = document.getElementById("user-language");

  const dropdownLogout = document.getElementById("dropdown-logout");

  const headerAvatar = document.getElementById("navbar-profile-avatar");

  const dropdownAvatar = document.getElementById("dropdown-avatar");

  const headerUserName = document.getElementById("navbar-user-name");

  const langBtn = document.getElementById("zatamLangBtn");

  const loginBtn = document.getElementById("navbar-login-btn");

  const signupBtn = document.getElementById("navbar-signup-btn");

  const profileLink = document.getElementById("profile-link-dropdown");

  const leaderboardLink = document.getElementById("leaderboard-link-dropdown");
  const adminLink = document.getElementById("admin-link-dropdown");

  if (!loggedOut || !loggedIn || !profileBtn || !dropdown) {
    console.error("Navbar auth elements are missing.");

    return;
  }

  // ===================================================
  // EN / SA INTERFACE LANGUAGE
  // ===================================================

  let currentLanguage = localStorage.getItem("zatamLanguage") || "en";

  function applyNavbarLanguage(emitEvent = true) {
    const t = navbarTranslations[currentLanguage] || navbarTranslations.en;

    document.querySelectorAll("[data-nav-i18n]").forEach((element) => {
      const key = element.dataset.navI18n;

      if (t[key]) {
        element.textContent = t[key];
      }
    });

    if (langBtn) {
      langBtn.textContent = t.langButton;
    }

    localStorage.setItem("zatamLanguage", currentLanguage);

    window.zatamLanguage = currentLanguage;

    if (emitEvent) {
      window.dispatchEvent(
        new CustomEvent("zatam:languagechange", {
          detail: {
            language: currentLanguage,
          },
        }),
      );
    }
  }

  if (langBtn) {
    langBtn.addEventListener("click", () => {
      currentLanguage = currentLanguage === "en" ? "sa" : "en";

      applyNavbarLanguage();
    });
  }

  applyNavbarLanguage(false);

  // ===================================================
  // LOGIN / SIGNUP
  // ===================================================

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (loginBtn.dataset.href) {
        window.location.href = loginBtn.dataset.href;
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      if (signupBtn.dataset.href) {
        window.location.href = signupBtn.dataset.href;
      }
    });
  }

  // ===================================================
  // PROFILE DROPDOWN
  // ===================================================

  profileBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    dropdown.classList.toggle("hidden");

    const expanded = !dropdown.classList.contains("hidden");

    profileBtn.setAttribute("aria-expanded", String(expanded));
  });

  document.addEventListener("click", (event) => {
    if (!loggedIn.contains(event.target)) {
      dropdown.classList.add("hidden");

      profileBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Keep navbar/avatar in sync with the saved avatar choice. Build image
  // elements through DOM APIs rather than interpolating remote URLs as HTML.
  function renderNavbarAvatar(photoURL, displayName) {
    const safeURL = safePhotoURL(photoURL);
    for (const [mount, large] of [
      [headerAvatar, false],
      [dropdownAvatar, true],
    ]) {
      if (!mount) continue;
      mount.replaceChildren();
      if (!safeURL) {
        const fallback = document.createElement("span");
        fallback.className =
          `zatam-profile-fallback ${large ? "large" : ""}`.trim();
        fallback.textContent = "👤";
        mount.appendChild(fallback);
        continue;
      }
      const img = document.createElement("img");
      img.src = safeURL;
      img.alt = `${displayName || "User"} profile`;
      img.onerror = () => {
        img.remove();
        const fallback = document.createElement("span");
        fallback.className =
          `zatam-profile-fallback ${large ? "large" : ""}`.trim();
        fallback.textContent = "👤";
        mount.appendChild(fallback);
      };
      mount.appendChild(img);
    }
  }

  window.addEventListener("zatam:avatar-updated", (event) => {
    const activeUser = auth.currentUser;
    if (!activeUser) return;
    const displayName =
      activeUser.displayName?.split(" ")[0] ||
      activeUser.email?.split("@")[0] ||
      "Player";
    renderNavbarAvatar(event.detail?.photoURL || "", displayName);
  });

  // ===================================================
  // AUTH STATE
  // ===================================================

  onAuthStateChanged(auth, async (user) => {
    publishShareIdentity(null);
    if (user) publishShareIdentity(user);
    if (user) {
      // The navigation link is a convenience only. /admin/ and Firestore
      // independently verify the isAdmin role before exposing any data.
      if (adminLink) {
        adminLink.classList.add("hidden");
        getDoc(doc(db, "users", user.uid, "private", "account"))
          .then((snap) => {
            if (
              auth.currentUser?.uid === user.uid &&
              snap.exists() &&
              snap.data().isAdmin === true
            ) {
              adminLink.classList.remove("hidden");
            }
          })
          .catch(() => {
            /* Missing permissions: keep admin link hidden. */
          });
      }
      loggedOut.classList.add("hidden");

      loggedIn.classList.remove("hidden");

      // ===========================================
      // NAME
      // ===========================================

      let displayName = "Player";

      if (user.displayName) {
        displayName = user.displayName.split(" ")[0];
      } else if (user.email) {
        displayName = user.email.split("@")[0];
      }

      if (headerUserName) {
        headerUserName.textContent = displayName;
      }

      if (userEmailDropdown) {
        userEmailDropdown.textContent = user.email || "";
      }

      // Defer the avatar photo until we have read the Firestore source choice
      // so a user who selected "default" never briefly sees their Google image.
      renderNavbarAvatar("", displayName);

      // ===========================================
      // USER PROFILE / PREFERRED SCRIPT
      // ===========================================

      try {
        const profile = await getCurrentUserProfile();
        if (auth.currentUser?.uid !== user.uid) return;
        publishShareIdentity(user, profile);
        renderNavbarAvatar(
          resolveAvatarState(user, profile).photoURL,
          displayName,
        );

        if (profile && profile.language) {
          window.zatPreferredLang = profile.language;

          localStorage.setItem("zatPreferredLang", profile.language);
        }

        const langCode =
          window.zatPreferredLang ||
          localStorage.getItem("zatPreferredLang") ||
          "";

        const greeting = getLocalizedNamaste(langCode);

        if (usernameDisplay) {
          usernameDisplay.textContent = `${greeting}, ${displayName}!`;
        }

        if (userLanguageRow) {
          if (langCode) {
            const languageLabel = languageNames[langCode] || langCode;

            userLanguageRow.textContent = `Language: ${languageLabel}`;

            userLanguageRow.style.display = "block";
          } else {
            userLanguageRow.textContent = "";

            userLanguageRow.style.display = "none";
          }
        }
      } catch (error) {
        renderNavbarAvatar(user.photoURL, displayName);
        console.error("Unable to load user profile:", error);

        if (usernameDisplay) {
          usernameDisplay.textContent = `Namaste, ${displayName}!`;
        }
      }

      // ===========================================
      // STREAK
      // ===========================================

      if (streakDisplay) {
        try {
          const streak = await updateStreak(user.uid);

          streakDisplay.textContent = `🔥 Streak: ${streak}`;
        } catch (error) {
          console.error("Unable to load streak:", error);

          streakDisplay.textContent = "🔥 Streak: 0";
        }
      }
    } else {
      if (adminLink) adminLink.classList.add("hidden");
      loggedOut.classList.remove("hidden");

      loggedIn.classList.add("hidden");

      dropdown.classList.add("hidden");
    }
  });

  // ===================================================
  // LOGOUT
  // ===================================================

  if (dropdownLogout) {
    dropdownLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);

        dropdown.classList.add("hidden");

        // Public main zat.am pages can simply refresh.
        window.location.reload();
      } catch (error) {
        console.error("Logout failed:", error);

        alert("Error logging out.");
      }
    });
  }

  // ===================================================
  // PROFILE ORIGIN
  // ===================================================

  if (profileLink) {
    const profileUrl = new URL(profileLink.href);

    const currentPath = window.location.pathname;

    profileUrl.searchParams.set(
      "from",
      currentPath.includes("/games/") ? "games" : "home",
    );

    profileLink.href = profileUrl.href;
  }

  // ===================================================
  // LEADERBOARD ORIGIN
  // ===================================================

  if (leaderboardLink) {
    const leaderboardUrl = new URL(leaderboardLink.href);

    const currentPath = window.location.pathname;

    leaderboardUrl.searchParams.set(
      "from",
      currentPath.includes("/games/") ? "games" : "home",
    );

    leaderboardLink.href = leaderboardUrl.href;
  }
}
