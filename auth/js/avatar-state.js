/**
 * Display-state resolver shared by GG's profile and navbar.
 * Google, uploaded, and default choices remain available when switching.
 * Compatible with accounts created before the avatar fields existed.
 */
export function safePhotoURL(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function cloudinaryPhotoURL(value) {
  const url = safePhotoURL(value);
  return url && new URL(url).hostname === "res.cloudinary.com" ? url : "";
}

export function resolveAvatarState(user, profile = {}) {
  const data = profile || {};
  const googleProvider = user?.providerData?.find(
    (provider) => provider?.providerId === "google.com",
  );
  const googlePhotoURL = googleProvider
    ? safePhotoURL(googleProvider.photoURL) || safePhotoURL(data.googlePhotoURL)
    : "";

  const customPhotoURL = cloudinaryPhotoURL(data.customPhotoURL)
    || cloudinaryPhotoURL(data.photoURL)
    || cloudinaryPhotoURL(user?.photoURL);

  const storedSource = ["custom", "google", "default"].includes(data.avatarSource)
    ? data.avatarSource : "";
  const legacyPhoto = safePhotoURL(data.photoURL) || safePhotoURL(user?.photoURL);

  if (storedSource === "default") {
    return { source: "default", photoURL: "", customPhotoURL, googlePhotoURL };
  }
  if (storedSource === "custom" && customPhotoURL) {
    return { source: "custom", photoURL: customPhotoURL, customPhotoURL, googlePhotoURL };
  }
  if (storedSource === "google" && googlePhotoURL) {
    return { source: "google", photoURL: googlePhotoURL, customPhotoURL, googlePhotoURL };
  }
  if (cloudinaryPhotoURL(legacyPhoto)) {
    return { source: "custom", photoURL: cloudinaryPhotoURL(legacyPhoto), customPhotoURL, googlePhotoURL };
  }
  if (googlePhotoURL && (legacyPhoto === googlePhotoURL || !legacyPhoto)) {
    return { source: "google", photoURL: googlePhotoURL, customPhotoURL, googlePhotoURL };
  }
  if (legacyPhoto) {
    return { source: "legacy", photoURL: legacyPhoto, customPhotoURL, googlePhotoURL };
  }
  if (googlePhotoURL) {
    return { source: "google", photoURL: googlePhotoURL, customPhotoURL, googlePhotoURL };
  }
  return { source: "default", photoURL: "", customPhotoURL, googlePhotoURL };
}
