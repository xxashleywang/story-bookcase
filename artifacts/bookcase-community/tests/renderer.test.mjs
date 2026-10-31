import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Minimal DOM harness: exercise the real renderer's event handlers and state
// without requiring a browser or introducing a second application runtime.
class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
    this.events = {};
    this.clientHeight = 600;
    this.clientWidth = 600;
  }
  appendChild(child) { this.children.push(child); child.parent = this; }
  setAttribute() {}
  setPointerCapture() {}
  set innerHTML(_) { this.children = []; }
  set className(value) { this.classes = new Set(value.split(' ')); }
  getBoundingClientRect() { return { left:0, top:50, right:100, bottom:70 }; }
  closest(selector) {
    return selector === '[data-i]' && this.dataset.i !== undefined
      ? this : this.parent?.closest(selector);
  }
  addEventListener(name, handler) { (this.events[name] ||= []).push(handler); }
  emit(name, extra = {}) {
    (this.events[name] || []).forEach((handler) => handler({
      target:this, pointerId:1, pointerType:'mouse', button:0,
      clientX:100, clientY:100, ...extra,
    }));
  }
}

function setup(options = {}) {
  const storage = new Map();
  let frames = [];
  const window = {};
  const context = vm.createContext({
    window, document:{ createElement:() => new Element(), head:new Element() },
    localStorage:{
      getItem:(key) => storage.get(key) || null,
      setItem:(key, value) => storage.set(key, value),
    },
    ResizeObserver:class { constructor(render) { this.render = render; } observe() { this.render(); } },
    requestAnimationFrame:(frame) => { frames.push(frame); return frames.length; },
    cancelAnimationFrame() {}, performance:{ now:() => 0 },
    console,
  });
  for (const file of ['story-core.js', 'story-v2.js']) {
    vm.runInContext(readFileSync(new URL(`../reference/${file}`, import.meta.url), 'utf8'), context);
  }
  const state = window.Story.createState('tall', '#E2B062', window.Story.PRESETS[1].make(11));
  const host = new Element();
  const selections = [];
  const view = window.Story3D.mount(host, { state, onSelect:(i) => selections.push(i), ...options });
  const all = (node = host) => [node, ...node.children.flatMap((child) => all(child))];
  const shelf = (i) => all().find((node) => Number(node.dataset.i) === i);
  const marked = (cls) => all().filter((node) => node.classList.contains(cls));
  const tap = (target, extra = {}) => {
    host.emit('pointerdown', { target, ...extra });
    host.emit('pointerup', { target, ...extra });
  };
  const advance = (time) => {
    const pending = frames;
    frames = [];
    pending.forEach((frame) => frame(time));
  };
  return { window, state, host, selections, view, all, shelf, marked, tap, advance };
}

test('interactive turntable pauses while aiming or editing; decorative turntables keep spinning', () => {
  const hover = setup({ turntable:true });
  hover.host.emit('pointerenter');
  hover.advance(16);
  assert.equal(hover.view.view.yaw, -32);
  const selected = setup({ turntable:true });
  selected.view.update(selected.state, { selected:2 });
  selected.advance(16);
  assert.equal(selected.view.view.yaw, -32);
  const decorative = setup({ turntable:true, onSelect:null });
  decorative.host.emit('pointerenter');
  decorative.advance(16);
  assert.notEqual(decorative.view.view.yaw, -32);
});

test('hover highlights every face of only the hovered shelf; leaving clears it', () => {
  const r = setup();
  r.host.emit('pointermove', { target:r.shelf(3) });
  assert.equal(r.marked('s3d-hover').length, 6);
  assert.ok(r.marked('s3d-hover').every((node) => Number(node.dataset.i) === 3));
  r.host.emit('pointerleave');
  assert.equal(r.marked('s3d-hover').length, 0);
});

test('touch does not create sticky hover feedback', () => {
  const r = setup();
  r.host.emit('pointermove', { target:r.shelf(3), pointerType:'touch' });
  assert.equal(r.marked('s3d-hover').length, 0);
});

test('click and touch select without rotating; selection badge matches bottom-up index', () => {
  const r = setup();
  const before = r.state.dirs.join('');
  r.tap(r.shelf(3));
  r.tap(r.shelf(3), { pointerType:'touch' });
  assert.deepEqual(r.selections, [3, 3]);
  assert.equal(r.state.dirs.join(''), before);
  r.view.update(r.state, { selected:3 });
  assert.equal(r.marked('s3d-sel').length, 6);
  const badge = r.marked('s3d-selection-label')[0];
  assert.equal(badge.textContent, '4');
  assert.equal(badge.hidden, false);
});

test('drag and pointer cancellation never select a shelf or retain dragging state', () => {
  const r = setup();
  r.host.emit('pointerdown', { target:r.shelf(3) });
  r.host.emit('pointermove', { clientX:140 });
  r.host.emit('pointerup');
  assert.deepEqual(r.selections, []);
  assert.notEqual(r.view.view.yaw, -32);
  r.host.emit('pointerdown', { target:r.shelf(2) });
  r.host.emit('pointercancel');
  r.host.emit('pointerup');
  assert.deepEqual(r.selections, []);
  assert.equal(r.host.classList.contains('dragging'), false);
});

test('assembly mode isolates selection, hover, badge and pointer cursor', () => {
  const r = setup();
  r.view.update(r.state, {
    selected:3, build:{ installed:Array(11).fill(false), style:'wire', next:0 },
  });
  r.host.emit('pointermove', { target:r.shelf(3) });
  r.tap(r.shelf(3));
  assert.deepEqual(r.selections, []);
  assert.equal(r.marked('s3d-hover').length, 0);
  assert.equal(r.marked('s3d-sel').length, 0);
  assert.equal(r.marked('s3d-selection-label')[0].hidden, true);
  assert.equal(r.host.classList.contains('selectable'), false);
  r.view.update(r.state, { build:null, selectable:true });
  r.tap(r.shelf(3));
  assert.deepEqual(r.selections, [3]);
});

test('decorative renderer consumers remain noninteractive', () => {
  const r = setup({ onSelect:null, drag:false, selected:2 });
  r.host.emit('pointermove', { target:r.shelf(2) });
  r.tap(r.shelf(2));
  assert.equal(r.marked('s3d-hover').length, 0);
  assert.equal(r.marked('s3d-sel').length, 0);
  assert.equal(r.host.classList.contains('selectable'), false);
});

test('selectability can be disabled independently of assembly mode', () => {
  const r = setup();
  r.view.update(r.state, { selectable:false, selected:1 });
  r.tap(r.shelf(1));
  assert.deepEqual(r.selections, []);
  assert.equal(r.marked('s3d-sel').length, 0);
});

test('size, preset, share encoding and assembly progress preserve their existing contracts', () => {
  const { window: { Story:S, Story3D:R }, state } = setup();
  for (const preset of S.PRESETS) {
    const configured = { ...state, dirs:preset.make(11) };
    const smaller = S.resize(configured, 'standard');
    assert.equal(smaller.dirs.length, 9);
    assert.equal(smaller.dirs.join(''), configured.dirs.slice(0, 9).join(''));
    assert.equal(S.encodeUnit(S.decodeUnit(S.encodeUnit(smaller))), S.encodeUnit(smaller));
    R.setProgress(smaller, [true, false, true]);
    assert.equal(R.getProgress(smaller).join(','), 'true,false,true,false,false,false,false,false,false');
  }
});

test('randomize respects allowed directions and no-repeat rules', () => {
  const { window:{ Story:S } } = setup();
  for (let i = 0; i < 50; i++) {
    const dirs = S.randomDirs(11, { allowed:['L', 'R'], noRepeat:true });
    assert.ok(dirs.every((dir, j) => ['L', 'R'].includes(dir) && (!j || dir !== dirs[j - 1])));
  }
  assert.equal(S.randomDirs(9, { allowed:['B'], noRepeat:true }).join(''), 'BBBBBBBBB');
});
