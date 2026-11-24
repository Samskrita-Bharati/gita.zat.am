import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authErrorMessage } from '../auth/js/auth-error-messages.js';

function simulatePage(page, deps = {}) {
  const source = readFileSync(new URL(`../auth/js/${page}.js`, import.meta.url), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];/g, '')
    .replace(/import\.meta\.url/g, '"https://gg.zat.am/auth/js/signup.js"');
  const callbacks = new Map();
  const elements = new Map();
  const timers = [];
  let location = null;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', textContent: '', disabled: false, style: {},
      setAttribute() {},
      addEventListener(event, callback) { callbacks.set(`${id}:${event}`, callback); },
      querySelector() { return element(`${id}-submit`); },
    });
    return elements.get(id);
  }
  const document = { getElementById: element, querySelector: () => ({ href: 'https://gg.zat.am/auth/login.html' }) };
  const window = { location: { assign(value) { location = value; } } };
  const setTimeout = (fn) => { timers.push(fn); };
  const env = {
    ...deps,
    authErrorMessage,
    preserveRedirectOnLink: () => {},
    getSafeRedirect: () => null,
    getDestination: () => '/gg-home',
    getPreferencesUrl: () => '/gg-preferences',
    captureReferralFromUrl: () => null,
    claimReferralOnSignup: async () => null,
    confirmReferralOnLogin: async () => null,
  };
  const keys = Object.keys(env);
  new Function(...keys, 'document', 'window', 'setTimeout', source)(
    ...Object.values(env), document, window, setTimeout,
  );
  return {
    elements, callbacks, timers,
    get location() { return location; },
    element,
    async fire(id, event) {
      const callback = callbacks.get(`${id}:${event}`);
      assert.ok(callback, `Missing listener for ${id}:${event}`);
      await callback({ preventDefault() {} });
    },
    finishTimers() { for (const fn of timers) fn(); },
  };
}

describe('Google sign-in page flow', () => {
  it('routes new Google users to preferences', async () => {
    const page = simulatePage('login', {
      signInWithGoogle: async () => ({ user: { uid: 'u1', emailVerified: true } }),
      ensureUserDocument: async () => true,
      getCurrentUserProfile: async () => ({ preferencesSet: false }),
    });
    await page.fire('google-signin', 'click');
    page.finishTimers();
    assert.equal(page.location, '/gg-preferences');
    assert.match(page.element('message').textContent, /successful/i);
  });
  it('routes returning Google users with saved preferences to homepage', async () => {
    const page = simulatePage('login', {
      signInWithGoogle: async () => ({ user: { uid: 'u1', emailVerified: true } }),
      ensureUserDocument: async () => false,
      getCurrentUserProfile: async () => ({ preferencesSet: true }),
    });
    await page.fire('google-signin', 'click');
    page.finishTimers();
    assert.equal(page.location, '/gg-home');
  });
  it('shows a friendly message if Firestore refuses Google profile setup', async () => {
    const page = simulatePage('login', {
      signInWithGoogle: async () => ({ user: { uid: 'u1' } }),
      ensureUserDocument: async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); },
    });
    await page.fire('google-signin', 'click');
    assert.match(page.element('message').textContent, /profile/i);
    assert.doesNotMatch(page.element('message').textContent, /insufficient permissions|Firebase: Error/i);
    assert.equal(page.location, null);
  });
});

describe('Email signup page flow', () => {
  const signupFields = (page) => {
    page.element('signup-email').value = 'already@example.com';
    page.element('signup-password').value = 'example-password';
    page.element('signup-cpassword').value = 'example-password';
    page.element('signup-name').value = 'Test';
  };
  it('rejects overly long names before creating a Firebase account', async () => {
    let called = false;
    const page = simulatePage('signup', { signUp: async () => { called = true; } });
    signupFields(page);
    page.element('signup-name').value = 'N'.repeat(121);
    await page.fire('signup-form', 'submit');
    assert.equal(called, false);
    assert.match(page.element('message').textContent, /120 characters/i);
  });
  it('shows understandable text for email-already-in-use', async () => {
    const page = simulatePage('signup', {
      signUp: async () => { throw Object.assign(new Error('Firebase: Error (auth/email-already-in-use).'), { code: 'auth/email-already-in-use' }); },
    });
    signupFields(page);
    await page.fire('signup-form', 'submit');
    assert.match(page.element('message').textContent, /already has an account/i);
    assert.doesNotMatch(page.element('message').textContent, /firebase:|auth\//i);
  });
  it('does not claim a created Firebase Auth user failed to register if Firestore fails', async () => {
    const user = { uid: 'u1' };
    let emailSent = false, signedOut = false;
    const page = simulatePage('signup', {
      signUp: async () => ({ user }),
      updateUserProfile: async () => {},
      ensureUserDocument: async () => { throw Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }); },
      sendEmailVerification: async () => { emailSent = true; },
      signOut: async () => { signedOut = true; },
      auth: {},
    });
    signupFields(page);
    await page.fire('signup-form', 'submit');
    assert.equal(emailSent, true);
    assert.equal(signedOut, true);
    assert.match(page.element('message').textContent, /account was created/i);
    assert.match(page.element('message').textContent, /sign in to finish setup/i);
  });
  it('sends verification email and schedules redirect on successful signup', async () => {
    const user = { uid: 'u1' };
    const trace = [];
    const page = simulatePage('signup', {
      signUp: async () => ({ user }),
      updateUserProfile: async () => trace.push('displayName'),
      ensureUserDocument: async () => trace.push('profile'),
      sendEmailVerification: async () => trace.push('verification'),
      signOut: async () => trace.push('signout'),
      auth: {},
    });
    signupFields(page);
    await page.fire('signup-form', 'submit');
    assert.deepEqual(trace, ['displayName', 'profile', 'verification', 'signout']);
    assert.equal(page.timers.length, 1);
    page.finishTimers();
    assert.match(page.location, /login\.html/);
  });
});
