import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PHOTO_BYTES, addressHash, blueprintHash, createPayload, mergePhotoSelection, photoCountLabel,
  readGalleryBlueprint, readReferenceId, referenceHref, safePhotos, shareGateDecision, updatePayload,
  validateShare, withoutParam,
} from '../src/lib/community.ts';

const file = (name, size = 1000, type = 'image/jpeg', lastModified = 1) => ({ name, size, type, lastModified });

test('selection is additive, capped at four, and reports overflow', () => {
  const first = mergePhotoSelection([], [file('a'), file('b')]);
  assert.equal(first.accepted.length, 2);
  const second = mergePhotoSelection(first.accepted, [file('c'), file('d'), file('e')]);
  assert.equal(second.accepted.length, 2);
  assert.match(second.errors[0], /Only 4 photos/);
});

test('size and type boundaries', () => {
  assert.equal(mergePhotoSelection([], [file('ok', MAX_PHOTO_BYTES)]).accepted.length, 1);
  assert.equal(mergePhotoSelection([], [file('big', MAX_PHOTO_BYTES + 1)]).accepted.length, 0);
  for (const type of ['image/png', 'image/webp', 'image/avif']) assert.equal(mergePhotoSelection([], [file('x', 10, type)]).accepted.length, 1);
  assert.equal(mergePhotoSelection([], [file('g', 10, 'image/gif')]).errors.length, 1);
});

test('duplicates are skipped but a removed file can be selected again', () => {
  const a = file('a');
  assert.equal(mergePhotoSelection([a], [file('a')]).accepted.length, 0);
  assert.equal(mergePhotoSelection([], [file('a')]).accepted.length, 1);
});

test('count label and share validation', () => {
  assert.equal(photoCountLabel(0), '0 of 4 photos');
  assert.ok(validateShare({ title: 'x', photoCount: 1 }));
  assert.ok(validateShare({ title: 'Nook', photoCount: 0 }));
  assert.ok(validateShare({ title: 'Nook', photoCount: 5 }));
  assert.equal(validateShare({ title: 'Nook', photoCount: 4 }), null);
});

test('photo-only create payload carries no invented configuration or tags', () => {
  const payload = createPayload({ title: ' Nook ', description: ' ', photoPaths: ['/objects/1'], blueprint: null });
  assert.deepEqual(payload, { title: 'Nook', description: null, photoPaths: ['/objects/1'], configuration: null });
  assert.equal('tags' in payload, false);
});

test('update only touches photos when replaced and removes blueprint explicitly', () => {
  const keep = updatePayload({ title: 'T1', description: '', removeBlueprint: false, hadBlueprint: true, replacementPhotoPaths: null });
  assert.equal('photoPaths' in keep, false);
  assert.equal('configuration' in keep, false);
  const change = updatePayload({ title: 'T1', description: 'd', removeBlueprint: true, hadBlueprint: true, replacementPhotoPaths: ['/a'] });
  assert.equal(change.configuration, null);
  assert.deepEqual(change.photoPaths, ['/a']);
});

test('factory default keeps a bare address, and any change adds the config hash', () => {
  const factory = 't-e2b062-FFRRBBLLFFR~F6F4F0~pale~Laminate~B9A48A';
  assert.equal(addressHash(factory, factory), '');
  assert.equal(addressHash(factory.toLowerCase(), factory), '');
  const changed = 't-e4e8e7-FFRRBBLLFFR~F6F4F0~pale~Laminate~B9A48A';
  assert.equal(addressHash(changed, factory), `#${changed}`);
});

test('blueprint hash keeps size, dirs, color, wall and floor', () => {
  const hash = blueprintHash({ size: 'standard', color: '#E2B062', shelfDirections: ['F', 'L'], wallColor: '#CFE0EE', floorId: 'custom', floorKind: 'Carpet', customFloorColor: '#112233' },
    (m) => `${m.size}-${m.color}-${m.dirs.join('')}`);
  assert.equal(hash, 'standard-#E2B062-FL~CFE0EE~custom~Carpet~112233');
});

test('share gate waits for auth and profile, then chooses sign-in, retry, username, or gallery', () => {
  const base = { authLoaded: true, signedIn: true, profile: 'ready', isUsernameSet: true };
  assert.equal(shareGateDecision({ ...base, authLoaded: false, signedIn: false, profile: 'error', isUsernameSet: false }), 'wait');
  assert.equal(shareGateDecision({ ...base, authLoaded: false }), 'wait');
  assert.equal(shareGateDecision({ ...base, signedIn: false, profile: 'error', isUsernameSet: false }), 'sign-in');
  assert.equal(shareGateDecision({ ...base, profile: 'loading', isUsernameSet: false }), 'wait');
  assert.equal(shareGateDecision({ ...base, profile: 'error', isUsernameSet: true }), 'retry');
  assert.equal(shareGateDecision({ ...base, isUsernameSet: false }), 'username');
  assert.equal(shareGateDecision(base), 'gallery');
});

test('readGalleryBlueprint keeps a stashed design and rejects a bad shape', () => {
  const good = {
    size: 'tall', color: '#E2B062', shelfDirections: ['F', 'L'],
    wallColor: '#F6F4F0', floorId: 'pale', floorKind: 'Laminate', customFloorColor: null,
  };
  assert.deepEqual(readGalleryBlueprint(JSON.stringify(good)), good);
  assert.deepEqual(readGalleryBlueprint(JSON.stringify({ ...good, floorKind: undefined, customFloorColor: undefined })), {
    size: 'tall', color: '#E2B062', shelfDirections: ['F', 'L'], wallColor: '#F6F4F0', floorId: 'pale',
  });
  assert.equal(readGalleryBlueprint(null), null);
  assert.equal(readGalleryBlueprint(''), null);
  assert.equal(readGalleryBlueprint('{'), null);
  assert.equal(readGalleryBlueprint('[]'), null);
  assert.equal(readGalleryBlueprint(JSON.stringify({ ...good, size: 'huge' })), null);
  assert.equal(readGalleryBlueprint(JSON.stringify({ ...good, shelfDirections: [] })), null);
  assert.equal(readGalleryBlueprint(JSON.stringify({ ...good, shelfDirections: ['Z'] })), null);
  assert.equal(readGalleryBlueprint(JSON.stringify({ ...good, floorKind: 'Tile' })), null);
  assert.equal(readGalleryBlueprint(JSON.stringify({ ...good, color: '' })), null);
  assert.equal(readGalleryBlueprint(JSON.stringify({ ...good, customFloorColor: 12 })), null);
});

test('reference handoff helpers and safe photo fallback', () => {
  assert.equal(referenceHref('/app', 12), '/app/from/12');
  assert.equal(readReferenceId('?ref=12'), 12);
  assert.equal(readReferenceId('?ref=abc'), null);
  assert.equal(withoutParam('?ref=3&x=1', 'ref'), '?x=1');
  assert.deepEqual(safePhotos({ photoPaths: null }), []);
  assert.equal(safePhotos({ photoPaths: ['a', 'b', 'c', 'd', 'e', 'f'] }).length, 6);
});
