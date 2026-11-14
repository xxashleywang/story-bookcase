import assert from 'node:assert/strict';
import test from 'node:test';
import { galleryPhase, withGalleryDeadline } from '../src/lib/gallery-state.ts';

test('an empty gallery is not a load failure', () => {
  assert.equal(galleryPhase({ pending: false, failed: false, count: 0 }), 'empty');
  assert.equal(galleryPhase({ pending: true, failed: false, count: 0 }), 'loading');
  assert.equal(galleryPhase({ pending: false, failed: true, count: 0 }), 'error');
  assert.equal(galleryPhase({ pending: false, failed: false, count: 3 }), 'posts');
});

test('a fast empty list resolves before the deadline', async () => {
  const parent = new AbortController();
  const result = await withGalleryDeadline(parent.signal, async () => [], 200);
  assert.deepEqual(result, []);
});

test('a hung gallery read stops instead of waiting', async () => {
  const parent = new AbortController();
  const started = Date.now();
  await assert.rejects(
    withGalleryDeadline(parent.signal, (signal) => new Promise((resolve, reject) => {
      const hang = setTimeout(resolve, 5_000);
      signal.addEventListener('abort', () => {
        clearTimeout(hang);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }), 40),
    (error) => error instanceof Error && error.name === 'AbortError',
  );
  assert.ok(Date.now() - started < 1_000);
});
