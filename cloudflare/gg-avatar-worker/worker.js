/**
 * GG — Zat.am profile-picture upload API
 *
 * Based on the existing working Zat.am Cloudflare Worker.
 * Zero npm dependencies.
 *
 * Required Cloudflare variables:
 * CLOUDINARY_CLOUD_NAME
 * CLOUDINARY_API_KEY
 * CLOUDINARY_API_SECRET
 * FIREBASE_WEB_API_KEY (from GG Firebase project)
 * ALLOWED_ORIGINS
 */

const MAX_JPEG_BYTES = 350_000;
const encoder = new TextEncoder();

// Best-effort rate limiting per Worker isolate.
const recentUploads = new Map();

function respond(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");

  const origins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!origin || !origins.includes(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

async function digestHex(algorithm, data) {
  const hash = new Uint8Array(
    await crypto.subtle.digest(algorithm, encoder.encode(data)),
  );

  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify the GG Firebase ID token using Firebase Auth.
async function firebaseUser(request, env) {
  const match = /^Bearer (\S+)$/i.exec(
    request.headers.get("Authorization") || "",
  );

  if (!match || match[1].length > 8192) return null;

  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup" +
      "?key=" +
      encodeURIComponent(env.FIREBASE_WEB_API_KEY),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken: match[1],
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (response.status === 400 || response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Firebase account lookup failed (${response.status})`);
  }

  const payload = await response.json();
  const user = payload?.users?.[0];

  if (
    !user ||
    typeof user.localId !== "string" ||
    !user.localId ||
    user.localId.length > 128 ||
    user.emailVerified !== true ||
    user.disabled === true
  ) {
    return null;
  }

  return user.localId;
}

function checkRate(uid) {
  const now = Date.now();

  if (recentUploads.size > 2000) {
    for (const [key, record] of recentUploads) {
      if (now - record.start >= 60000) {
        recentUploads.delete(key);
      }
    }

    if (recentUploads.size > 2500) {
      recentUploads.clear();
    }
  }

  const record = recentUploads.get(uid);

  if (!record || now - record.start >= 60000) {
    recentUploads.set(uid, {
      start: now,
      count: 1,
    });
    return true;
  }

  if (record.count >= 5) return false;

  record.count++;
  return true;
}

// Read and validate the cropped JPEG uploaded by GG.
async function limitedImage(body) {
  if (!body) return null;

  const reader = body.getReader();
  const parts = [];
  let total = 0;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    total += value.byteLength;

    if (total > MAX_JPEG_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }

    parts.push(value);
  }

  if (total < 17) return null;

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  // JPEG start and end markers.
  if (
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff ||
    bytes[total - 2] !== 0xff ||
    bytes[total - 1] !== 0xd9
  ) {
    return null;
  }

  return bytes;
}

// Preserve the original Zat.am Cloudinary upload logic.
async function cloudinaryUpload(bytes, uid, env) {
  const opaque = await digestHex(
    "SHA-256",
    `${uid}:${env.CLOUDINARY_API_SECRET}`,
  );

  // GG-specific namespace prevents collisions with Zat.am.
  const publicId = `gg-zatam/avatars/${opaque.slice(0, 40)}`;

  const params = {
    format: "jpg",
    overwrite: "true",
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation: "c_fill,h_400,w_400",
    unique_filename: "false",
  };

  const signBase = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const signature = await digestHex(
    "SHA-1",
    signBase + env.CLOUDINARY_API_SECRET,
  );

  const form = new FormData();

  form.append("file", new Blob([bytes], { type: "image/jpeg" }), "avatar.jpg");

  for (const [key, value] of Object.entries(params)) {
    form.append(key, value);
  }

  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/` +
      `${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}` +
      `/image/upload`,
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000),
    },
  );

  if (!response.ok) {
    // Log the actual Cloudinary failure on the server.
    const errorText = await response.text();

    console.error(
      "Cloudinary upload error: " +
        JSON.stringify({
          status: response.status,
          details: errorText.slice(0, 500),
        }),
    );

    throw new Error(`Cloudinary rejected upload (${response.status})`);
  }

  const result = await response.json();
  const url = new URL(result.secure_url || "");

  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    result.public_id !== publicId ||
    result.resource_type !== "image" ||
    result.width !== 400 ||
    result.height !== 400 ||
    result.format !== "jpg"
  ) {
    throw new Error("Cloudinary response did not match expected image");
  }

  return url.href;
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path === "/health" && request.method === "GET") {
      return respond({ ok: true });
    }

    if (path !== "/avatar") {
      return respond({ error: "Not found" }, 404);
    }

    const cors = corsHeaders(request, env);

    if (!cors) {
      return respond({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    if (request.method !== "POST") {
      return respond({ error: "Method not allowed" }, 405, cors);
    }

    const reject = (message, status) =>
      respond({ error: message }, status, cors);

    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET ||
      !env.FIREBASE_WEB_API_KEY ||
      [
        env.CLOUDINARY_CLOUD_NAME,
        env.CLOUDINARY_API_KEY,
        env.FIREBASE_WEB_API_KEY,
      ].some((s) => String(s).startsWith("REPLACE"))
    ) {
      return reject("Upload service is not configured", 503);
    }

    if (
      !/^image\/jpeg(?:;|$)/i.test(request.headers.get("Content-Type") || "")
    ) {
      return reject("Please upload a JPEG image", 415);
    }

    const claimedSize = Number(request.headers.get("Content-Length") || 0);

    if (claimedSize > MAX_JPEG_BYTES) {
      return reject("Photo exceeds upload size limit", 413);
    }

    let uid;

    try {
      uid = await firebaseUser(request, env);
    } catch (error) {
      console.error(
        "GG Firebase auth lookup failed:",
        error?.message || "unknown",
      );

      return reject("Could not verify account. Please try again.", 503);
    }

    if (!uid) {
      return reject("Sign in with a verified account to upload a photo", 401);
    }

    // Optional native Cloudflare rate limiter.
    if (env.AVATAR_RATE_LIMIT) {
      const limited = await env.AVATAR_RATE_LIMIT.limit({
        key: uid,
      });

      if (!limited.success) {
        return reject("Too many photo changes. Try again later.", 429);
      }
    }

    if (!checkRate(uid)) {
      return reject("Too many photo changes. Try again in a minute.", 429);
    }

    let image;

    try {
      image = await limitedImage(request.body);
    } catch {
      return reject("Could not read the image", 400);
    }

    if (!image) {
      return reject("Invalid JPEG or image exceeds 350 KB", 413);
    }

    try {
      const url = await cloudinaryUpload(image, uid, env);

      return respond({ url }, 200, cors);
    } catch (error) {
      console.error("GG avatar upload failed:", error?.message || "unknown");

      return reject("Could not upload photo. Please try again.", 502);
    }
  },
};
