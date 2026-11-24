/**
 * GG — Zat.am referral API. Spark-safe: no Firebase Cloud Functions.
 * Every Firestore write uses a Google service account OAuth token.
 * Firebase browser clients have NO permission to write referral collections.
 * Keep SERVICE_ACCOUNT_JSON in a Worker secret; never commit it.
 */
import {
  isReferralCode,
  newAccountIsEligible,
  canConfirmClaim,
  cleanPlayerName,
  fields,
  unmarshal,
  codeFromBytes,
  leaderboardRows,
} from "./referral-model.mjs";

let tokenCache = null;
const encoder = new TextEncoder();
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
const urlPart = (part) => encodeURIComponent(String(part));

function originIsAllowed(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const allowed = String(env.ALLOWED_ORIGIN || "https://gg.zat.am");
  if (origin === allowed) return true;
  return (
    env.ALLOW_LOCALHOST === "1" &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  );
}

function corsHeaders(request) {
  return {
    "access-control-allow-origin": request.headers.get("Origin"),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "3600",
    vary: "Origin",
  };
}

function base64url(value) {
  const bytes = value instanceof Uint8Array ? value : encoder.encode(value);
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function googleAccessToken(env) {
  if (tokenCache && tokenCache.expires > Date.now() + 60_000)
    return tokenCache.token;
  const service = JSON.parse(env.SERVICE_ACCOUNT_JSON || "{}");
  if (
    !service.client_email ||
    !service.private_key ||
    service.project_id !== env.FIREBASE_PROJECT_ID
  ) {
    throw new Error(
      "Worker service account is not configured for the Firebase project",
    );
  }
  const keyData = Uint8Array.from(
    atob(service.private_key.replace(/-----[^-]+-----|\s/g, "")),
    (x) => x.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const assertion = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        iss: service.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  ].join(".");
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      encoder.encode(assertion),
    ),
  );
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${assertion}.${base64url(signature)}`,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok)
    throw new Error(
      `Google service-account authorization failed (${response.status})`,
    );
  const result = await response.json();
  tokenCache = {
    token: result.access_token,
    expires: Date.now() + (Number(result.expires_in) || 3600) * 1000,
  };
  return tokenCache.token;
}

async function getAccount(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization)) return null;
  const idToken = authorization.slice(7);
  // Identity Toolkit validates token signature, audience, project, expiry and current user.
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${urlPart(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.users?.length === 1 ? data.users[0] : null;
}

const firestoreBase = (env) =>
  `https://firestore.googleapis.com/v1/projects/${urlPart(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
const documentPath = (env, collection, id) =>
  `${firestoreBase(env)}/${urlPart(collection)}/${urlPart(id)}`;
const fullDocument = (env, collection, id) =>
  `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;

async function firestoreRequest(env, resource, options = {}) {
  const headers = {
    Authorization: `Bearer ${await googleAccessToken(env)}`,
    ...options.headers,
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(resource, {
    method: options.method || "GET",
    headers,
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(
      data.error?.message || `Firestore error ${response.status}`,
    );
    error.code = response.status;
    throw error;
  }
  return data;
}

async function getDocument(env, collection, id, transaction = null) {
  const endpoint = documentPath(env, collection, id);
  return firestoreRequest(
    env,
    transaction
      ? `${endpoint}?transaction=${encodeURIComponent(transaction)}`
      : endpoint,
  );
}

function writeDocument(env, collection, id, data, opts = {}) {
  return {
    update: { name: fullDocument(env, collection, id), fields: fields(data) },
    ...(opts.updateMask ? { updateMask: { fieldPaths: opts.updateMask } } : {}),
    ...(opts.currentDocument ? { currentDocument: opts.currentDocument } : {}),
  };
}

function startTransaction(env) {
  return firestoreRequest(env, `${firestoreBase(env)}:beginTransaction`, {
    method: "POST",
    body: { options: { readWrite: {} } },
  });
}

function commit(env, writes, transaction = undefined) {
  return firestoreRequest(env, `${firestoreBase(env)}:commit`, {
    method: "POST",
    body: { writes, ...(transaction ? { transaction } : {}) },
  });
}

function safeStat(record, uid) {
  return record
    ? {
        uid,
        referralCode: record.referralCode,
        referralCount: Math.max(0, record.referralCount || 0),
      }
    : { uid, referralCode: null, referralCount: 0 };
}

async function ensureReferralCode(env, account) {
  const uid = account.localId;
  const existing = unmarshal(await getDocument(env, "referralStats", uid));
  if (existing?.referralCode) return safeStat(existing, uid);
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = codeFromBytes(crypto.getRandomValues(new Uint8Array(8)));
    const now = new Date().toISOString();
    try {
      await commit(env, [
        writeDocument(
          env,
          "referralCodes",
          code,
          { ownerUid: uid, createdAt: now },
          { currentDocument: { exists: false } },
        ),
        writeDocument(
          env,
          "referralStats",
          uid,
          {
            referralCode: code,
            referralCount: 0,
            displayName: cleanPlayerName(account.displayName),
            createdAt: now,
            updatedAt: now,
          },
          { currentDocument: { exists: false } },
        ),
      ]);
      return { uid, referralCode: code, referralCount: 0 };
    } catch (error) {
      if (error.code !== 409 && error.code !== 412) throw error;
      const winning = unmarshal(await getDocument(env, "referralStats", uid));
      if (winning?.referralCode) return safeStat(winning, uid);
    }
  }
  throw new Error("Could not create a unique referral code");
}

async function claimReferral(env, account, code) {
  if (!isReferralCode(code))
    return json({ error: "Invalid referral code" }, 400);
  if (!newAccountIsEligible(account))
    return json(
      { error: "Referrals are available only during new account registration" },
      403,
    );
  const uid = account.localId;
  const current = unmarshal(await getDocument(env, "referralClaims", uid));
  if (current)
    return json({
      status: current.status,
      credited: current.status === "confirmed",
    });
  const owner = unmarshal(await getDocument(env, "referralCodes", code));
  if (!owner?.ownerUid) return json({ error: "Referral link not found" }, 404);
  if (owner.ownerUid === uid)
    return json({ error: "You cannot invite yourself" }, 403);
  const now = new Date().toISOString();
  try {
    await commit(env, [
      writeDocument(
        env,
        "referralClaims",
        uid,
        {
          referredUid: uid,
          referrerUid: owner.ownerUid,
          referralCode: code,
          status: "pending",
          createdAt: now,
        },
        { currentDocument: { exists: false } },
      ),
    ]);
    return json({ status: "pending" });
  } catch (error) {
    if (error.code !== 409 && error.code !== 412) throw error;
    const winning = unmarshal(await getDocument(env, "referralClaims", uid));
    return json({ status: winning?.status || "pending" });
  }
}

async function confirmReferral(env, account) {
  if (!account.emailVerified || account.disabled)
    return json({ status: "not-verified" });
  const uid = account.localId;
  for (let tries = 0; tries < 4; tries++) {
    const transactionInfo = await startTransaction(env);
    const transaction = transactionInfo.transaction;
    const claimDoc = await getDocument(env, "referralClaims", uid, transaction);
    const claim = unmarshal(claimDoc);
    if (!claim) return json({ status: "none" });
    if (claim.status === "confirmed") return json({ status: "confirmed" });
    if (!canConfirmClaim(account, claim))
      return json({ status: "ineligible" }, 403);
    const statDoc = await getDocument(
      env,
      "referralStats",
      claim.referrerUid,
      transaction,
    );
    const stat = unmarshal(statDoc);
    if (!stat || stat.referralCode !== claim.referralCode)
      return json({ status: "ineligible" }, 403);
    const now = new Date().toISOString();
    try {
      await commit(
        env,
        [
          writeDocument(
            env,
            "referralClaims",
            uid,
            { status: "confirmed", confirmedAt: now },
            {
              updateMask: ["status", "confirmedAt"],
              currentDocument: { updateTime: claimDoc.updateTime },
            },
          ),
          writeDocument(
            env,
            "referralStats",
            claim.referrerUid,
            {
              referralCount: Math.max(0, stat.referralCount || 0) + 1,
              updatedAt: now,
            },
            {
              updateMask: ["referralCount", "updatedAt"],
              currentDocument: { updateTime: statDoc.updateTime },
            },
          ),
        ],
        transaction,
      );
      return json({ status: "confirmed" });
    } catch (error) {
      if (![409, 412].includes(error.code) || tries === 3) throw error;
    }
  }
  return json({ error: "Please retry referral confirmation" }, 503);
}

async function leaderboard(env) {
  // Firestore query reads only up to 10 summary documents, never referral history.
  const query = {
    structuredQuery: {
      from: [{ collectionId: "referralStats" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "referralCount" },
          op: "GREATER_THAN",
          value: { integerValue: "0" },
        },
      },
      orderBy: [
        { field: { fieldPath: "referralCount" }, direction: "DESCENDING" },
      ],
      limit: 10,
    },
  };
  const result = await firestoreRequest(env, `${firestoreBase(env)}:runQuery`, {
    method: "POST",
    body: query,
  });
  return { players: leaderboardRows(result) };
}

async function cachedLeaderboard(env, ctx) {
  // Edge cache is keyed globally (not by user), after the ID token is checked.
  // No referral details or emails are included, only ranked name snapshots.
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request("https://gg.zat.am/__internal/referral-top-ten");
  if (cache) {
    const saved = await cache.match(key);
    if (saved) return saved.json();
  }
  const result = await leaderboard(env);
  if (cache && ctx?.waitUntil) {
    ctx.waitUntil(
      cache.put(
        key,
        new Response(JSON.stringify(result), {
          headers: {
            "cache-control": "public, max-age=60",
            "content-type": "application/json",
          },
        }),
      ),
    );
  }
  return result;
}

export default {
  async fetch(request, env, ctx) {
    if (!originIsAllowed(request, env))
      return json({ error: "Origin not allowed" }, 403);
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    try {
      if (
        !env.FIREBASE_WEB_API_KEY ||
        !env.FIREBASE_PROJECT_ID ||
        !env.SERVICE_ACCOUNT_JSON
      ) {
        return json({ error: "Referral service is not configured" }, 503, cors);
      }
      const account = await getAccount(request, env);
      if (!account) return json({ error: "Sign in required" }, 401, cors);
      if (account.disabled)
        return json({ error: "Account is disabled" }, 403, cors);
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path === "/api/me") {
        const stat = unmarshal(
          await getDocument(env, "referralStats", account.localId),
        );
        return json(safeStat(stat, account.localId), 200, cors);
      }
      if (request.method === "GET" && path === "/api/leaderboard") {
        return json(await cachedLeaderboard(env, ctx), 200, cors);
      }
      if (request.method === "POST" && path === "/api/code") {
        if (!account.emailVerified)
          return json(
            { error: "Verify your account to invite friends" },
            403,
            cors,
          );
        return json(await ensureReferralCode(env, account), 200, cors);
      }
      if (request.method === "POST" && path === "/api/claim") {
        const body = await request.json().catch(() => ({}));
        const response = await claimReferral(env, account, body.code);
        return json(await response.json(), response.status, cors);
      }
      if (request.method === "POST" && path === "/api/confirm") {
        const response = await confirmReferral(env, account);
        return json(await response.json(), response.status, cors);
      }
      return json({ error: "Not found" }, 404, cors);
    } catch (error) {
      console.error("GG referral API error:", error?.message);
      return json(
        { error: "Referral service is temporarily unavailable" },
        503,
        cors,
      );
    }
  },
};
