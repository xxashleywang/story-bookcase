import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceBuildProgress,
  buildSteps,
  normalizeBuildProgress,
  rewindBuildProgress,
} from '../src/lib/build-steps.ts';

test('starts at 1 / (shelves + 1), so progress is never zero', () => {
  const tall = buildSteps(Array(11).fill(false));
  assert.equal(tall.doneSteps, 1);
  assert.equal(tall.totalSteps, 12);
  assert.equal(tall.percent, 8);

  const standard = buildSteps(Array(9).fill(false));
  assert.equal(standard.doneSteps, 1);
  assert.equal(standard.totalSteps, 10);
  assert.equal(standard.percent, 10);
});

test('normalization keeps only the leading contiguous run of completed shelves', () => {
  assert.deepEqual(normalizeBuildProgress([true, false, true, true]), [true, false, false, false]);
  assert.deepEqual(normalizeBuildProgress([false, true, true]), [false, false, false]);
  assert.deepEqual(normalizeBuildProgress([true, true, true]), [true, true, true]);
});

test('advance marks only the next shelf and never skips ahead', () => {
  assert.deepEqual(advanceBuildProgress([false, false, false]), [true, false, false]);
  assert.deepEqual(advanceBuildProgress([true, false, true]), [true, true, false]);
  assert.deepEqual(advanceBuildProgress([true, true]), [true, true]);
});

test('rewind un-does only the most recently completed shelf', () => {
  assert.deepEqual(rewindBuildProgress([true, true, false]), [true, false, false]);
  assert.deepEqual(rewindBuildProgress([true, false, true]), [false, false, false]);
  assert.deepEqual(rewindBuildProgress([false, false]), [false, false]);
});

test('complete build reaches 100% with no next shelf', () => {
  const state = buildSteps([true, true, true]);
  assert.equal(state.isComplete, true);
  assert.equal(state.nextShelfIndex, -1);
  assert.equal(state.doneSteps, 4);
  assert.equal(state.totalSteps, 4);
  assert.equal(state.percent, 100);
});
