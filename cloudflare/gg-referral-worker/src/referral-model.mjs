/** Pure validation/data helpers shared by Worker and Node regression tests. */
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
export const MAX_REGISTRATION_AGE_MS = 30 * 60 * 1000;
export const MAX_PLAYER_NAME_LENGTH = 60;

export function isReferralCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}

export function cleanPlayerName(value) {
  const name = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (name || 'GG Player').slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function newAccountIsEligible(account, now = Date.now()) {
  const createdAt = Number(account?.createdAt);
  return Boolean(account?.localId && !account.disabled && Number.isFinite(createdAt) &&
    createdAt > 0 && createdAt <= now + 60_000 &&
    now - createdAt <= MAX_REGISTRATION_AGE_MS);
}

export function canConfirmClaim(account, claim) {
  return Boolean(account?.localId && account.emailVerified === true &&
    !account.disabled && claim?.referredUid === account.localId &&
    claim?.status === 'pending' && claim.referrerUid &&
    claim.referrerUid !== account.localId);
}

export function toValue(value) {
  if (typeof value === 'number') return { integerValue: String(Math.trunc(value)) };
  if (typeof value === 'boolean') return { booleanValue: value };
  return { stringValue: String(value) };
}

export function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toValue(value)]));
}

export function unmarshal(doc) {
  if (!doc?.fields) return null;
  return Object.fromEntries(Object.entries(doc.fields).map(([key, value]) => [
    key, value.integerValue !== undefined ? Number(value.integerValue) :
      value.booleanValue !== undefined ? value.booleanValue :
      value.stringValue !== undefined ? value.stringValue :
      value.timestampValue !== undefined ? value.timestampValue : null,
  ]));
}

export function codeFromBytes(bytes) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...bytes].map((n) => alphabet[n % alphabet.length]).join('');
}

export function leaderboardRows(documents) {
  return documents.filter((item) => item?.document).map((item) => {
    const record = unmarshal(item.document);
    return {
      uid: item.document.name.split('/').at(-1),
      displayName: cleanPlayerName(record?.displayName),
      referralCount: Math.max(0, Number(record?.referralCount) || 0),
    };
  });
}
