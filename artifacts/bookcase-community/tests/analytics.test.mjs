import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { completeInspirationHandoff, inspirationHref, trackEvent } from '../src/lib/analytics.ts';

function browser(href = 'https://example.com/app/') {
  const events = [];
  globalThis.window = {
    location: new URL(href),
    history: {
      state: { keep: true },
      replaceState(state, _, path) {
        assert.deepEqual(state, { keep: true });
        window.location = new URL(path, window.location.origin);
      },
    },
    umami: { track: (name, data) => events.push({ name, data }) },
  };
  return events;
}

test('optional tracker is safe without a browser or tracker, and on sync/async failures', async () => {
  delete globalThis.window;
  assert.doesNotThrow(() => trackEvent('room_published'));
  browser();
  delete window.umami;
  assert.doesNotThrow(() => trackEvent('room_published'));
  window.umami = { track: () => { throw new Error('blocked'); } };
  assert.doesNotThrow(() => trackEvent('room_published'));
  window.umami = { track: () => Promise.reject(new Error('offline')) };
  trackEvent('room_published');
  await new Promise((resolve) => setImmediate(resolve));
  delete globalThis.window;
});

test('handoff URL preserves base path, reference and blueprint without tracking a click', () => {
  const events = browser();
  assert.equal(inspirationHref('/app/?ref=12#scene', 'reference_detail'), '/app/?ref=12&inspiration=reference_detail#scene');
  assert.equal(inspirationHref('/app/#blueprint', 'blueprint_drawer'), '/app/?inspiration=blueprint_drawer#blueprint');
  assert.deepEqual(events, []);
});

test('successful destination outcomes use only bounded source and type, once', () => {
  for (const kind of ['blueprint', 'reference']) {
    for (const source of ['detail', 'drawer']) {
      const events = browser(`https://example.com/app/?ref=12&inspiration=${kind}_${source}#scene`);
      completeInspirationHandoff(kind);
      completeInspirationHandoff(kind);
      assert.deepEqual(events, [{
        name: kind === 'blueprint' ? 'blueprint_used' : 'inspiration_reference_opened',
        data: {
          source: source === 'detail' ? 'room_detail' : 'inspiration_drawer',
          type: kind === 'blueprint' ? 'blueprint_backed' : 'photo_only',
        },
      }]);
      assert.equal(window.location.href, 'https://example.com/app/?ref=12#scene');
    }
  }
});

test('direct visits, arbitrary labels and mismatched outcomes do not count', () => {
  for (const marker of ['', 'private-free-form-content', 'reference_detail']) {
    const events = browser(`https://example.com/app/?inspiration=${marker}`);
    completeInspirationHandoff('blueprint');
    assert.deepEqual(events, []);
  }
});

test('outcomes are wired after publishing, rendering, image loading and dismissal', () => {
  const share = readFileSync(new URL('../src/components/share-dialog.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(share, /await create\.mutateAsync\(\{ data \}\);\s+trackEvent\('room_published', \{ source, type: build\.configuration \? 'blueprint_backed' : 'photo_only' \}\)/);
  assert.match(app, /viewRef\.current\?\.update[\s\S]*?useEffect\(\(\) => onSceneChange\(scene\)/);
  assert.match(app, /onLoad=\{\(\) => \{\s+if \(!isError && build\?\.id === id\) completeInspirationHandoff\('reference'\)/);
  assert.match(app, /setReference\(null\);\s+trackEvent\('inspiration_reference_dismissed', \{ source:'playroom', type:'reference' \}\)/);
  assert.match(app, /PublishDialog source="gallery"/);
  assert.match(app, /PublishDialog source="playroom"/);
});
