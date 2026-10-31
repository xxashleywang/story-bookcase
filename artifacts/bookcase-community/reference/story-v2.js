(function (global) {
  'use strict';
  const S = global.Story;
  const G = S.GEO;
  const LIGHT = normalize([-0.5, 0.75, 0.6]);

  function normalize(v) {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  }

  let cssDone = false;
  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
      .s3d { position: relative; overflow: hidden; user-select: none; touch-action: none; }
      .s3d.draggable { cursor: grab; } .s3d.dragging { cursor: grabbing; }
      .s3d-scene { position: absolute; inset: 0; perspective: 2400px; perspective-origin: 50% 30%; pointer-events: none; }
      .s3d-world { position: absolute; left: 50%; transform-style: preserve-3d; }
      .s3d-world div { position: absolute; left: 0; top: 0; transform-style: preserve-3d; backface-visibility: hidden; pointer-events: auto; }
      .s3d-world .s3d-shadow { backface-visibility: visible; pointer-events: none; }
      .s3d-world .s3d-sel { outline: 1.5px solid var(--s3d-accent, #000); outline-offset: -1px; }
      .s3d-world .s3d-hover { filter: brightness(1.08); }
      .s3d-world .s3d-grp { width: 0; height: 0; backface-visibility: visible; pointer-events: none; }
      .s3d-world .s3d-ghost { opacity: .14; }
      .s3d-world .s3d-float { opacity: .55; }
      .s3d-world .s3d-wire { background: transparent !important; outline: 1.5px dashed var(--s3d-wire, #0000004d); outline-offset: -1px; }
      .s3d-world .s3d-next { animation: s3d-pulse 1.4s ease-in-out infinite; outline: 1px dashed var(--s3d-accent, #000); outline-offset: -1px; }
      .s3d-world .s3d-drop { animation: s3d-drop .75s cubic-bezier(.3,1.5,.5,1) both; }
      .s3d-world .s3d-drop > div:not(.s3d-grp) { animation: s3d-flash .9s ease-out both; }
      .s3d-world .s3d-burst { animation: s3d-burst .8s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes s3d-burst { from { transform: none; } to { transform: translate3d(var(--dx, 0px), var(--dy, 0px), var(--dz, 0px)); } }
      @keyframes s3d-pulse { 0%, 100% { opacity: .2; } 50% { opacity: .6; } }
      @keyframes s3d-drop { from { transform: translate3d(var(--dx, 0px), var(--dy, 0px), var(--dz, 0px)); } to { transform: none; } }
      @keyframes s3d-flash { 0%, 35% { filter: brightness(1.4); } 100% { filter: none; } }
    `;
    document.head.appendChild(st);
  }

  function mount(host, opts = {}) {
    injectCss();
    const o = Object.assign({ yaw: -32, tilt: -10, fit: 0.8, floor: 0.9, selected: -1, onSelect: null, drag: true, shadow: 0.28, accent: '#000', turntable: false }, opts);
    let state = o.state;
    let yaw = o.yaw;
    let tilt = o.tilt;
    let selected = o.selected;
    let faces = [];
    let raf = 0;
    let introAnimations = [];
    function stopIntro() {
      introAnimations.forEach((animation) => animation.cancel());
      introAnimations = [];
    }

    function playIntro() {
      stopIntro();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return stopIntro;
      // A small twist around the pole explains the modular shelves, bottom to top.
      // Animate presentation only: the saved arrangement and build progress never change.
      introAnimations = Array.from(world.querySelectorAll('.s3d-grp')).map((shelf, i) =>
        shelf.animate([
          { transform: 'translateY(12px) rotateY(-14deg)', opacity: 0.25 },
          { transform: 'translateY(0) rotateY(0deg)', opacity: 1 },
        ], {
          duration: 520,
          delay: i * 38,
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'backwards',
        })
      );
      return stopIntro;
    }
    // build: { installed: bool[], style: 'ghost' | 'explode' | 'books', next, drop }
    let build = o.build || null;
    let target = null;

    host.classList.add('s3d');
    if (o.drag) host.classList.add('draggable');
    host.style.setProperty('--s3d-accent', o.accent);
    const scene = document.createElement('div');
    scene.className = 's3d-scene';
    const world = document.createElement('div');
    world.className = 's3d-world';
    scene.appendChild(world);
    host.appendChild(scene);

    function k() {
      return (host.clientHeight * o.fit) / S.SIZES.tall.height;
    }

    function face(w, h, tf, normal, color, data, radius) {
      const d = document.createElement('div');
      d.style.cssText = `width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;transform:${tf};${radius ? `border-radius:${radius}px;` : ''}`;
      if (data) Object.assign(d.dataset, data);
      (target || world).appendChild(d);
      const f = { el: d, n: normal, color, i: data && data.i !== undefined ? +data.i : -1 };
      faces.push(f);
      return f;
    }

    function box(b, color, data, radius) {
      const s = k();
      const w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s, dz = (b.z1 - b.z0) * s;
      const cx = ((b.x0 + b.x1) / 2) * s, cy = ((b.y0 + b.y1) / 2) * s, cz = ((b.z0 + b.z1) / 2) * s;
      face(w, dz, `translate3d(${cx}px,${-b.y1 * s}px,${cz}px) rotateX(90deg)`, [0, 1, 0], color, data, radius);
      face(w, dz, `translate3d(${cx}px,${-b.y0 * s}px,${cz}px) rotateX(-90deg)`, [0, -1, 0], color, data, radius);
      face(w, h, `translate3d(${cx}px,${-cy}px,${b.z1 * s}px)`, [0, 0, 1], color, data);
      face(w, h, `translate3d(${cx}px,${-cy}px,${b.z0 * s}px) rotateY(180deg)`, [0, 0, -1], color, data);
      face(dz, h, `translate3d(${b.x1 * s}px,${-cy}px,${cz}px) rotateY(90deg)`, [1, 0, 0], color, data);
      face(dz, h, `translate3d(${b.x0 * s}px,${-cy}px,${cz}px) rotateY(-90deg)`, [-1, 0, 0], color, data);
    }

    function column(H, color) {
      const s = k();
      const N = 14;
      const r = (G.col / 2) * s;
      const w = 2 * r * Math.tan(Math.PI / N) + 0.6;
      const h = (H - G.baseH) * s;
      const cy = ((H + G.baseH) / 2) * s;
      for (let i = 0; i < N; i++) {
        const a = (i * 360) / N;
        const rad = (a * Math.PI) / 180;
        face(w, h, `translate3d(0,${-cy}px,0) rotateY(${a}deg) translateZ(${r}px)`, [Math.sin(rad), 0, Math.cos(rad)], color);
      }
      face(r * 2, r * 2, `translate3d(0,${-H * s}px,0) rotateX(90deg)`, [0, 1, 0], color, null, r);
    }

    function shade() {
      const a = (yaw * Math.PI) / 180;
      const t = (tilt * Math.PI) / 180;
      faces.forEach((f) => {
        const [nx, ny, nz] = f.n;
        const x1 = nx * Math.cos(a) + nz * Math.sin(a);
        const z1 = -nx * Math.sin(a) + nz * Math.cos(a);
        const y2 = ny * Math.cos(t) + z1 * Math.sin(-t);
        const z2 = -ny * Math.sin(-t) + z1 * Math.cos(t);
        const d = Math.max(0, x1 * LIGHT[0] + y2 * LIGHT[1] + z2 * LIGHT[2]);
        const b = 0.62 + 0.5 * d;
        f.el.style.background = b >= 1 ? S.shade(f.color, Math.min(0.35, (b - 1) * 0.9)) : S.shade(f.color, b - 1);
      });
    }

    function render() {
      if (!state) return;
      stopIntro();
      world.innerHTML = '';
      faces = [];
      const s = k();
      world.style.top = `${host.clientHeight * o.floor}px`;
      world.style.transform = `rotateX(${tilt}deg) rotateY(${yaw}deg)`;
      if (o.shadow) {
        const sh = document.createElement('div');
        const size = 34 * s;
        sh.className = 's3d-shadow';
        sh.style.cssText = `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;transform:translate3d(0,-0.5px,0) rotateX(90deg);background:radial-gradient(closest-side, rgba(0,0,0,${o.shadow}), rgba(0,0,0,${o.shadow * 0.35}) 45%, transparent 100%);`;
        world.appendChild(sh);
      }
      const H = S.SIZES[state.size].height;
      const b = G.base / 2;
      box({ x0: -b, x1: b, y0: 0.25, y1: G.baseH + 0.25, z0: -b, z1: b }, state.color, null, 1.1 * s);
      column(H, state.color);
      S.shelfHeights(state.size).forEach((h, i) => {
        const dir = state.dirs[i];
        const f = S.footprint(dir);
        const placed = !build || !!build.installed[i];
        const [vx, vz] = S.DIR_VEC[dir];
        const off = build && build.style === 'explode' ? [vx * 6 * s, -2.5 * s, vz * 6 * s] : [0, -7 * s, 0];
        const g = group();
        if (!placed && build.style === 'explode') g.style.transform = `translate3d(${off[0]}px,${off[1]}px,${off[2]}px)`;
        if (build && (i === build.drop || (build.burst && !placed))) {
          g.style.cssText += `--dx:${off[0]}px;--dy:${off[1]}px;--dz:${off[2]}px;animation-delay:${i === build.drop ? 0 : i * 0.04}s`;
          g.classList.add(i === build.drop ? 's3d-drop' : 's3d-burst');
        }
        target = g;
        const before = faces.length;
        box({ x0: f.x0, x1: f.x1, y0: h - 0.18, y1: h, z0: f.z0, z1: f.z1 }, state.color, { i }, 0.9 * s);
        const mine = faces.slice(before);
        if (i === selected) mine.forEach((x) => x.el.classList.add('s3d-sel'));
        if (!placed) mine.forEach((x) => x.el.classList.add(i === build.next ? 's3d-next' : { explode: 's3d-float', wire: 's3d-wire' }[build.style] || 's3d-ghost'));
        target = null;
      });
      if (build) { build.drop = -1; build.burst = false; }
      shade();
    }

    function group(cls) {
      const g = document.createElement('div');
      g.className = 's3d-grp' + (cls ? ' ' + cls : '');
      (target || world).appendChild(g);
      return g;
    }

    function setView(y, t) {
      yaw = y;
      tilt = t;
      world.style.transform = `rotateX(${tilt}deg) rotateY(${yaw}deg)`;
      shade();
    }

    function animateTo(y, t, ms = 600) {
      stopIntro();
      cancelAnimationFrame(raf);
      spinning = false;
      const y0 = yaw, t0 = tilt, start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        setView(y0 + (y - y0) * e, t0 + (t - t0) * e);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    let drag = null;
    host.addEventListener('pointerdown', (e) => {
      stopIntro();
      drag = { x: e.clientX, y: e.clientY, yaw, tilt, moved: false, target: e.target };
      if (o.drag) { host.classList.add('dragging'); host.setPointerCapture(e.pointerId); }
      cancelAnimationFrame(raf);
    });
    host.addEventListener('pointermove', (e) => {
      if (!drag || !o.drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      setView(drag.yaw + dx * 0.4, Math.max(-70, Math.min(-2, drag.tilt - dy * 0.25)));
    });
    host.addEventListener('pointerup', () => {
      if (drag && !drag.moved && o.onSelect) {
        const el = drag.target.closest && drag.target.closest('[data-i]');
        if (el) o.onSelect(+el.dataset.i);
      }
      drag = null;
      host.classList.remove('dragging');
    });

    let spinning = o.turntable;
    if (spinning) {
      let last = performance.now();
      const spin = (now) => {
        if (!spinning) return;
        setView(yaw + (now - last) * 0.006, tilt);
        last = now;
        requestAnimationFrame(spin);
      };
      host.addEventListener('pointerdown', () => { spinning = false; });
      requestAnimationFrame(spin);
    }

    new ResizeObserver(render).observe(host);

    return {
      update(next, extra = {}) {
        state = next;
        if (extra.selected !== undefined) selected = extra.selected;
        if (extra.build !== undefined) build = extra.build;
        render();
      },
      select(i) { selected = i; render(); },
      stopSpin() { spinning = false; },
      setView, animateTo, playIntro,
      get view() { return { yaw, tilt }; },
    };
  }

  function progressKey(state) {
    return 'story-progress:' + S.encodeUnit(state);
  }

  function getProgress(state) {
    const saved = JSON.parse(localStorage.getItem(progressKey(state)) || '[]');
    return state.dirs.map((_, i) => !!saved[i]);
  }

  function setProgress(state, list) {
    localStorage.setItem(progressKey(state), JSON.stringify(list));
  }

  global.Story3D = { mount, getProgress, setProgress };
})(window);
