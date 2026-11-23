/**
 * Results-modal companion for the published Strands bundle.
 * The existing React build is unchanged. It can still call shared game-score.js,
 * and this small enhancement exposes its share shortcut inside the results dialog.
 */
const observer = new MutationObserver(() => {
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
    shareButton.addEventListener("click", () => {
      document.getElementById("gg-score-share-shortcut")?.click();
    });
    // Insert before React's action row, leaving game controls untouched.
    card.insertBefore(shareButton, actions);
  }
  shareButton.disabled = !document.getElementById("gg-score-share-shortcut");
  shareButton.title = shareButton.disabled
    ? "Preparing your shareable result…"
    : "";
});
observer.observe(document.body, { childList: true, subtree: true });
