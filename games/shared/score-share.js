/**
 * GG · Zat.am score sharing (client-only).
 * No Firebase reads/writes, no analytics, no score/leaderboard mutation.
 * The artwork is generated locally and is not a cryptographically verified result.
 */
const APP_URL = "https://gg.zat.am/";
// Public page folders changed in November 2026. Keep the existing Firestore
// game IDs unchanged, but share the currently deployed page URLs.
const GAME_PAGE_FOLDERS = Object.freeze({
  "fw": "01-wordSearch",
  "01-wordSearch": "01-wordSearch",
  "018-as": "02-arrange",
  "strands": "04-suutram",
  "059-fitb": "05-fillBlank",
  "z18": "06-wordScramble",
  "07-gitaTyping": "07-gitaTyping",
});
const CSS_URL = new URL("./score-share.css", import.meta.url).href;
const KRISHNA_URL = new URL("../../srikrishna-gg-wa.jpg", import.meta.url).href;
const FONT =
  '"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", "Arial Unicode MS", Arial, sans-serif';
let currentData = null;
let inlineShareButton = null;
let modal = null;
let formerFocus = null;
let previewObjectUrl = null;
let previewFile = null;
let modalVersion = 0;
let activeIdentityListener = null;

function safeString(value, limit = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limit);
}

export function normalizeShareResult(input = {}) {
  const score = Number(input.score);
  if (!Number.isFinite(score) || score < 0)
    throw new TypeError("A valid non-negative score is required.");
  const scoreType =
    input.scoreType === "overall"
      ? "overall"
      : input.scoreType === "cumulative"
        ? "cumulative"
        : input.scoreType === "completion"
          ? "completion"
          : "game";
  const gameId = safeString(input.gameId || "", 80).replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  );
  const pageFolder = GAME_PAGE_FOLDERS[gameId] || gameId;
  const url = gameId ? new URL(`games/${pageFolder}/`, APP_URL).href : APP_URL;
  const rank = Number(input.rank);
  const levels = Number(input.levels);
  const displayName = safeString(input.playerName, 64);
  return {
    score:
      scoreType === "game"
        ? Math.max(0, Math.min(100, Math.round(score)))
        : Math.round(score),
    scoreType,
    gameId,
    gameName: safeString(
      input.gameName ||
        (scoreType === "overall" ? "Overall Leaderboard" : "GG Learning Game"),
    ),
    levelName: safeString(input.levelName, 100),
    playerName: displayName,
    rank: Number.isInteger(rank) && rank > 0 ? rank : null,
    levels: Number.isInteger(levels) && levels > 0 ? levels : null,
    url:
      input.scoreType === "overall"
        ? new URL("leaderboard/", APP_URL).href
        : url,
  };
}

// Identity is broadcast by the shared navbar, which already reads the
// signed-in player's public Firestore profile. Never use email as the name.
function currentPlayerName() {
  if (typeof window === "undefined") return "";
  return safeString(window.zatamShareIdentity?.playerName, 64);
}

function loadCss() {
  if (document.querySelector("link[data-gg-score-share]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_URL;
  link.dataset.ggScoreShare = "true";
  document.head.append(link);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function rounded(ctx, x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function horizontalLine(ctx, x, y, width, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 2);
}

function lineText(ctx, text, maxWidth, maxLines = 2) {
  const tokens = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      String(text),
    ),
    (part) => part.segment,
  );
  const lines = [];
  let line = "";
  for (let index = 0; index < tokens.length; index++) {
    const glyph = tokens[index];
    if (ctx.measureText(line + glyph).width > maxWidth && line) {
      lines.push(line.trim());
      if (lines.length === maxLines - 1) {
        let last = tokens.slice(index).join("");
        while (
          ctx.measureText(last + "…").width > maxWidth &&
          Array.from(last).length > 1
        )
          last = Array.from(last).slice(0, -1).join("");
        lines.push(
          last.trimEnd() +
            (index + Array.from(last).length < tokens.length ? "…" : ""),
        );
        return lines;
      }
      line = glyph;
    } else line += glyph;
  }
  if (line) lines.push(line.trim());
  return lines.length ? lines : [""];
}

function fitLine(ctx, text, maxWidth) {
  let line = String(text);
  if (ctx.measureText(line).width <= maxWidth) return line;
  while (line.length > 1 && ctx.measureText(line + "…").width > maxWidth)
    line = Array.from(line).slice(0, -1).join("");
  return line.trimEnd() + "…";
}

function drawCentered(ctx, value, x, y, width) {
  ctx.textAlign = "center";
  ctx.fillText(fitLine(ctx, value, width), x, y);
}

function loadArtwork() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = KRISHNA_URL;
  });
}

export async function createScorecard(input = {}, options = {}) {
  const data = normalizeShareResult(input);
  const showName = Boolean(options.includeName && data.playerName);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot generate a scorecard.");

  if (document.fonts?.ready)
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  const logo = await loadArtwork();

  // Quiet editorial-style navy/gold layout matching the site-wide variables.
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, 1080, 1350);
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, "#09264a");
  gradient.addColorStop(1, "#164570");
  rounded(ctx, 42, 42, 996, 1266, 46, gradient);
  rounded(ctx, 58, 58, 964, 1234, 38, "rgba(255,255,255,.025)");
  ctx.strokeStyle = "rgba(246,178,59,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(62, 62, 956, 1226, 34);
  ctx.stroke();
  ctx.fillStyle = "#f6b23b";
  ctx.fillRect(103, 165, 100, 6);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffd36b";
  ctx.font = "bold 41px Arial, sans-serif";
  ctx.fillText("GG  ·  ZAT.AM", 104, 127);
  ctx.fillStyle = "#cbd9e8";
  ctx.font = "25px Arial, sans-serif";
  ctx.fillText("Learn Sanskrit. Celebrate progress.", 104, 208);

  if (logo) {
    rounded(ctx, 806, 102, 145, 145, 26, "#fffaf2");
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(815, 111, 127, 127, 20);
    ctx.clip();
    ctx.drawImage(logo, 815, 111, 127, 127);
    ctx.restore();
  }

  horizontalLine(ctx, 104, 296, 872, "rgba(255,255,255,.20)");
  ctx.textAlign = "center";
  ctx.fillStyle = "#f7d99c";
  ctx.font = "bold 26px Arial, sans-serif";
  drawCentered(
    ctx,
    data.scoreType === "overall"
      ? "MY LEADERBOARD ACHIEVEMENT"
      : data.scoreType === "cumulative"
        ? "MY GAME LEADERBOARD ACHIEVEMENT"
        : data.scoreType === "completion"
          ? "MY COMPLETION ACHIEVEMENT"
          : "MY GAME ACHIEVEMENT",
    540,
    371,
    850,
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 64px ${FONT}`;
  const titleLines = lineText(ctx, data.gameName, 840, 2);
  titleLines.forEach((line, index) =>
    drawCentered(ctx, line, 540, 477 + index * 76, 850),
  );
  const offset = titleLines.length > 1 ? 42 : 0;

  if (data.levelName) {
    ctx.font = `30px ${FONT}`;
    ctx.fillStyle = "#bcd0e4";
    drawCentered(ctx, data.levelName, 540, 554 + offset, 840);
  }

  const scoreY = 735;
  rounded(ctx, 164, scoreY - 118, 752, 314, 32, "#fffaf2");
  ctx.fillStyle = "#153a62";
  ctx.textAlign = "center";
  ctx.font = "bold 28px Arial, sans-serif";
  drawCentered(
    ctx,
    data.scoreType === "game"
      ? "YOUR SCORE"
      : data.scoreType === "completion"
        ? "FINISHED IN"
        : data.scoreType === "overall"
          ? "OVERALL POINTS"
          : "CUMULATIVE POINTS",
    540,
    scoreY - 42,
    650,
  );
  ctx.font = "bold 135px Arial, sans-serif";
  ctx.fillStyle = "#0b2b4f";
  drawCentered(
    ctx,
    Number(data.score).toLocaleString("en-US"),
    540,
    scoreY + 90,
    690,
  );
  if (data.scoreType === "game" || data.scoreType === "completion") {
    ctx.font = "30px Arial, sans-serif";
    ctx.fillStyle = "#556d82";
    ctx.fillText(
      data.scoreType === "completion" ? "SECONDS" : "OUT OF 100",
      540,
      scoreY + 145,
    );
  }

  let details = [];
  if (data.rank) details.push(`RANK  #${data.rank.toLocaleString("en-US")}`);
  if (data.levels)
    details.push(
      `${data.levels.toLocaleString("en-US")} ${data.levels === 1 ? "LEVEL" : "LEVELS"} COMPLETED`,
    );
  const detailsY = scoreY + 245;
  if (details.length) {
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillStyle = "#ffd36b";
    drawCentered(ctx, details.join("     ·     "), 540, detailsY, 840);
  }

  if (showName) {
    ctx.font = `bold 36px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    drawCentered(ctx, data.playerName, 540, detailsY + 78, 780);
  }

  const footerY = 1135;
  horizontalLine(ctx, 104, footerY, 872, "rgba(255,255,255,.2)");
  ctx.fillStyle = "#f8dfaa";
  ctx.font = "bold 36px Arial, sans-serif";
  drawCentered(
    ctx,
    data.scoreType === "completion"
      ? "Can you beat my time?"
      : "Can you beat my score?",
    540,
    1204,
    800,
  );
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 25px Arial, sans-serif";
  drawCentered(ctx, "Play at gg.zat.am", 540, 1251, 700);
  return canvas;
}

function shareText(data) {
  const label =
    data.scoreType === "game"
      ? `${data.score}/100`
      : data.scoreType === "completion"
        ? `a ${data.score}-second completion`
        : `${data.score.toLocaleString("en-US")} points`;
  const rank = data.rank ? ` · Rank #${data.rank}` : "";
  return data.scoreType === "completion"
    ? `I completed ${data.gameName} in ${data.score} seconds${data.levelName ? ` (${data.levelName})` : ""} on GG · Zat.am! Try it too!`
    : `I scored ${label}${rank} in ${data.gameName}${data.levelName ? ` (${data.levelName})` : ""} on GG · Zat.am! Can you beat my score?`;
}

function closeModal() {
  if (activeIdentityListener && typeof window !== "undefined") {
    window.removeEventListener("zatam:share-identity", activeIdentityListener);
    activeIdentityListener = null;
  }
  if (!modal) return;
  modal.remove();
  modal = null;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  previewFile = null;
  modalVersion++;
  document.removeEventListener("keydown", modalKeydown);
  formerFocus?.focus?.();
}

function modalKeydown(event) {
  if (!modal) return;
  if (event.key === "Escape") closeModal();
  if (event.key !== "Tab") return;
  const controls = [
    ...modal.querySelectorAll("button:not([disabled]), input:not([disabled])"),
  ];
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setNotice(node, message, error = false) {
  node.textContent = message;
  node.classList.toggle("gg-share-error", error);
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText)
    return navigator.clipboard.writeText(text);
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const worked = document.execCommand("copy");
  field.remove();
  if (!worked) throw new Error("Copy is unavailable");
}

/** Opens a professional share preview with native sharing and accessible fallbacks. */
export function openScoreShare(input = {}) {
  if (typeof document === "undefined") return;
  const data = normalizeShareResult(input);
  closeModal();
  loadCss();
  // Always prefer the current user's saved public display name over an empty
  // or outdated Firebase Auth displayName passed by an individual game.
  data.playerName = currentPlayerName() || data.playerName;
  formerFocus = document.activeElement;
  modalVersion++;
  const version = modalVersion;
  const overlay = element("div", "gg-share-overlay");
  overlay.setAttribute("role", "presentation");
  const dialog = element("section", "gg-share-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "gg-share-heading");
  const top = element("div", "gg-share-top");
  const heading = element("div");
  heading.append(
    element("span", "gg-share-kicker", "GG · ZAT.AM"),
    element("h2", "", "Share your achievement"),
  );
  const close = element("button", "gg-share-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Close sharing");
  close.addEventListener("click", closeModal);
  top.append(heading, close);
  const description = element(
    "p",
    "gg-share-description",
    "A personalized scorecard, ready to share with friends.",
  );
  const preview = element("div", "gg-share-preview");
  const image = element("img");
  image.alt = "Scorecard preview";
  preview.append(image);
  // Keep progress feedback separate from the PNG preview. The previous design
  // overlaid the loading text on the card whenever the player opted in to a name.
  const renderStatus = element("div", "gg-share-render-status");
  renderStatus.setAttribute("role", "status");
  renderStatus.setAttribute("aria-live", "polite");
  renderStatus.setAttribute("aria-atomic", "true");
  const renderSpinner = element("span", "gg-share-render-spinner");
  renderSpinner.setAttribute("aria-hidden", "true");
  const renderLabel = element("span", "gg-share-render-label");
  renderStatus.append(renderSpinner, renderLabel);
  function updateRenderStatus(state, message) {
    renderStatus.dataset.state = state;
    renderSpinner.hidden = state !== "loading";
    renderLabel.textContent = message;
    preview.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    preview.classList.toggle("gg-share-preview-updating", state === "loading");
  }
  const privacy = element("label", "gg-share-privacy");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.disabled = !data.playerName;
  privacy.append(
    checkbox,
    document.createTextNode(" Include my display name on the card"),
  );
  const nameHint = element(
    "p",
    "gg-share-name-hint",
    "Add a display name in your profile to enable this option.",
  );
  nameHint.hidden = Boolean(data.playerName);
  const actions = element("div", "gg-share-actions");
  const native = element("button", "gg-share-primary", "Share image to apps");
  native.type = "button";
  native.disabled = true;
  const download = element("button", "gg-share-secondary", "Download PNG");
  download.type = "button";
  download.disabled = true;
  actions.append(native, download);
  const socialHeading = element(
    "p",
    "gg-share-social-heading",
    "Share to a social network",
  );
  const socials = element("div", "gg-share-socials");
  for (const [label, name] of [
    ["WhatsApp", "whatsapp"],
    ["Facebook", "facebook"],
    ["X", "x"],
  ]) {
    const b = element("button", "gg-share-social", label);
    b.type = "button";
    b.dataset.network = name;
    socials.append(b);
  }
  const copyActions = element("div", "gg-share-copy-actions");
  const copyImage = element("button", "gg-share-copy", "Copy image");
  copyImage.type = "button";
  copyImage.disabled = true;
  const copy = element("button", "gg-share-copy", "Copy game link");
  copy.type = "button";
  copyActions.append(copyImage, copy);
  const notice = element("p", "gg-share-notice");
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  const footer = element(
    "p",
    "gg-share-footnote",
    "On phones, use Share image to apps and choose your app. Social website links cannot attach a local PNG automatically; download the card and add it to your post.",
  );
  dialog.append(
    top,
    description,
    preview,
    renderStatus,
    privacy,
    nameHint,
    actions,
    socialHeading,
    socials,
    copyActions,
    notice,
    footer,
  );
  overlay.append(dialog);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  modal = overlay;
  document.body.append(overlay);
  document.addEventListener("keydown", modalKeydown);
  close.focus();

  let previewRun = 0;
  async function renderPreview() {
    const localVersion = version;
    const run = ++previewRun;
    updateRenderStatus(
      "loading",
      image.hasAttribute("src")
        ? "Updating scorecard…"
        : "Preparing scorecard…",
    );
    native.disabled = true;
    download.disabled = true;
    copyImage.disabled = true;
    previewFile = null;
    socials
      .querySelectorAll("button")
      .forEach((button) => (button.disabled = true));
    setNotice(notice, "");
    try {
      const canvas = await createScorecard(data, {
        includeName: checkbox.checked,
      });
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PNG export failed")),
          "image/png",
        ),
      );
      if (
        localVersion !== modalVersion ||
        modal !== overlay ||
        run !== previewRun
      )
        return;
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = URL.createObjectURL(blob);
      previewFile = new File([blob], "gg-zatam-achievement.png", {
        type: "image/png",
      });
      image.src = previewObjectUrl;
      updateRenderStatus("ready", "Ready to share");
      native.disabled = false;
      download.disabled = false;
      socials
        .querySelectorAll("button")
        .forEach((button) => (button.disabled = false));
      const canShareImage =
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [previewFile] });
      native.textContent = canShareImage
        ? "Share image to apps"
        : "Save image to share";
      copyImage.disabled = !(
        navigator.clipboard?.write && typeof ClipboardItem !== "undefined"
      );
    } catch (error) {
      if (localVersion !== modalVersion || run !== previewRun) return;
      updateRenderStatus(
        "error",
        "Preview unavailable. You can still share the game link.",
      );
      native.disabled = false;
      native.textContent = "Copy game link";
      socials
        .querySelectorAll("button")
        .forEach((button) => (button.disabled = false));
      setNotice(
        notice,
        "Image generation is unavailable on this browser.",
        true,
      );
    }
  }
  // The navbar can finish fetching the profile after a game result opens.
  // Enable the opt-in checkbox as soon as the saved name becomes available.
  activeIdentityListener = (event) => {
    if (modal !== overlay) return;
    const nextName = safeString(event.detail?.playerName, 64);
    if (nextName === data.playerName) return;
    data.playerName = nextName;
    checkbox.disabled = !nextName;
    nameHint.hidden = Boolean(nextName);
    if (!nextName) checkbox.checked = false;
    if (checkbox.checked || !nextName) void renderPreview();
  };
  window.addEventListener("zatam:share-identity", activeIdentityListener);
  checkbox.addEventListener("change", () => {
    void renderPreview();
  });
  void renderPreview();

  function downloadImage() {
    if (!previewObjectUrl) return false;
    const link = element("a");
    link.href = previewObjectUrl;
    link.download = "gg-zatam-achievement.png";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    return true;
  }
  native.addEventListener("click", () => {
    if (
      previewFile &&
      typeof navigator.share === "function" &&
      navigator.canShare?.({ files: [previewFile] })
    ) {
      // Sharing the File (not just its URL) enables actual image attachment.
      // The OS/app determines which receiving targets support it.
      navigator
        .share({
          files: [previewFile],
          title: `GG · Zat.am · ${data.gameName}`,
          text: `${shareText(data)}\n${data.url}`,
        })
        .then(() => setNotice(notice, "Image shared using your device."))
        .catch((error) => {
          if (error?.name !== "AbortError")
            setNotice(
              notice,
              "The share sheet could not accept the image. Download the PNG and attach it manually.",
              true,
            );
        });
    } else if (downloadImage()) {
      setNotice(
        notice,
        "Image saved. Add the PNG as a photo in your social app.",
      );
    } else {
      void writeClipboard(`${shareText(data)}\n${data.url}`)
        .then(() =>
          setNotice(
            notice,
            "Game link copied. The image could not be generated.",
          ),
        )
        .catch(() =>
          setNotice(notice, "Sharing is unavailable on this browser.", true),
        );
    }
  });
  download.addEventListener("click", () => {
    if (downloadImage())
      setNotice(notice, "PNG downloaded. Attach it as a photo in your post.");
  });
  copyImage.addEventListener("click", () => {
    if (
      !previewFile ||
      !navigator.clipboard?.write ||
      typeof ClipboardItem === "undefined"
    ) {
      setNotice(
        notice,
        "Copy image is not supported here. Download PNG instead.",
        true,
      );
      return;
    }
    void navigator.clipboard
      .write([new ClipboardItem({ "image/png": previewFile })])
      .then(() =>
        setNotice(
          notice,
          "Scorecard image copied. Paste it into a supported social app.",
        ),
      )
      .catch(() =>
        setNotice(notice, "Could not copy image. Download PNG instead.", true),
      );
  });
  copy.addEventListener("click", () => {
    void writeClipboard(`${shareText(data)}\n${data.url}`)
      .then(() => setNotice(notice, "Score and game link copied."))
      .catch(() =>
        setNotice(
          notice,
          "Copy is unavailable. Use your browser’s share menu.",
          true,
        ),
      );
  });
  socials.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-network]");
    if (!target) return;
    const network = target.dataset.network;
    const names = { whatsapp: "WhatsApp", facebook: "Facebook", x: "X" };
    if (
      previewFile &&
      typeof navigator.share === "function" &&
      navigator.canShare?.({ files: [previewFile] })
    ) {
      // The Web Share API cannot force a particular target application.
      setNotice(
        notice,
        `Choose ${names[network]} in the share sheet to send the PNG. If it is not listed, download and attach the image instead.`,
      );
      navigator
        .share({
          files: [previewFile],
          title: `GG · Zat.am · ${data.gameName}`,
          text: `${shareText(data)}\n${data.url}`,
        })
        .catch((error) => {
          if (error?.name !== "AbortError")
            setNotice(
              notice,
              "Could not share the image. Download it and attach it manually.",
              true,
            );
        });
      return;
    }
    // Website social-intent endpoints only accept text/URLs, never client-side
    // File objects. Download the PNG first and explicitly explain the step.
    if (previewFile) downloadImage();
    const encodedText = encodeURIComponent(shareText(data) + " " + data.url);
    const encodedUrl = encodeURIComponent(data.url);
    const urls = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodedText}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(data))}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    };
    window.open(urls[network], "_blank", "noopener,noreferrer");
    setNotice(
      notice,
      `Add the downloaded scorecard PNG to your ${names[network]} post or message. The link alone cannot upload the image.`,
    );
  });
}

/** Attach the share control to a game's completed-result panel, never the screen corner. */
function findResultContainer(gameId) {
  const selector = {
    "018-as": "#successMessage",
    "059-fitb": "#result",
    fw: "#finishMessage",
    "01-wordSearch": "#bp26CelebrateOverlay .bp26CelebrateBox",
    strands: ".modal-backdrop .result-card",
  }[gameId];
  return selector ? document.querySelector(selector) : null;
}

function removeInlineButton() {
  inlineShareButton?.remove();
  inlineShareButton = null;
  // Remove legacy fixed-position shortcut left by an older version.
  document.getElementById("gg-score-share-shortcut")?.remove();
}

export function hasCompletedScoreShare() {
  return currentData != null;
}

export function openCompletedScoreShare() {
  if (currentData) openScoreShare(currentData);
}

/** Store one completed result, then place Share Score within its game result. */
export function showCompletedScoreShare(input = {}) {
  if (typeof document === "undefined") return;
  currentData = normalizeShareResult(input);
  loadCss();
  removeInlineButton();
  document.dispatchEvent(new Event("gg-score-share-ready"));
  // ZIM canvas result dialogs and the React Strands modal provide their own
  // contextual button. The typing game already has its own #share button.
  if (["z18", "strands", "07-gitaTyping"].includes(currentData.gameId))
    return;
  const container = findResultContainer(currentData.gameId);
  if (!container) return;
  const button = element("button", "gg-share-inline-button", "✦ Share Score");
  button.type = "button";
  button.setAttribute("aria-label", "Share your completed game score");
  button.addEventListener("click", openCompletedScoreShare);
  const actionRow = container.querySelector(".zatam-game-actions");
  if (actionRow) actionRow.prepend(button);
  else container.append(button);
  inlineShareButton = button;
}

export function clearCompletedScoreShare() {
  currentData = null;
  removeInlineButton();
  document.dispatchEvent(new Event("gg-score-share-ready"));
  closeModal();
}
