import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupMessage, isAccountAffectedKey, photoRemovalPlan, privateListKey, readSaveIntent, saveIntentHref } from '../src/lib/account.ts';

test('affected keys cover public, private, detail and summary caches', () => {
  assert.ok(isAccountAffectedKey(['/api/builds']));
  assert.ok(isAccountAffectedKey(['/api/builds/12']));
  assert.ok(isAccountAffectedKey(['/api/profiles/me/favourites', { cursor: 3 }]));
  assert.ok(isAccountAffectedKey(['/api/community/summary']));
  assert.ok(!isAccountAffectedKey(['/api/healthz']));
  assert.ok(!isAccountAffectedKey([42]));
});

test('private list keys are identity scoped', () => {
  assert.notDeepEqual(privateListKey(['/api/profiles/me/builds'], 'user_a'), privateListKey(['/api/profiles/me/builds'], 'user_b'));
  assert.deepEqual(privateListKey(['/x'], null).at(-1), { identity: 'signed-out' });
});

test('save intent survives the sign-in round trip', () => {
  const href = saveIntentHref('/app', 'https://t.test', '/app/inspiration', '?q=oak', '', 7);
  const back = decodeURIComponent(href.split('redirect_url=')[1]);
  assert.equal(back, 'https://t.test/app/inspiration?q=oak&save=7');
  assert.equal(readSaveIntent('?q=oak&save=7'), 7);
  assert.equal(readSaveIntent('?save=abc'), null);
  assert.equal(readSaveIntent('?save=0'), null);
});

test('removing every photo is flagged as a whole-post decision', () => {
  assert.deepEqual(photoRemovalPlan(['/a', '/b'], ['/a']), { remaining: ['/b'], removesLast: false });
  assert.equal(photoRemovalPlan(['/a'], ['/a']).removesLast, true);
  assert.equal(photoRemovalPlan(['/a', '/b', '/c', '/d', '/e', '/f'], ['/f']).remaining.length, 5);
});

test('cleanup message is quiet when nothing is pending', () => {
  assert.equal(cleanupMessage(0), '');
  assert.match(cleanupMessage(1), /1 deleted photo is/);
  assert.match(cleanupMessage(3), /3 deleted photos are/);
});
