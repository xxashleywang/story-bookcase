import assert from 'node:assert/strict';
import test from 'node:test';
import { placeShelfHint, shelfHintPairIndex } from '../src/lib/shelf-hint-placement.ts';

const BASE = {
  stageWidth: 980,
  stageHeight: 640,
  postX: 490,
  // 0-based from the bottom, matching the configurator (shelf 1 is lowest / largest Y).
  shelfYs: [565, 520, 475, 430, 385, 340, 295, 250, 205, 160, 110],
  shelfDirs: ['R', 'F', 'L', 'B', 'R', 'F', 'L', 'B', 'R', 'F', 'L'],
  hintWidth: 280,
  hintHeight: 108,
  preferRight: true,
};

const rectForPlacement = ({ left, top }, { hintWidth, hintHeight }) => ({
  left,
  right: left + hintWidth,
  top: top - hintHeight / 2,
  bottom: top + hintHeight / 2,
});

const intersects = (a, b) => !(
  a.right <= b.left
  || a.left >= b.right
  || a.bottom <= b.top
  || a.top >= b.bottom
);

const shelfRect = (postX, y, dir) => {
  if (dir === 'L') return { left: postX - 136, right: postX - 8, top: y - 12, bottom: y + 12 };
  if (dir === 'R') return { left: postX + 8, right: postX + 136, top: y - 12, bottom: y + 12 };
  return { left: postX - 92, right: postX + 92, top: y - 12, bottom: y + 12 };
};

test('pairs shelves into shared slots: 1&2, 3&4, 5&6, leftover odd shelf alone', () => {
  assert.equal(shelfHintPairIndex(0), 0);
  assert.equal(shelfHintPairIndex(1), 0);
  assert.equal(shelfHintPairIndex(2), 1);
  assert.equal(shelfHintPairIndex(3), 1);
  assert.equal(shelfHintPairIndex(10), 5);
});

test('shelves in the same pair share the same placement', () => {
  for (const start of [0, 2, 4, 6, 8]) {
    const first = placeShelfHint({ ...BASE, selected: start, allowSideSwitch: false });
    const second = placeShelfHint({ ...BASE, selected: start + 1, allowSideSwitch: false });
    assert.equal(first.pairIndex, second.pairIndex);
    assert.equal(first.top, second.top);
    assert.equal(first.left, second.left);
    assert.equal(first.side, 'right');
  }
});

test('adjacent pairs use different vertical slots', () => {
  const pair12 = placeShelfHint({ ...BASE, selected: 0, allowSideSwitch: false });
  const pair34 = placeShelfHint({ ...BASE, selected: 2, allowSideSwitch: false });
  const pair56 = placeShelfHint({ ...BASE, selected: 4, allowSideSwitch: false });
  assert.notEqual(pair12.top, pair34.top);
  assert.notEqual(pair34.top, pair56.top);
  assert.ok(pair12.top > pair34.top);
  assert.ok(pair34.top > pair56.top);
});

test('prefers right side when it can fit without collisions', () => {
  const placement = placeShelfHint({ ...BASE, selected: 6 });
  assert.equal(placement.side, 'right');
  assert.ok(placement.left > BASE.postX);
});

test('moves to left side when right side would be clipped', () => {
  const placement = placeShelfHint({
    ...BASE,
    stageWidth: 760,
    postX: 420,
    selected: 3,
  });
  assert.equal(placement.side, 'left');
  assert.ok(placement.left + BASE.hintWidth <= 760 - 14);
});

test('stays on right side when side switching is disabled', () => {
  const placement = placeShelfHint({
    ...BASE,
    stageWidth: 760,
    postX: 420,
    selected: 3,
    allowSideSwitch: false,
  });
  assert.equal(placement.side, 'right');
});

test('keeps panel within stage bounds', () => {
  const placement = placeShelfHint({
    ...BASE,
    stageWidth: 740,
    stageHeight: 500,
    postX: 370,
    selected: 0,
    allowSideSwitch: false,
  });
  const rect = rectForPlacement(placement, BASE);
  assert.ok(rect.left >= 14);
  assert.ok(rect.right <= 740 - 14);
  assert.ok(rect.top >= 14);
  assert.ok(rect.bottom <= 500 - 14);
});

test('avoids overlapping any shelf plank when a valid slot exists', () => {
  const placement = placeShelfHint({ ...BASE, selected: 4, allowSideSwitch: false });
  const hintRect = rectForPlacement(placement, BASE);
  for (let i = 0; i < BASE.shelfYs.length; i++) {
    const rect = shelfRect(BASE.postX, BASE.shelfYs[i], BASE.shelfDirs[i]);
    assert.equal(intersects(hintRect, rect), false);
  }
});
