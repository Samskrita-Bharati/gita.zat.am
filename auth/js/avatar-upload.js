import { updateUserProfile } from "../api/auth-api.js";
import { db, doc, setDoc } from "../api/firebase-config.js";
import { AVATAR_UPLOAD_ENDPOINT } from "./avatar-config.js";
import { resolveAvatarState } from "./avatar-state.js";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 32_000_000;
const MAX_CROPPED_BYTES = 350_000;
const CANVAS_SIZE = 400;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function initProfilePhotoEditor({ getUser, getProfile, onSaved }) {
  const get = (id) => document.getElementById(id);
  const choose = get("avatar-choose-btn");
  const fileInput = get("avatar-file-input");
  const status = get("avatar-status");
  const dialog = get("avatar-editor");
  const canvas = get("avatar-crop-canvas");
  const zoomInput = get("avatar-zoom");
  const zoomValue = get("avatar-zoom-value");
  const error = get("avatar-dialog-error");
  const save = get("avatar-save-btn");
  const cancel = get("avatar-cancel-btn");
  const close = get("avatar-close-btn");
  const optionsDialog = get("avatar-options-dialog");
  const optionsClose = get("avatar-options-close");
  const optionsError = get("avatar-options-error");
  const optionUpload = get("avatar-option-upload");
  const optionCustom = get("avatar-option-custom");
  const optionGoogle = get("avatar-option-google");
  const optionDefault = get("avatar-option-default");
  if (
    ![
      choose,
      fileInput,
      status,
      dialog,
      canvas,
      zoomInput,
      zoomValue,
      error,
      save,
      cancel,
      close,
      optionsDialog,
      optionsClose,
      optionsError,
      optionUpload,
      optionCustom,
      optionGoogle,
      optionDefault,
    ].every(Boolean)
  )
    return;

  const context = canvas.getContext("2d");
  if (!context) return;
  let sourceImage = null;
  let imageObjectURL = null;
  let zoom = 1;
  let dx = 0;
  let dy = 0;
  let busy = false;
  let dragging = false;
  let lastPointer = null;
  let optionsBusy = false;
  const optionButtons = [
    optionUpload,
    optionCustom,
    optionGoogle,
    optionDefault,
  ];

  function flash(message, isError = false) {
    status.hidden = false;
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function dialogError(message = "") {
    error.textContent = message;
    error.hidden = !message;
  }

  function setOptionsError(message = "") {
    optionsError.textContent = message;
    optionsError.hidden = !message;
  }

  function currentState() {
    return resolveAvatarState(getUser(), getProfile());
  }

  function showOptions() {
    if (busy || optionsBusy) return;
    if (!getUser()) {
      flash("Please sign in before changing your profile photo.", true);
      return;
    }
    const state = currentState();
    optionCustom.hidden = !state.customPhotoURL;
    optionGoogle.hidden = !state.googlePhotoURL;
    for (const [button, name] of [
      [optionCustom, "custom"],
      [optionGoogle, "google"],
      [optionDefault, "default"],
    ]) {
      const marker = button.querySelector(".avatar-option-current");
      if (marker) marker.hidden = state.source !== name;
    }
    setOptionsError();
    optionsDialog.hidden = false;
    document.body.classList.add("avatar-dialog-open");
    optionUpload.focus();
  }

  function closeOptions(force = false) {
    if (optionsBusy && !force) return;
    optionsDialog.hidden = true;
    if (dialog.hidden) document.body.classList.remove("avatar-dialog-open");
    choose.focus();
  }

  async function applyChoice(source) {
    if (optionsBusy || busy) return;
    const user = getUser();
    if (!user) {
      setOptionsError("Please sign in again.");
      return;
    }
    const old = currentState();
    const photoURL =
      source === "custom"
        ? old.customPhotoURL
        : source === "google"
          ? old.googlePhotoURL
          : "";
    if (source !== "default" && !photoURL) {
      setOptionsError(
        "This photo is no longer available. Try uploading a new one.",
      );
      return;
    }
    if (source === old.source && photoURL === old.photoURL) {
      closeOptions();
      return;
    }
    optionsBusy = true;
    optionButtons.forEach((button) => {
      button.disabled = true;
    });
    optionsClose.disabled = true;
    setOptionsError();
    try {
      const patch = {
        avatarSource: source,
        photoURL,
        customPhotoURL: old.customPhotoURL || "",
        googlePhotoURL: old.googlePhotoURL || "",
      };
      // Save the database first so a failed updateProfile never makes the
      // stored display preference disappear. See the deployment guide.
      await setDoc(doc(db, "users", user.uid, "public", "profile"), patch, {
        merge: true,
      });
      try {
        await updateUserProfile(user, { photoURL: photoURL || null });
      } catch (err) {
        // The Firestore preference is authoritative for both profile/navbar.
        console.warn(
          "Auth photoURL sync failed; Firestore preference was saved:",
          err,
        );
      }
      onSaved(patch);
      closeOptions(true);
      flash(
        source === "google"
          ? "Google profile photo restored."
          : source === "custom"
            ? "Uploaded profile photo restored."
            : "Default avatar is now active.",
      );
    } catch (err) {
      console.error("Avatar choice failed:", err);
      setOptionsError(
        "Couldn't save this change. Check your connection and try again.",
      );
    } finally {
      optionsBusy = false;
      optionButtons.forEach((button) => {
        button.disabled = false;
      });
      optionsClose.disabled = false;
    }
  }

  function dimensions() {
    if (!sourceImage) return { width: CANVAS_SIZE, height: CANVAS_SIZE };
    const baseScale = Math.max(
      CANVAS_SIZE / sourceImage.naturalWidth,
      CANVAS_SIZE / sourceImage.naturalHeight,
    );
    return {
      width: sourceImage.naturalWidth * baseScale * zoom,
      height: sourceImage.naturalHeight * baseScale * zoom,
    };
  }

  function clampPosition() {
    const { width, height } = dimensions();
    dx = Math.min(
      Math.max(dx, (CANVAS_SIZE - width) / 2),
      (width - CANVAS_SIZE) / 2,
    );
    dy = Math.min(
      Math.max(dy, (CANVAS_SIZE - height) / 2),
      (height - CANVAS_SIZE) / 2,
    );
  }

  function redraw() {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!sourceImage) return;
    clampPosition();
    const { width, height } = dimensions();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      sourceImage,
      (CANVAS_SIZE - width) / 2 + dx,
      (CANVAS_SIZE - height) / 2 + dy,
      width,
      height,
    );
  }

  function closeEditor(force = false) {
    if (busy && !force) return;
    dialog.hidden = true;
    document.body.classList.remove("avatar-dialog-open");
    dragging = false;
    lastPointer = null;
    sourceImage = null;
    if (imageObjectURL) URL.revokeObjectURL(imageObjectURL);
    imageObjectURL = null;
    fileInput.value = "";
    choose.focus();
  }

  choose.addEventListener("click", showOptions);
  optionsClose.addEventListener("click", () => closeOptions());
  optionUpload.addEventListener("click", () => {
    closeOptions();
    fileInput.click();
  });
  optionCustom.addEventListener("click", () => applyChoice("custom"));
  optionGoogle.addEventListener("click", () => applyChoice("google"));
  optionDefault.addEventListener("click", () => applyChoice("default"));

  optionsDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOptions();
      return;
    }
    if (event.key === "Tab") {
      const items = [optionsClose, ...optionButtons].filter(
        (button) => !button.hidden && !button.disabled,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  optionsDialog.addEventListener("click", (event) => {
    if (event.target === optionsDialog) closeOptions();
  });

  cancel.addEventListener("click", () => closeEditor());
  close.addEventListener("click", () => closeEditor());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeEditor();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      flash("Choose a JPG, PNG or WEBP image.", true);
      fileInput.value = "";
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      flash("The original image must be 2 MB or smaller.", true);
      fileInput.value = "";
      return;
    }
    if (imageObjectURL) URL.revokeObjectURL(imageObjectURL);
    imageObjectURL = URL.createObjectURL(file);
    const next = new Image();
    try {
      next.src = imageObjectURL;
      await next.decode();
      if (next.naturalWidth * next.naturalHeight > MAX_SOURCE_PIXELS) {
        throw new Error(
          "This image is too large. Choose one with a lower resolution.",
        );
      }
      if (!next.naturalWidth || !next.naturalHeight)
        throw new Error("This image cannot be opened.");
    } catch (err) {
      flash(
        err.message || "This image could not be opened. Please try another.",
        true,
      );
      URL.revokeObjectURL(imageObjectURL);
      imageObjectURL = null;
      fileInput.value = "";
      return;
    }
    sourceImage = next;
    dx = 0;
    dy = 0;
    zoom = 1;
    zoomInput.value = "1";
    zoomValue.textContent = "100%";
    dialogError();
    status.hidden = true;
    dialog.hidden = false;
    document.body.classList.add("avatar-dialog-open");
    redraw();
    canvas.focus();
  });

  zoomInput.addEventListener("input", () => {
    zoom = Number(zoomInput.value) || 1;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    redraw();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (
      !sourceImage ||
      busy ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !lastPointer || !sourceImage) return;
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    dx += (event.clientX - lastPointer.x) * scale;
    dy += (event.clientY - lastPointer.y) * scale;
    lastPointer = { x: event.clientX, y: event.clientY };
    redraw();
  });
  const stopDrag = () => {
    dragging = false;
    lastPointer = null;
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("lostpointercapture", stopDrag);

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
      return;
    }
    if (
      event.target === canvas &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const step = event.shiftKey ? 18 : 7;
      if (event.key === "ArrowLeft") dx -= step;
      if (event.key === "ArrowRight") dx += step;
      if (event.key === "ArrowUp") dy -= step;
      if (event.key === "ArrowDown") dy += step;
      redraw();
    }
    if (event.key === "Tab") {
      const items = [
        ...dialog.querySelectorAll(
          'button:not(:disabled), input[type="range"], canvas[tabindex]',
        ),
      ].filter((el) => el.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  function makeBlob(quality) {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not prepare your photo.")),
        "image/jpeg",
        quality,
      ),
    );
  }

  save.addEventListener("click", async () => {
    if (!sourceImage || busy) return;
    if (
      !AVATAR_UPLOAD_ENDPOINT ||
      !/^https:\/\//.test(AVATAR_UPLOAD_ENDPOINT)
    ) {
      dialogError(
        "Photo uploads aren't configured for GG yet. Contact the administrator.",
      );
      return;
    }
    const user = getUser();
    if (!user) {
      dialogError("Your session expired. Please sign in again.");
      return;
    }
    busy = true;
    save.disabled = true;
    cancel.disabled = true;
    close.disabled = true;
    save.textContent = "Saving…";
    dialogError();
    try {
      let imageBlob;
      for (const quality of [0.86, 0.77, 0.66]) {
        imageBlob = await makeBlob(quality);
        if (imageBlob.size <= MAX_CROPPED_BYTES) break;
      }
      if (imageBlob.size > MAX_CROPPED_BYTES) {
        throw new Error(
          "The processed photo is still too large. Try another image.",
        );
      }

      const idToken = await user.getIdToken(true);

      const response = await fetch(AVATAR_UPLOAD_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "image/jpeg",
        },
        body: imageBlob,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "Upload failed. Please try again.");
      const url = new URL(result.url || "");
      if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") {
        throw new Error("The upload service returned an invalid image URL.");
      }
      const state = currentState();
      const patch = {
        avatarSource: "custom",
        photoURL: url.href,
        customPhotoURL: url.href,
        googlePhotoURL: state.googlePhotoURL || "",
      };
      await setDoc(doc(db, "users", user.uid, "public", "profile"), patch, {
        merge: true,
      });
      try {
        await updateUserProfile(user, { photoURL: url.href });
      } catch (err) {
        console.warn(
          "Auth photoURL sync failed; Firestore preference was saved:",
          err,
        );
      }
      onSaved(patch);
      closeEditor(true);
      flash("Profile photo updated successfully.");
    } catch (err) {
      console.error("Avatar update failed:", err);
      dialogError(
        err.message || "Unable to update your photo. Please try again.",
      );
    } finally {
      busy = false;
      save.disabled = false;
      cancel.disabled = false;
      close.disabled = false;
      save.textContent = "Save photo";
    }
  });

  dialog.hidden = true;
  optionsDialog.hidden = true;
}
