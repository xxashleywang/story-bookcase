(function (global) {
  'use strict';

  const SIZES = {
    standard: { id: 'standard', label: 'Standard', height: 62.5, shelves: 9, weight: 47.25, price: 495 },
    tall: { id: 'tall', label: 'Tall', height: 75.5, shelves: 11, weight: 52, price: 595 },
  };

  // Herman Miller does not publish hex values; these are sampled from the
  // store's product photos (store.hermanmiller.com, item 2197172).
  const COLORS = [
    { id: 'white', name: 'White', hex: '#E4E8E7' },
    { id: 'sesame', name: 'Sesame', hex: '#A8967E' },
    { id: 'saffron', name: 'Saffron', hex: '#E2B062' },
    { id: 'spruce', name: 'Spruce', hex: '#8E9284' },
    { id: 'bordeaux', name: 'Bordeaux', hex: '#6E4C42' },
    { id: 'coal', name: 'Coal', hex: '#3C3C42' },
  ];

  // Clockwise when viewed from above, with "front" pointing at the viewer.
  const DIRS = ['F', 'L', 'B', 'R'];
  const DIR_LABEL = { F: 'Front', L: 'Left', B: 'Back', R: 'Right' };
  const DIR_ARROW = { F: '↓', L: '←', B: '↑', R: '→' };
  const DIR_VEC = { F: [0, 1], B: [0, -1], L: [-1, 0], R: [1, 0] };

  // Inches. Shelf pitch and top gap are approximations read off product photos.
  const GEO = { base: 15.75, baseH: 0.6, col: 1.5, shelfW: 9.75, shelfD: 8, shelfT: 0.3, pitch: 6.5, topGap: 2, shelfLimit: 7 };

  const fill = (n, d) => Array.from({ length: n }, () => d);
  const cycle = (n, seq) => Array.from({ length: n }, (_, i) => seq[i % seq.length]);

  const PRESETS = [
    { id: 'front', name: 'All front', make: (n) => fill(n, 'F') },
    { id: 'alternate', name: 'Front / back', make: (n) => cycle(n, ['F', 'B']) },
    { id: 'sides', name: 'Left / right', make: (n) => cycle(n, ['L', 'R']) },
    { id: 'spiral', name: 'Spiral', make: (n) => cycle(n, ['F', 'R', 'B', 'L']) },
    { id: 'pairs', name: 'Pinwheel', make: (n) => cycle(n, ['F', 'F', 'R', 'R', 'B', 'B', 'L', 'L']) },
    { id: 'corner', name: 'Corner', make: (n) => cycle(n, ['F', 'R']) },
  ];

  // Rerolls up to 40 times so the result differs from `current` whenever the rules allow it.
  function randomDirs(n, { allowed = DIRS, noRepeat = false, current = [] } = {}, rnd = Math.random) {
    const pool = DIRS.filter((d) => allowed.includes(d));
    let out = [];
    for (let tries = 0; tries < 40; tries++) {
      out = [];
      for (let i = 0; i < n; i++) {
        const opts = noRepeat && pool.length > 1 ? pool.filter((d) => d !== out[i - 1]) : pool;
        out.push(opts[Math.floor(rnd() * opts.length)]);
      }
      if (out.join('') !== current.join('')) break;
    }
    return out;
  }

  function rotate(dir, steps = 1) {
    return DIRS[(((DIRS.indexOf(dir) + steps) % 4) + 4) % 4];
  }

  function shelfHeights(size) {
    const s = SIZES[size];
    return Array.from({ length: s.shelves }, (_, i) => s.height - GEO.topGap - (s.shelves - 1 - i) * GEO.pitch);
  }

  function createState(size = 'standard', color = COLORS[0].hex, dirs) {
    const n = SIZES[size].shelves;
    return { size, color, dirs: Array.from({ length: n }, (_, i) => (dirs && dirs[i]) || 'F') };
  }

  function resize(state, size) {
    return createState(size, state.color, state.dirs);
  }

  function colorName(hex) {
    const c = COLORS.find((c) => c.hex.toLowerCase() === String(hex).toLowerCase());
    return c ? c.name : 'Custom';
  }

  function isCatalogColor(hex) {
    return colorName(hex) !== 'Custom';
  }

  function encodeUnit(s) {
    return [s.size === 'tall' ? 't' : 's', s.color.replace('#', '').toLowerCase(), s.dirs.join('')].join('-');
  }

  function decodeUnit(str) {
    const [sz, c, d] = String(str || '').split('-');
    const size = sz === 't' ? 'tall' : 'standard';
    const color = /^[0-9a-f]{6}$/i.test(c || '') ? '#' + c.toUpperCase() : COLORS[0].hex;
    const dirs = (d || '').toUpperCase().split('').filter((ch) => DIRS.includes(ch));
    return createState(size, color, dirs);
  }

  function readHash() {
    const raw = global.location.hash.replace(/^#/, '');
    return raw ? raw.split('_').map(decodeUnit) : [];
  }

  function writeHash(units) {
    const list = Array.isArray(units) ? units : [units];
    global.history.replaceState(null, '', '#' + list.map(encodeUnit).join('_'));
  }

  async function share(units) {
    writeHash(units);
    const url = global.location.href;
    try {
      await navigator.clipboard.writeText(url);
      return { copied: true, url };
    } catch (e) {
      return { copied: false, url };
    }
  }

  function counts(dirs) {
    const c = { F: 0, L: 0, B: 0, R: 0 };
    dirs.forEach((d) => c[d]++);
    return c;
  }

  // Worst case: every shelf carries its 7 lb limit, centred on the shelf.
  function balance(state) {
    const arm = GEO.col / 2 + GEO.shelfD / 2;
    let mx = 0;
    let mz = 0;
    state.dirs.forEach((d) => {
      mx += DIR_VEC[d][0] * arm * GEO.shelfLimit;
      mz += DIR_VEC[d][1] * arm * GEO.shelfLimit;
    });
    const total = SIZES[state.size].weight + GEO.shelfLimit * state.dirs.length;
    const dx = mx / total;
    const dz = mz / total;
    return { dx, dz, offset: Math.hypot(dx, dz), limit: GEO.base / 2 };
  }

  function buildList(state) {
    const hs = shelfHeights(state.size);
    return state.dirs.map((d, i) => ({ n: i + 1, dir: d, label: DIR_LABEL[d], height: hs[i] }));
  }

  function hexToRgb(hex) {
    const v = parseInt(hex.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const mix = (c) => Math.round((t - c) * p + c);
    return '#' + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVGNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function footprint(dir) {
    const c = GEO.col / 2;
    const w = GEO.shelfW / 2;
    const d = GEO.shelfD;
    switch (dir) {
      case 'F': return { x0: -w, x1: w, z0: c, z1: c + d };
      case 'B': return { x0: -w, x1: w, z0: -c - d, z1: -c };
      case 'L': return { x0: -c - d, x1: -c, z0: -w, z1: w };
      default: return { x0: c, x1: c + d, z0: -w, z1: w };
    }
  }

  const BOOK_TONES = ['#C9B79C', '#8C6A52', '#D9D2C3', '#5E6B73', '#B4544A', '#2F3B45', '#E3C27A', '#7D8C6A'];

  function rand(seed) {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  // Front elevation with a slight overhead angle so shelf tops read.
  function renderElevation(svg, state, opts = {}) {
    const o = Object.assign(
      { selected: -1, books: false, accent: '#000', labels: false, labelColor: '#666', fixedHeight: SIZES.tall.height, onSelect: null, floor: '#00000022', font: 'inherit' },
      opts
    );
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const k = 0.22;
    const H = SIZES[state.size].height;
    const viewH = Math.max(H, o.fixedHeight) + 3;
    const half = o.labels ? 16.5 : 12;
    svg.setAttribute('viewBox', `${-half} ${-viewH} ${half * 2} ${viewH + 2.5}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');

    const base = state.color;
    const top = shade(base, 0.16);
    const edge = shade(base, -0.18);
    const line = luminance(base) > 0.75 ? shade(base, -0.35) : shade(base, -0.4);
    const sw = 0.06;
    const Y = (h) => -h;
    const id = 'g' + ++uid;

    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [[0, shade(base, -0.22)], [0.35, shade(base, 0.12)], [0.6, base], [1, shade(base, -0.3)]].forEach(([off, c]) =>
      el('stop', { offset: off, 'stop-color': c }, grad)
    );

    el('ellipse', { cx: 0, cy: 0.2, rx: 10.5, ry: 1.1, fill: o.floor }, svg);

    const hs = shelfHeights(state.size);
    const selLayer = el('g', {}, svg);
    if (o.selected >= 0 && o.selected < hs.length) {
      const h = hs[o.selected];
      el('rect', { x: -half + 0.4, y: Y(h + GEO.pitch / 2), width: half * 2 - 0.8, height: GEO.pitch, rx: 0.8, fill: o.accent, opacity: 0.14 }, selLayer);
      el('rect', { x: -half + 0.4, y: Y(h + GEO.pitch / 2), width: 0.35, height: GEO.pitch, fill: o.accent }, selLayer);
    }

    function plate(dir, h, g, dim) {
      const f = footprint(dir);
      const t = dim ? shade(top, -0.22) : top;
      const e = dim ? shade(edge, -0.22) : edge;
      el('polygon', {
        points: [[f.x0, Y(h) + f.z1 * k], [f.x1, Y(h) + f.z1 * k], [f.x1, Y(h) + f.z0 * k], [f.x0, Y(h) + f.z0 * k]].map((p) => p.join(',')).join(' '),
        fill: t, stroke: line, 'stroke-width': sw, 'stroke-linejoin': 'round',
      }, g);
      el('rect', { x: f.x0, y: Y(h) + f.z1 * k, width: f.x1 - f.x0, height: GEO.shelfT, fill: e, stroke: line, 'stroke-width': sw }, g);
    }

    function books(dir, h, i, g) {
      const f = footprint(dir);
      const cx = (f.x0 + f.x1) / 2;
      const spanX = f.x1 - f.x0;
      const zc = (f.z0 + f.z1) / 2;
      let y = Y(h) + zc * k;
      const count = 2 + Math.floor(rand(i + 1) * 4);
      for (let b = 0; b < count; b++) {
        const th = 0.7 + rand(i * 7 + b) * 0.7;
        const w = Math.min(spanX - 0.6, 6 + rand(i * 13 + b) * 3);
        const jitter = (rand(i * 3 + b) - 0.5) * 0.8;
        el('rect', { x: cx - w / 2 + jitter, y: y - th, width: w, height: th, rx: 0.12, fill: BOOK_TONES[Math.floor(rand(i * 17 + b * 5) * BOOK_TONES.length)], stroke: '#00000033', 'stroke-width': 0.05 }, g);
        y -= th;
        if (Y(h) - y > GEO.pitch - 1.6) break;
      }
    }

    const back = el('g', {}, svg);
    const mid = el('g', {}, svg);
    const front = el('g', {}, svg);

    const b = GEO.base / 2;
    el('polygon', { points: `${-b},${Y(GEO.baseH) + b * k} ${b},${Y(GEO.baseH) + b * k} ${b},${Y(GEO.baseH) - b * k} ${-b},${Y(GEO.baseH) - b * k}`, fill: top, stroke: line, 'stroke-width': sw }, back);
    el('rect', { x: -b, y: Y(GEO.baseH) + b * k, width: GEO.base, height: GEO.baseH, fill: edge, stroke: line, 'stroke-width': sw }, back);
    el('rect', { x: -b + 0.8, y: Y(0) + b * k, width: 1.4, height: 0.25, fill: '#333' }, back);
    el('rect', { x: b - 2.2, y: Y(0) + b * k, width: 1.4, height: 0.25, fill: '#333' }, back);

    hs.forEach((h, i) => {
      const d = state.dirs[i];
      if (d !== 'B') return;
      plate(d, h, back, true);
      if (o.books) books(d, h, i, back);
    });

    el('rect', { x: -GEO.col / 2, y: Y(H), width: GEO.col, height: H - GEO.baseH, fill: `url(#${id})`, stroke: line, 'stroke-width': sw }, mid);
    el('ellipse', { cx: 0, cy: Y(H), rx: GEO.col / 2, ry: GEO.col * k, fill: top, stroke: line, 'stroke-width': sw }, mid);

    hs.forEach((h, i) => {
      const d = state.dirs[i];
      if (d === 'B') return;
      const g = d === 'F' ? front : mid;
      plate(d, h, g, false);
      if (o.books) books(d, h, i, g);
    });

    if (o.labels) {
      const lab = el('g', { 'font-family': o.font, 'font-size': 1, fill: o.labelColor }, svg);
      hs.forEach((h, i) => {
        const t = el('text', { x: GEO.col / 2 + GEO.shelfD + 0.9, y: Y(h) + 0.4 }, lab);
        t.textContent = `${i + 1} · ${DIR_LABEL[state.dirs[i]]}`;
      });
    }

    if (o.onSelect) {
      const hit = el('g', {}, svg);
      hs.forEach((h, i) => {
        const r = el('rect', { x: -half, y: Y(h + GEO.pitch / 2), width: half * 2, height: GEO.pitch, fill: 'transparent', 'data-i': i, style: 'cursor:pointer' }, hit);
        r.addEventListener('click', () => o.onSelect(i));
      });
    }
    return svg;
  }

  // Top-down view. z grows toward the viewer (bottom of the drawing).
  function renderPlan(svg, state, opts = {}) {
    const o = Object.assign({ index: -1, ghosts: true, accent: '#000', ink: '#333', onPick: null, frontLabel: 'FRONT', font: 'inherit' }, opts);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '-11 -11 22 23');
    const b = GEO.base / 2;
    el('rect', { x: -b, y: -b, width: GEO.base, height: GEO.base, rx: 1, fill: 'none', stroke: o.ink, 'stroke-width': 0.08, 'stroke-dasharray': '0.4 0.3', opacity: 0.6 }, svg);
    if (o.ghosts) {
      state.dirs.forEach((d, i) => {
        if (i === o.index) return;
        const f = footprint(d);
        el('rect', { x: f.x0, y: f.z0, width: f.x1 - f.x0, height: f.z1 - f.z0, fill: state.color, opacity: 0.12, stroke: o.ink, 'stroke-opacity': 0.15, 'stroke-width': 0.05 }, svg);
      });
    }
    if (o.index >= 0) {
      const f = footprint(state.dirs[o.index]);
      el('rect', { x: f.x0, y: f.z0, width: f.x1 - f.x0, height: f.z1 - f.z0, rx: 0.3, fill: state.color, stroke: o.accent, 'stroke-width': 0.22 }, svg);
    }
    el('circle', { cx: 0, cy: 0, r: GEO.col / 2, fill: shade(state.color, -0.2), stroke: o.ink, 'stroke-width': 0.08 }, svg);
    const t = el('text', { x: 0, y: 11.4, 'text-anchor': 'middle', 'font-size': 0.9, 'letter-spacing': 0.15, fill: o.ink, 'font-family': o.font }, svg);
    t.textContent = o.frontLabel;
    if (o.onPick) {
      const zones = { F: '0,0 -11,11 11,11', B: '0,0 -11,-11 11,-11', L: '0,0 -11,-11 -11,11', R: '0,0 11,-11 11,11' };
      Object.entries(zones).forEach(([d, pts]) => {
        const p = el('polygon', { points: pts, fill: 'transparent', style: 'cursor:pointer', 'data-dir': d }, svg);
        p.addEventListener('click', () => o.onPick(d));
      });
    }
    return svg;
  }

  function planGlyph(dir, color = '#333', size = 22) {
    const f = footprint(dir);
    const s = 11;
    return `<svg width="${size}" height="${size}" viewBox="${-s} ${-s} ${s * 2} ${s * 2}" aria-label="${DIR_LABEL[dir]}"><rect x="-7.9" y="-7.9" width="15.8" height="15.8" rx="1" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.35"/><rect x="${f.x0}" y="${f.z0}" width="${f.x1 - f.x0}" height="${f.z1 - f.z0}" fill="${color}"/><circle r="1.2" fill="${color}"/></svg>`;
  }

  function printBuildSheet(units, title = 'Story Bookcase build sheet') {
    const list = Array.isArray(units) ? units : [units];
    let root = document.getElementById('story-print');
    if (!root) {
      root = document.createElement('div');
      root.id = 'story-print';
      document.body.appendChild(root);
      const st = document.createElement('style');
      st.textContent = `
        @media screen { #story-print { display: none; } }
        @media print {
          body > :not(#story-print) { display: none !important; }
          #story-print { display: block; font: 11pt/1.4 -apple-system, Helvetica, Arial, sans-serif; color: #111; }
          #story-print .unit { display: grid; grid-template-columns: 2.4in 1fr; gap: 0.4in; page-break-after: always; }
          #story-print svg.elev { width: 2.4in; height: 7.5in; }
          #story-print table { border-collapse: collapse; width: 100%; }
          #story-print td, #story-print th { border-bottom: 1px solid #ccc; padding: 4pt 6pt; text-align: left; }
          #story-print h1 { font-size: 16pt; margin: 0 0 4pt; }
          #story-print .meta { color: #555; margin-bottom: 12pt; }
          #story-print .tick { width: 12pt; height: 12pt; border: 1px solid #333; display: inline-block; }
        }`;
      document.head.appendChild(st);
    }
    root.innerHTML = '';
    list.forEach((s, u) => {
      const wrap = document.createElement('div');
      wrap.className = 'unit';
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'elev');
      renderElevation(svg, s, { labels: true, labelColor: '#111' });
      const rows = buildList(s).slice().reverse()
        .map((r) => `<tr><td>${r.n}</td><td>${planGlyph(r.dir, '#111', 18)}</td><td><strong>${r.label}</strong></td><td><span class="tick"></span></td></tr>`)
        .join('');
      const info = document.createElement('div');
      info.innerHTML = `<h1>${title}${list.length > 1 ? ` — unit ${u + 1}` : ''}</h1>
        <div class="meta">${SIZES[s.size].label} (${SIZES[s.size].height}" tall, ${SIZES[s.size].shelves} shelves) · ${colorName(s.color)} ${s.color}<br>
        Shelf 1 is the lowest. "Front" points toward the room. Directions are viewed from the front.</div>
        <table><thead><tr><th>Shelf</th><th>Plan</th><th>Faces</th><th>Done</th></tr></thead><tbody>${rows}</tbody></table>`;
      wrap.appendChild(svg);
      wrap.appendChild(info);
      root.appendChild(wrap);
    });
    global.print();
  }

  global.Story = {
    SIZES, COLORS, DIRS, DIR_LABEL, DIR_ARROW, DIR_VEC, GEO, PRESETS,
    rotate, randomDirs, shelfHeights, createState, resize, colorName, isCatalogColor,
    encodeUnit, decodeUnit, readHash, writeHash, share, counts, balance, buildList,
    shade, luminance, footprint, renderElevation, renderPlan, planGlyph, printBuildSheet,
  };
})(window);
