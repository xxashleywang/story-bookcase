import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldCelebrateBuildCompletion } from '../src/lib/build-celebration.ts';

test('celebrates when progress first reaches full completion in Build tab', () => {
  assert.equal(shouldCelebrateBuildCompletion({
    previousDone: 10,
    currentDone: 11,
    totalShelves: 11,
    tab: 'build',
  }), true);
});

test('does not celebrate while still incomplete', () => {
  assert.equal(shouldCelebrateBuildCompletion({
    previousDone: 8,
    currentDone: 10,
    totalShelves: 11,
    tab: 'build',
  }), false);
});

test('does not celebrate if already complete before this update', () => {
  assert.equal(shouldCelebrateBuildCompletion({
    previousDone: 11,
    currentDone: 11,
    totalShelves: 11,
    tab: 'build',
  }), false);
});

test('does not celebrate outside the Build tab', () => {
  assert.equal(shouldCelebrateBuildCompletion({
    previousDone: 10,
    currentDone: 11,
    totalShelves: 11,
    tab: 'style',
  }), false);
});

test('can celebrate again after a shelf is unchecked and rechecked', () => {
  const droppedOutOfComplete = shouldCelebrateBuildCompletion({
    previousDone: 11,
    currentDone: 10,
    totalShelves: 11,
    tab: 'build',
  });
  const reachedCompleteAgain = shouldCelebrateBuildCompletion({
    previousDone: 10,
    currentDone: 11,
    totalShelves: 11,
    tab: 'build',
  });
  assert.equal(droppedOutOfComplete, false);
  assert.equal(reachedCompleteAgain, true);
});

test('guards against empty shelf sets', () => {
  assert.equal(shouldCelebrateBuildCompletion({
    previousDone: 0,
    currentDone: 0,
    totalShelves: 0,
    tab: 'build',
  }), false);
});
