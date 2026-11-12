import assert from 'node:assert/strict';
import test from 'node:test';
import { placeShelfHint } from '../src/lib/shelf-hint-placement.ts';

const BASE = {
  stageWidth: 980,
  stageHeight: 640,
  postX: 490,
  shelfYs: [110, 160, 205, 250, 295, 340, 385, 430, 475, 520, 565],
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

test('prefers right side when it can fit without collisions', () => {
  const placement = placeShelfHint({ ...BASE, selected: 6, targetTop: 410 });
  assert.equal(placement.side, 'right');
  assert.ok(placement.left > BASE.postX);
});

test('moves to left side when right side would be clipped', () => {
  const placement = placeShelfHint({
    ...BASE,
    stageWidth: 760,
    postX: 420,
    selected: 3,
    targetTop: 280,
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
    targetTop: 280,
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
    targetTop: 492,
  });
  const rect = rectForPlacement(placement, BASE);
  assert.ok(rect.left >= 14);
  assert.ok(rect.right <= 740 - 14);
  assert.ok(rect.top >= 14);
  assert.ok(rect.bottom <= 500 - 14);
});

test('avoids overlapping any shelf plank when a valid slot exists', () => {
  const placement = placeShelfHint({ ...BASE, selected: 4, targetTop: 322 });
  const hintRect = rectForPlacement(placement, BASE);
  for (let i = 0; i < BASE.shelfYs.length; i++) {
    const rect = shelfRect(BASE.postX, BASE.shelfYs[i], BASE.shelfDirs[i]);
    assert.equal(intersects(hintRect, rect), false);
  }
});
