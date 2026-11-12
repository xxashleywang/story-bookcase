import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPlannerPath,
  plannerAddress,
  plannerPathForTab,
  plannerTabFromPath,
} from '../src/lib/planner-tab.ts';

test('build it is /build-it and every other path is style it', () => {
  assert.equal(plannerTabFromPath('/'), 'style');
  assert.equal(plannerTabFromPath(''), 'style');
  assert.equal(plannerTabFromPath('/build-it'), 'build');
  assert.equal(plannerTabFromPath('/build-it/'), 'build');
  assert.equal(plannerTabFromPath('/build-it?ref=1#design'), 'build');
  assert.equal(plannerTabFromPath('/inspiration'), 'style');
  assert.equal(plannerTabFromPath('/build/4'), 'style');
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
  assert.equal(isPlannerPath('/inspiration'), false);
  assert.equal(isPlannerPath('/build/4'), false);
  assert.equal(isPlannerPath('/profile'), false);
  assert.equal(isPlannerPath('/sign-in'), false);
});

test('switching tabs keeps the query string and design hash', () => {
  const search = '?ref=12&share=photo';
  const hash = '#tall~E2B062~FFFFFFFFFFF~F6F4F0~pale~Laminate~B9A48A';
  assert.equal(plannerAddress('', 'build', search, hash), `/build-it${search}${hash}`);
  assert.equal(plannerAddress('', 'style', search, hash), `/${search}${hash}`);
  assert.equal(plannerAddress('', 'build', '', ''), '/build-it');
  assert.equal(plannerAddress('/preview', 'build', search, hash), `/preview/build-it${search}${hash}`);
  assert.equal(plannerAddress('/preview/', 'style', '', hash), `/preview/${hash}`);
});
