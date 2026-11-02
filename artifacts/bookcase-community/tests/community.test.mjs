import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PHOTO_BYTES, blueprintHash, createPayload, mergePhotoSelection, photoCountLabel,
  readReferenceId, referenceHref, safePhotos, updatePayload, validateShare, withoutParam,
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

test('blueprint hash keeps size, dirs, color, wall and floor', () => {
  const hash = blueprintHash({ size: 'standard', color: '#E2B062', shelfDirections: ['F', 'L'], wallColor: '#CFE0EE', floorId: 'custom', floorKind: 'Carpet', customFloorColor: '#112233' },
    (m) => `${m.size}-${m.color}-${m.dirs.join('')}`);
  assert.equal(hash, 'standard-#E2B062-FL~CFE0EE~custom~Carpet~112233');
});

test('reference handoff helpers and safe photo fallback', () => {
  assert.equal(referenceHref('/app', 12), '/app/?ref=12');
  assert.equal(readReferenceId('?ref=12'), 12);
  assert.equal(readReferenceId('?ref=abc'), null);
  assert.equal(withoutParam('?ref=3&x=1', 'ref'), '?x=1');
  assert.deepEqual(safePhotos({ photoPaths: null }), []);
  assert.equal(safePhotos({ photoPaths: ['a', 'b', 'c', 'd', 'e', 'f'] }).length, 6);
});
