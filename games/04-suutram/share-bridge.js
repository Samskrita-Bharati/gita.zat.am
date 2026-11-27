import {
  hasCompletedScoreShare,
  openCompletedScoreShare,
} from "../shared/score-share.js";
/**
 * Results-modal companion for the published Strands bundle.
 * The existing React build is unchanged. It can still call shared game-score.js,
 * and this small enhancement shows the contextual Share Score button in the results dialog.
 */
function refreshShareControl() {
  const card = document.querySelector(".result-card");
  if (!card || !card.closest(".modal-backdrop")) return;
  const actions = card.querySelector(".result-actions");
  if (!actions) return;
  let shareButton = card.querySelector("[data-gg-strands-share]");
  if (!shareButton) {
    shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "gg-strands-share-action";
    shareButton.dataset.ggStrandsShare = "true";
    shareButton.textContent = "✦ Share my score";
    shareButton.addEventListener("click", async() => {
      const share  = await import(
        new URL("../shared/score-share.js", window.location.href).href
      );
      share.openCompletedScoreShare();
    });
    // Insert before React's action row, leaving game controls untouched.
    card.insertBefore(shareButton, actions);
  }
  shareButton.disabled = false;
  shareButton.title = shareButton.disabled
    ? "Preparing your shareable result…"
    : "";
}
const observer = new MutationObserver(refreshShareControl);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("gg-score-share-ready", refreshShareControl);
