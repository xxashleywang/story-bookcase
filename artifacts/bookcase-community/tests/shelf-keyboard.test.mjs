import assert from 'node:assert/strict';
import test from 'node:test';
import { moveShelfSelection, rotateShelfDirection, shelfActionFromKey } from '../src/lib/shelf-keyboard.ts';

const active = { selected:3, count:11, designing:true, rolling:false };
const key = (name, overrides = {}) => ({
  key:name, defaultPrevented:false, altKey:false, ctrlKey:false, metaKey:false, shiftKey:false,
  target:{ closest:() => null }, ...overrides,
});

test('left/right rotate, while up/down select the shelf above/below', () => {
  for (const [arrow, action] of Object.entries({
    ArrowUp:{ type:'select', step:1 }, ArrowDown:{ type:'select', step:-1 },
    ArrowLeft:{ type:'rotate', step:-1 }, ArrowRight:{ type:'rotate', step:1 },
  })) {
    assert.deepEqual(shelfActionFromKey(key(arrow), active), action);
  }
  assert.equal(shelfActionFromKey(key('Enter'), active), null);
});

test('rotation cycles through all four directions and left reverses right', () => {
  let direction = 'F';
  const cycle = [];
  for (let i = 0; i < 4; i++) { direction = rotateShelfDirection(direction, 1); cycle.push(direction); }
  assert.deepEqual(cycle, ['R', 'B', 'L', 'F']);
  for (const dir of ['F', 'R', 'B', 'L']) {
    assert.equal(rotateShelfDirection(rotateShelfDirection(dir, 1), -1), dir);
  }
  assert.equal(rotateShelfDirection('F', -1), 'L');
});

test('selection progresses bottom-to-top and clamps at either boundary for both sizes', () => {
  for (const count of [9, 11]) {
    assert.equal(moveShelfSelection(0, count, 1), 1);
    assert.equal(moveShelfSelection(3, count, -1), 2);
    assert.equal(moveShelfSelection(0, count, -1), 0);
    assert.equal(moveShelfSelection(count - 1, count, 1), count - 1);
  }
});

test('sequential keyboard editing changes only the selected shelf', () => {
  const dirs = ['F', 'B', 'L'];
  let selected = 0;
  dirs[selected] = rotateShelfDirection(dirs[selected], 1);
  selected = moveShelfSelection(selected, dirs.length, 1);
  dirs[selected] = rotateShelfDirection(dirs[selected], -1);
  selected = moveShelfSelection(selected, dirs.length, -1);
  assert.equal(selected, 0);
  assert.deepEqual(dirs, ['R', 'R', 'L']);
});

test('no shortcut without valid selection, in assembly mode, or while randomizing', () => {
  for (const state of [
    { selected:-1 }, { selected:11 }, { count:3 }, { designing:false }, { rolling:true },
  ]) {
    assert.equal(shelfActionFromKey(key('ArrowRight'), { ...active, ...state }), null);
  }
});

test('preserve modified shortcuts and already-handled events', () => {
  for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'defaultPrevented']) {
    assert.equal(shelfActionFromKey(key('ArrowLeft', { [flag]:true }), active), null);
  }
});

test('typing, menu navigation, sliders and dialogs retain their arrow key behavior', () => {
  let selector;
  const target = { closest:(value) => { selector = value; return {}; } };
  assert.equal(shelfActionFromKey(key('ArrowDown', { target }), active), null);
  for (const protectedControl of ['input', 'textarea', 'select', 'contenteditable', 'combobox', 'listbox', 'menu', 'slider', 'dialog']) {
    assert.ok(selector.includes(protectedControl));
  }
});
