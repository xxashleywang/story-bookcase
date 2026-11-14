import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDesign } from '../src/lib/design-url.ts';
import {
  isPlannerPath,
  plannerAddress,
  plannerPathForTab,
  plannerTabFromPath,
} from '../src/lib/planner-tab.ts';

const changed = 't-e4e8e7-FFRRBBLLFFR~F6F4F0~pale~Laminate~B9A48A';
const code = encodeDesign(changed);

test('build it is /build-it and every other path is style it', () => {
  assert.equal(plannerTabFromPath('/'), 'style');
  assert.equal(plannerTabFromPath(''), 'style');
  assert.equal(plannerTabFromPath('/build-it'), 'build');
  assert.equal(plannerTabFromPath('/build-it/'), 'build');
  assert.equal(plannerTabFromPath('/build-it?ref=1#design'), 'build');
  assert.equal(plannerTabFromPath(`/build-it/d/${code}`), 'build');
  assert.equal(plannerTabFromPath(`/d/${code}`), 'style');
  assert.equal(plannerTabFromPath('/gallery'), 'style');
  assert.equal(plannerTabFromPath('/inspiration'), 'style');
  assert.equal(plannerTabFromPath('/build/4'), 'style');
  assert.equal(plannerTabFromPath('/my-profile'), 'style');
  assert.equal(plannerTabFromPath('/profile'), 'style');
});

test('each tab maps back to one planner path', () => {
  assert.equal(plannerPathForTab('style'), '/');
  assert.equal(plannerPathForTab('build'), '/build-it');
});

test('only the planner paths mount the planner', () => {
  assert.equal(isPlannerPath('/'), true);
  assert.equal(isPlannerPath(''), true);
  assert.equal(isPlannerPath('/build-it'), true);
  assert.equal(isPlannerPath('/build-it/'), true);
  assert.equal(isPlannerPath(`/d/${code}`), true);
  assert.equal(isPlannerPath(`/build-it/d/${code}`), true);
  assert.equal(isPlannerPath('/from/12'), true);
  assert.equal(isPlannerPath(`/d/${code}/from/12`), true);
  assert.equal(isPlannerPath('/gallery'), false);
  assert.equal(isPlannerPath('/gallery/share'), false);
  assert.equal(isPlannerPath('/my-profile'), false);
  assert.equal(isPlannerPath('/my-profile/favourites'), false);
  assert.equal(isPlannerPath('/inspiration'), false);
  assert.equal(isPlannerPath('/build/4'), false);
  assert.equal(isPlannerPath('/profile'), false);
  assert.equal(isPlannerPath('/sign-in'), false);
});

test('switching tabs keeps the design and reference on a short path', () => {
  assert.equal(plannerAddress('', 'build', '/', '', ''), '/build-it');
  assert.equal(plannerAddress('', 'style', '/build-it', '', ''), '/');
  assert.equal(plannerAddress('', 'style', '/', '', `#${changed}`), `/d/${code}`);
  assert.equal(plannerAddress('', 'build', '/', '', `#${changed}`), `/build-it/d/${code}`);
  assert.equal(plannerAddress('', 'build', `/d/${code}`, '', ''), `/build-it/d/${code}`);
  assert.equal(plannerAddress('', 'style', `/build-it/d/${code}`, '', ''), `/d/${code}`);
  assert.equal(plannerAddress('', 'build', '/', '?ref=12', ''), '/build-it/from/12');
  assert.equal(plannerAddress('', 'style', '/build-it/from/12', '', ''), '/from/12');
  assert.equal(plannerAddress('/preview', 'build', '/preview/build-it', '', ''), '/preview/build-it');
  assert.equal(plannerAddress('/preview', 'style', '/preview/build-it', '', ''), '/preview/');
  assert.equal(plannerAddress('/preview', 'build', `/preview/d/${code}`, '?keep=1', ''), `/preview/build-it/d/${code}?keep=1`);
});
