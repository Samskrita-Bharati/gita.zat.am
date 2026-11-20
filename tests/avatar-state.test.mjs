import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAvatarState, cloudinaryPhotoURL, safePhotoURL } from '../auth/js/avatar-state.js';

const google = {
  photoURL: 'https://lh3.googleusercontent.com/example',
  providerData: [{ providerId: 'google.com', photoURL: 'https://lh3.googleusercontent.com/example' }],
};
const custom = 'https://res.cloudinary.com/example/image/upload/v1/avatar.jpg';

describe('GG profile picture state', () => {
  it('uses Google photo for a new Google account', () => {
    const state = resolveAvatarState(google, {});
    assert.equal(state.source, 'google');
    assert.equal(state.photoURL, google.photoURL);
  });
  it('respects explicit default without showing a Google photo', () => {
    const state = resolveAvatarState(google, { avatarSource: 'default', photoURL: '' });
    assert.equal(state.source, 'default');
    assert.equal(state.photoURL, '');
    assert.equal(state.googlePhotoURL, google.photoURL);
  });
  it('preserves Google photo as a restoration choice when custom uploaded', () => {
    const state = resolveAvatarState(google, {
      avatarSource: 'custom', photoURL: custom, customPhotoURL: custom,
    });
    assert.equal(state.photoURL, custom);
    assert.equal(state.googlePhotoURL, google.photoURL);
  });
  it('restores a saved Google photo after a custom upload', () => {
    const state = resolveAvatarState(google, {
      avatarSource: 'google', photoURL: google.photoURL,
      customPhotoURL: custom, googlePhotoURL: google.photoURL,
    });
    assert.equal(state.photoURL, google.photoURL);
    assert.equal(state.customPhotoURL, custom);
  });
  it('supports non-Google users', () => {
    const state = resolveAvatarState({ photoURL: custom, providerData: [] }, {});
    assert.equal(state.source, 'custom');
    assert.equal(state.googlePhotoURL, '');
  });
  it('rejects unsafe or unrelated upload URLs', () => {
    assert.equal(safePhotoURL('javascript:alert(1)'), '');
    assert.equal(safePhotoURL('http://example.com'), '');
    assert.equal(cloudinaryPhotoURL('https://evil.example/a'), '');
  });
});
