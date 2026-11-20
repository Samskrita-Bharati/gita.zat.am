import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/gg-avatar-worker/worker.js';

const endpoint = 'https://gg-zatam-avatar-upload.example.workers.dev/avatar';
const env = {
  ALLOWED_ORIGINS: 'https://gg.zat.am',
  FIREBASE_WEB_API_KEY: 'gg-browser-key',
  CLOUDINARY_CLOUD_NAME: 'testcloud',
  CLOUDINARY_API_KEY: 'cloud-api-key',
  CLOUDINARY_API_SECRET: 'never-public-secret',
  AVATAR_RATE_LIMITER: { async limit() { return { success: true }; } },
};
const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
function request({ origin = 'https://gg.zat.am', token = 'valid.token.here', body = jpeg,
                   contentType = 'image/jpeg', method = 'POST' } = {}) {
  return new Request(endpoint, {
    method,
    headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    ...(method === 'POST' ? { body } : {}),
  });
}

async function sha1(text) {
  const buffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Buffer.from(buffer).toString('hex');
}

describe('GG image upload Worker', () => {
  it('rejects unauthorized website origins', async () => {
    const res = await worker.fetch(request({ origin: 'https://evil.example' }), env);
    assert.equal(res.status, 403);
  });
  it('answers valid CORS preflight', async () => {
    const res = await worker.fetch(request({ method: 'OPTIONS' }), env);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://gg.zat.am');
  });
  it('fails closed when configured without Cloudinary secrets', async () => {
    const res = await worker.fetch(request(), { ...env, CLOUDINARY_API_SECRET: '' });
    assert.equal(res.status, 503);
  });
  it('rejects tokens that do not belong to the GG Firebase project', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'INVALID_ID_TOKEN' }), { status: 400 });
    try {
      const res = await worker.fetch(request(), env);
      assert.equal(res.status, 401);
    } finally { globalThis.fetch = original; }
  });
  it('rejects non-JPEG images after authenticating a GG user', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ users: [{ localId: 'gg-uid' }] });
    try {
      const res = await worker.fetch(request({ body: Uint8Array.of(0x89, 0x50, 0x4e, 0x47) }), env);
      assert.equal(res.status, 415);
    } finally { globalThis.fetch = original; }
  });
  it('uses GG identity lookup and signed Cloudinary upload on success', async () => {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      if (String(url).startsWith('https://identitytoolkit.googleapis.com')) {
        assert.match(String(url), /key=gg-browser-key/);
        assert.equal(JSON.parse(options.body).idToken, 'valid.token.here');
        return Response.json({ users: [{ localId: 'gg-uid' }] });
      }
      if (String(url).startsWith('https://api.cloudinary.com')) {
        const form = options.body;
        const publicId = form.get('public_id');
        const timestamp = form.get('timestamp');
        const expectedSig = await sha1(`overwrite=false&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`);
        assert.equal(form.get('signature'), expectedSig);
        assert.match(publicId, /^gg-zatam\/profile-images\/gg-uid\//);
        return Response.json({
          public_id: publicId,
          version: 1780000000,
          secure_url: `https://res.cloudinary.com/testcloud/image/upload/v1780000000/${publicId}.jpg`,
          signature: await sha1(`public_id=${publicId}&version=1780000000${env.CLOUDINARY_API_SECRET}`),
        });
      }
      throw new Error('unexpected fetch');
    };
    try {
      const res = await worker.fetch(request(), env);
      assert.equal(res.status, 200);
      assert.match((await res.json()).url, /^https:\/\/res[.]cloudinary[.]com\/testcloud\//);
      assert.equal(calls.length, 2);
    } finally { globalThis.fetch = original; }
  });
});
