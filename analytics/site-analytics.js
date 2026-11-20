/**
 * The site's ONE Google tag. Imported by the shared navbar and Firebase
 * configuration; browser ESM caching plus the global marker prevent duplicates.
 * The Google tag measures page views (and supported GA4 enhanced-measurement
 * events). Firebase Authentication and Firestore are independent of it.
 */
import { GA_ENABLED, GA_MEASUREMENT_ID } from "./config.js";

const validId = /^G-[A-Z0-9]{5,20}$/.test(GA_MEASUREMENT_ID);

export function initSiteAnalytics() {
  if (!GA_ENABLED || !validId || typeof window === "undefined") return false;
  if (window.__ggSiteAnalyticsId)
    return window.__ggSiteAnalyticsId === GA_MEASUREMENT_ID;

  window.__ggSiteAnalyticsId = GA_MEASUREMENT_ID;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
  window.gtag("js", new Date());
  // One page_view is sent by config. Do not send a second manual page_view.
  window.gtag("config", GA_MEASUREMENT_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  script.dataset.ggAnalytics = GA_MEASUREMENT_ID;
  document.head.appendChild(script);
  return true;
}

export function trackSiteEvent(name, parameters = {}) {
  if (!GA_ENABLED || !validId || !/^[a-z][a-z0-9_]{1,39}$/.test(name)) return;
  if (initSiteAnalytics()) window.gtag("event", name, parameters);
}

initSiteAnalytics();
