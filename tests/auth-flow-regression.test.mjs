import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authErrorMessage } from '../auth/js/auth-error-messages.js';

// Load the real auth-api module body, substituting local mocked SDK calls.
// This tests ensureUserDocument without accessing production Firebase.
const original = readFileSync(new URL('../auth/api/auth-api.js', import.meta.url), 'utf8');
const transformed = original
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/firebase-config\.js["'];\s*/m, '')
  .replace(/export const /g, 'const ');
const buildModule = new Function('api', `
  const {
    auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
    GoogleAuthProvider, signInWithPopup, updatePassword, EmailAuthProvider,
    reauthenticateWithCredential, doc, getDoc, setDoc, serverTimestamp
  } = api;
  ${transformed}
  return { ensureUserDocument, getCurrentUserProfile };
`);

const accountPath = 'users/uid123/private/account';
const profilePath = 'users/uid123/public/profile';

function mockFirebase(existing = {}) {
  const database = new Map(Object.entries(existing));
  const writes = [];
  const sentinel = { type: 'serverTimestamp' };
  const user = { uid: 'uid123', email: 'test@example.com', displayName: 'Test Person' };
  const api = {
    auth: { currentUser: user },
    db: {},
    GoogleAuthProvider: class {},
    doc: (_db, ...parts) => parts.join('/'),
    getDoc: async (path) => ({
      exists: () => database.has(path),
      data: () => database.get(path),
    }),
    setDoc: async (path, payload) => {
      writes.push({ path, payload });
      database.set(path, payload);
    },
    serverTimestamp: () => sentinel,
  };
  return { user, database, writes, sentinel, ...buildModule(api) };
}

describe('GG signup and Google profile provisioning', () => {
  it('creates both documents with the streak required by Firestore rules', async () => {
    const mock = mockFirebase();
    const isNew = await mock.ensureUserDocument(mock.user);
    assert.equal(isNew, true);
    assert.equal(mock.writes.length, 2);
    const account = mock.database.get(accountPath);
    const profile = mock.database.get(profilePath);
    assert.equal(account.isAdmin, false);
    assert.equal(account.createdAt, mock.sentinel);
    assert.equal(profile.createdAt, mock.sentinel);
    assert.equal(profile.streak, 1);
    assert.equal(profile.preferencesSet, false);
    assert.equal(profile.name, 'Test Person');
  });
  it('recovers a private-account-only signup without overwriting admin', async () => {
    const mock = mockFirebase({
      [accountPath]: { email: 'test@example.com', isAdmin: true, createdAt: 'original' },
    });
    assert.equal(await mock.ensureUserDocument(mock.user), true);
    assert.deepEqual(mock.writes.map((x) => x.path), [profilePath]);
    assert.equal(mock.database.get(accountPath).isAdmin, true);
    assert.equal(mock.database.get(profilePath).streak, 1);
  });
  it('truncates oversized Google display names to profile-rule limits', async () => {
    const mock = mockFirebase();
    await mock.ensureUserDocument({ ...mock.user, displayName: 'X'.repeat(140) });
    assert.equal(mock.database.get(profilePath).name.length, 120);
  });
  it('does not rewrite either existing user document', async () => {
    const mock = mockFirebase({
      [accountPath]: { email: 'test@example.com', isAdmin: true },
      [profilePath]: { preferencesSet: true, streak: 0, language: '1' },
    });
    assert.equal(await mock.ensureUserDocument(mock.user), false);
    assert.equal(mock.writes.length, 0);
    assert.equal((await mock.getCurrentUserProfile()).preferencesSet, true);
  });
  it('repairs an existing account if its public profile was deleted', async () => {
    const mock = mockFirebase({ [accountPath]: { isAdmin: false } });
    await mock.ensureUserDocument(mock.user, { name: 'Fallback Name' });
    assert.equal((await mock.getCurrentUserProfile()).preferencesSet, false);
  });
});

describe('Safe authentication error messages', () => {
  it('explains an already registered email without raw Firebase error', () => {
    const actual = authErrorMessage({ code: 'auth/email-already-in-use' }, 'signup');
    assert.match(actual, /already has an account/i);
    assert.doesNotMatch(actual, /firebase:|auth\//i);
  });
  it('explains Firestore profile provisioning failure', () => {
    assert.match(authErrorMessage({ code: 'permission-denied' }, 'google'), /profile/i);
  });
  it('explains Google credential collision and cancelled popups', () => {
    assert.match(authErrorMessage({ code: 'auth/account-exists-with-different-credential' }, 'google'), /another sign-in method/i);
    assert.match(authErrorMessage({ code: 'auth/popup-closed-by-user' }, 'google'), /cancelled/i);
  });
  it('does not expose arbitrary backend messages or credentials', () => {
    const actual = authErrorMessage({ code: 'something-unexpected', message: 'secret-token-123' }, 'signup');
    assert.doesNotMatch(actual, /secret-token|something-unexpected/);
  });
});
