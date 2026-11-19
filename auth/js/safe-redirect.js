/** Prevent open redirects and accidental login <-> signup loops. */
const projectRoot = new URL("../../", import.meta.url);

export function getSafeRedirect(search = window.location.search) {
  const candidate = new URLSearchParams(search).get("redirect");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") ||
      candidate.includes("\\") || /[\u0000-\u001f]/.test(candidate)) {
    return null;
  }

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const rootPath = projectRoot.pathname;
    if (!url.pathname.startsWith(rootPath)) return null;
    const page = url.pathname.slice(rootPath.length);
    // These are the only pages the auth gate currently protects.
    if (!/^(games\/(018-as|fw|059-fitb|z18)(\/|$)|leaderboard(\/|$))/.test(page)) {
      return null;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function getDestination() {
  return getSafeRedirect() || new URL("../../index.html", import.meta.url).href;
}

export function getPreferencesUrl() {
  const url = new URL("../preferences.html", import.meta.url);
  const redirect = getSafeRedirect();
  if (redirect) url.searchParams.set("redirect", redirect);
  return url.href;
}

export function preserveRedirectOnLink(link) {
  const redirect = getSafeRedirect();
  if (link && redirect) {
    const url = new URL(link.href, window.location.href);
    url.searchParams.set("redirect", redirect);
    link.href = url.href;
  }
}
