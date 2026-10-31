import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
// Keep the verified prototype geometry, finishing values, and shelf patterns as the model's source of truth.
// @ts-ignore prototype is a browser-global IIFE intentionally bundled as-is.
import '../reference/story-core.js';
// @ts-ignore prototype renderer is a browser-global IIFE intentionally bundled as-is.
import '../reference/story-v2.js';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Dices, Link as LinkIcon,
  LoaderCircle, Search, SlidersHorizontal, Sparkles, X,
} from 'lucide-react';
import type { Build, BuildConfiguration, BuildInput, BuildUpdate, Profile } from '@workspace/api-client-react';
import {
  getCheckUsernameAvailabilityQueryKey, getGetBuildQueryKey, getGetCommunitySummaryQueryKey,
  getGetMyProfileQueryKey, getListBuildsQueryKey, useCheckUsernameAvailability, useCreateBuild,
  useDeleteBuild, useGetBuild, useGetCommunitySummary, useGetMyProfile, useListBuilds,
  useRequestUploadUrl, useUpdateBuild, useUpdateMyProfile,
} from '@workspace/api-client-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import { ColorPicker } from '@/components/color-picker';

declare global {
  interface Window {
    Story: any;
    Story3D: any;
  }
}

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
const COLORS = [
  { name: 'White', hex: '#E4E8E7' }, { name: 'Sesame', hex: '#A8967E' },
  { name: 'Saffron', hex: '#E2B062' }, { name: 'Spruce', hex: '#8E9284' },
  { name: 'Bordeaux', hex: '#6E4C42' }, { name: 'Coal', hex: '#3C3C42' },
];
const WALLS = [
  ['White', '#F6F4F0'], ['Blush', '#EBD3CF'], ['Butter', '#F6E7B8'], ['Mint', '#D3E8DA'],
  ['Sky', '#CFE0EE'], ['Lilac', '#DCD3EA'], ['Night', '#2F3346'],
] as const;
const plank = (a: string, b: string) => `repeating-linear-gradient(90deg, #0000 0 99px, #00000014 99px 100px), linear-gradient(${a}, ${b})`;
const carpet = (a: string, b: string) => `radial-gradient(#FFFFFF1c 1px, transparent 1.6px) 0 0 / 5px 5px, radial-gradient(#00000014 1px, transparent 1.6px) 2px 3px / 6px 6px, linear-gradient(${a}, ${b})`;
const FLOORS = [
  { id: 'pale', name: 'Pale oak', kind: 'Laminate', bg: plank('#EAD8BC', '#DBC4A2') },
  { id: 'honey', name: 'Honey oak', kind: 'Laminate', bg: plank('#E3C8A6', '#D2B48E') },
  { id: 'walnut', name: 'Walnut', kind: 'Laminate', bg: plank('#8C6648', '#74513A') },
  { id: 'ash', name: 'Grey ash', kind: 'Laminate', bg: plank('#CBC5BC', '#B5AEA4') },
  { id: 'white', name: 'Whitewash', kind: 'Laminate', bg: plank('#F1EBE2', '#E2DACE') },
  { id: 'oat', name: 'Oat', kind: 'Carpet', bg: carpet('#DDD0BC', '#CDBFA9') },
  { id: 'moss', name: 'Moss', kind: 'Carpet', bg: carpet('#A3AA8C', '#8E9577') },
];
// Older shared links may still reference retired floors, so FLOORS stays complete for lookups.
const FLOOR_CHOICES = ['pale', 'walnut', 'ash', 'oat'].map((id) => FLOORS.find((f) => f.id === id)!);
const CUSTOM_FLOOR = { id: 'custom', name: 'Custom', kind: 'Laminate', bg: '' };
const kindLabel = (kind: string) => (kind === 'Carpet' ? 'Carpet' : 'Wood');
const RAINBOW = 'conic-gradient(#f3c4b4,#f0e2a8,#bfe0c4,#b8d3ea,#d5c3e8,#f3c4b4)';
const FINISH_PRESETS = ['#F4F1EA', '#D9CBB4', '#C79A5B', '#B5543C', '#E58A6B', '#7E8A6A', '#3F5B4F', '#5C7A99', '#2F3A56', '#7A5C82', '#4A3B33', '#1F1F22'];
const WALL_PRESETS = ['#FBF8F2', '#F2E6D8', '#EFD4C8', '#F4DDA4', '#DDE7CF', '#BFD8C7', '#CFE0EE', '#A9C1D9', '#DCD3EA', '#C9B8D8', '#556B5D', '#2F3346'];
const FLOOR_PRESETS = ['#EAD8BC', '#D9BC92', '#B98D5E', '#8C6648', '#5E4130', '#CBC5BC', '#9C968C', '#DDD0BC', '#B7A58C', '#A3AA8C', '#8A9AA8', '#4B4A48'];
const LOOKS = [
  { name: 'Sunday spiral', color: '#E2B062', pattern: 'spiral', wall: '#CFE0EE', floor: 'pale' },
  { name: 'Moody corner', color: '#3C3C42', pattern: 'corner', wall: '#2F3346', floor: 'walnut' },
  { name: 'Soft pinwheel', color: '#E4E8E7', pattern: 'pairs', wall: '#EBD3CF', floor: 'oat' },
  { name: 'Garden stack', color: '#8E9284', pattern: 'alternate', wall: '#D3E8DA', floor: 'pale' },
  { name: 'Wine bar', color: '#6E4C42', pattern: 'sides', wall: '#F6E7B8', floor: 'ash' },
  { name: 'Quiet lines', color: '#A8967E', pattern: 'front', wall: '#F6F4F0', floor: 'ash' },
];
const VIEWS = [['3/4', -32, -10], ['Front', 0, -4], ['Side', -90, -4], ['Top', -20, -62]] as const;
const directions: Record<string, { label: string; icon: typeof ArrowDown }> = {
  F: { label: 'Front', icon: ArrowDown }, L: { label: 'Left', icon: ArrowLeft },
  B: { label: 'Back', icon: ArrowUp }, R: { label: 'Right', icon: ArrowRight },
};

function initialScene() {
  const S = window.Story;
  const unit = window.location.hash.slice(1).split('~')[0];
  const parsed = unit ? S.decodeUnit(unit) : null;
  const extras = window.location.hash.slice(1).split('~');
  const savedFloor = FLOORS.find((f) => f.id === extras[2]);
  const customHex = extras[4] ? `#${extras[4]}` : '#B9A48A';
  const floorKind = extras[3] === 'Carpet' ? 'Carpet' : (savedFloor?.kind || 'Laminate');
  const selectedFloor = extras[2] === 'custom'
    ? { id:'custom', name:'Custom', kind:floorKind, bg:(floorKind === 'Carpet' ? carpet : plank)(customHex, S.shade(customHex, -.08)) }
    : savedFloor;
  return {
    model: parsed || S.createState('tall', '#E2B062', S.PRESETS.find((p: any) => p.id === 'spiral').make(11)),
    wall: extras[1] ? `#${extras[1]}` : '#F6F4F0',
    floor: selectedFloor || FLOORS[0],
    floorKind,
    customFloorColor:customHex,
  };
}
type Scene = ReturnType<typeof initialScene>;
type ViewHandle = {
  update: (s: any, extra?: any) => void;
  animateTo: (yaw: number, tilt: number) => void;
  playIntro: () => () => void;
};

function hashFor(scene: Scene) {
  const S = window.Story;
  const config = `${S.encodeUnit(scene.model)}~${scene.wall.replace('#', '')}~${scene.floor.id}~${scene.floorKind}~${scene.customFloorColor.replace('#', '')}`;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${config}`);
}
function roomColor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function colorNameFor(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const closest = COLORS.reduce((best, color) => {
    const rgb = [1, 3, 5].map((offset) => Number.parseInt(color.hex.slice(offset, offset + 2), 16));
    const distance = rgb.reduce((sum, value, index) => sum + (value - channels[index]) ** 2, 0);
    return distance < best.distance ? { distance, name:color.name } : best;
  }, { distance:Infinity, name:'Custom color' });
  return closest.distance < 45_000 ? closest.name : 'Custom color';
}
function photoColorSuggestion(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently:true });
  if (!context) return null;
  const cropWidth = image.naturalWidth * 0.4;
  const cropHeight = image.naturalHeight * 0.5;
  context.drawImage(
    image,
    (image.naturalWidth - cropWidth) / 2,
    (image.naturalHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map<string, { red:number; green:number; blue:number; count:number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 220) continue;
    const channels = [pixels[i], pixels[i + 1], pixels[i + 2]]
      .map((channel) => Math.min(255, Math.round(channel / 32) * 32));
    const key = channels.join(',');
    const bucket = buckets.get(key) || { red:channels[0], green:channels[1], blue:channels[2], count:0 };
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return null;
  const hex = `#${[dominant.red, dominant.green, dominant.blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
  return { hex, name:colorNameFor(hex) };
}
function iconPlan(dir: string, size = 23) {
  const Icon = directions[dir]?.icon || ArrowDown;
  return <Icon size={size} strokeWidth={2} aria-label={`${directions[dir]?.label || 'Front'} facing`} />;
}
function BookcaseSketch({ color, dirs, tall = true }: { color: string; dirs: string[]; tall?: boolean }) {
  const count = tall ? 11 : 9;
  const tint = window.Story?.shade ? window.Story.shade(color, -0.2) : '#6d5845';
  return <svg className="mini-svg" viewBox="0 0 140 240" role="img" aria-label="Bookcase preview">
    <ellipse cx="70" cy="228" rx="55" ry="7" fill="#2b1e161a" />
    <rect x="63" y="17" width="14" height="210" rx="6" fill={color} />
    <ellipse cx="70" cy="18" rx="7" ry="4" fill={window.Story?.shade ? window.Story.shade(color, .15) : color} />
    {Array.from({ length: count }, (_, i) => {
      const dir = dirs[i] || 'F';
      const width = dir === 'L' || dir === 'R' ? 58 : 82;
      const x = dir === 'L' ? 5 : dir === 'R' ? 77 : 29;
      const y = 35 + (count - 1 - i) * (174 / count);
      return <g key={i}><rect x={x} y={y} width={width} height="7" rx="2" fill={color} /><rect x={x} y={y + 6} width={width} height="2" fill={tint} /></g>;
    })}
    <rect x="20" y="220" width="100" height="8" rx="2" fill={color} />
  </svg>;
}
function Header({ openPublish }: { openPublish?: () => void }) {
  const { isSignedIn, user } = useUser();
  return <header className="topbar">
    <Link className="brand" href="/">twistory<i /></Link>
    <span className="tagline">Every shelf has a story.</span>
    <nav className="top-actions">
      <Link className="button light small" href="/inspiration">Explore builds</Link>
      {openPublish && <button className="button coral small" onClick={openPublish}><Sparkles size={15} /> Share a build</button>}
      <Show when="signed-in">
        <Link className="button light small" href="/profile">{user?.firstName || 'Your page'}</Link>
      </Show>
      <Show when="signed-out"><Link className="button small" href="/sign-in">Sign in</Link></Show>
    </nav>
  </header>;
}

function Configurator({
  onPublish,
  onSceneChange,
}: {
  onPublish: (scene: Scene) => void;
  onSceneChange: (scene: Scene) => void;
}) {
  const [scene, setScene] = useState<Scene>(() => initialScene());
  const [selected, setSelected] = useState(-1);
  const [tab, setTab] = useState<'style' | 'build'>('style');
  const [allowed, setAllowed] = useState(new Set(['F', 'L', 'B', 'R']));
  const [noRepeat, setNoRepeat] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [note, setNote] = useState('');
  const [rolled, setRolled] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(() => {
    try {
      const config = initialScene().model;
      return window.Story3D.getProgress(config);
    } catch { return []; }
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewHandle | null>(null);
  const selectRef = useRef<(index: number) => void>(() => undefined);
  selectRef.current = setSelected;
  const S = window.Story;
  const pattern = S.PRESETS.find((p: any) => p.make(scene.model.dirs.length).join('') === scene.model.dirs.join(''));
  const currentPattern = pattern?.name || (rolled ? 'Random roll' : 'Your own');
  const activeColor = COLORS.find((c) => c.hex.toLowerCase() === scene.model.color.toLowerCase());
  const floorIsCustom = scene.floor.id === 'custom';
  const wallIsCustom = !WALLS.some(([, hex]) => hex.toLowerCase() === scene.wall.toLowerCase());
  const progress = useMemo(
    () => completed.length === scene.model.dirs.length ? completed : Array.from({ length: scene.model.dirs.length }, (_, i) => !!completed[i]),
    [completed, scene.model.dirs.length],
  );
  const done = progress.filter(Boolean).length;
  const nextShelf = progress.indexOf(false);
  const fullyBuilt = nextShelf === -1;

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    viewRef.current = window.Story3D.mount(hostRef.current, {
      state: scene.model, fit: .66, floor: .86, accent: '#FF6B4A', turntable: false,
      onSelect: (i: number) => selectRef.current(i),
    });
    // Let the initial model update and ResizeObserver settle before revealing shelves.
    let cancelIntro = () => {};
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        cancelIntro = viewRef.current?.playIntro() || (() => {});
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelIntro();
    };
  }, []);
  useEffect(() => onSceneChange(scene), [scene, onSceneChange]);
  useEffect(() => {
    hashFor(scene);
    viewRef.current?.update(scene.model, {
      selected: tab === 'build' ? -1 : selected,
      build: tab === 'build' ? { installed: progress, style: 'wire', next: nextShelf } : null,
    });
  }, [scene, selected, tab, progress, nextShelf]);
  const progressConfigKey = useRef(S.encodeUnit(scene.model));
  useEffect(() => {
    const key = S.encodeUnit(scene.model);
    if (key !== progressConfigKey.current) {
      progressConfigKey.current = key;
      setCompleted(window.Story3D.getProgress(scene.model));
      return;
    }
    window.Story3D.setProgress(scene.model, progress);
  }, [scene.model, progress, S]);
  const updateModel = (change: (model: any) => any) => setScene((old) => ({ ...old, model: change(old.model) }));
  const setWall = (wall: string) => setScene((old) => ({ ...old, wall }));
  const setFloor = (floor: { id:string; name:string; kind:string; bg:string }, kind = floor.kind, hex = scene.customFloorColor) => {
    const chosen = floor.id === 'custom' ? { ...floor, kind, bg: (kind === 'Carpet' ? carpet : plank)(hex, S.shade(hex, -.08)) } : floor;
    setScene((old) => ({ ...old, floor: chosen, floorKind: kind, customFloorColor: hex }));
  };
  const choosePattern = (presetId: string) => {
    const preset = S.PRESETS.find((p: any) => p.id === presetId);
    if (preset) {
      updateModel((model) => ({ ...model, dirs: preset.make(model.dirs.length) }));
      setRolled(false); setRulesOpen(false); setNote('');
    }
  };
  const toggleAllowed = (dir: string) => {
    setAllowed((old) => {
      const nextAllowed = new Set(old);
      if (nextAllowed.has(dir) && nextAllowed.size === 1) { setNote('Keep at least one direction. Shelves have to face somewhere.'); return old; }
      if (nextAllowed.has(dir)) nextAllowed.delete(dir); else nextAllowed.add(dir);
      setNote(nextAllowed.size === 1 ? `Only ${directions[[...nextAllowed][0]]?.label} left, so every roll is the same.` : '');
      return nextAllowed;
    });
  };
  const roll = () => {
    if (rolling) return;
    const finalDirs = S.randomDirs(scene.model.dirs.length, { allowed: [...allowed], noRepeat, current: scene.model.dirs });
    setRolling(true); setRolled(true); setRulesOpen(false);
    let tick = 0;
    const animate = () => {
      if (tick++ < 6) {
        updateModel((model) => ({ ...model, dirs: model.dirs.map(() => [...allowed][Math.floor(Math.random() * allowed.size)]) }));
        window.setTimeout(animate, 65);
      } else {
        updateModel((model) => ({ ...model, dirs: finalDirs }));
        setRolling(false);
      }
    };
    animate();
  };
  const useLook = (look: typeof LOOKS[number]) => {
    const preset = S.PRESETS.find((p: any) => p.id === look.pattern);
    updateModel((m) => ({ ...m, color: look.color, dirs: preset.make(m.dirs.length) }));
    setWall(look.wall);
    const floor = FLOORS.find((f) => f.id === look.floor) || FLOORS[0];
    setFloor(floor);
    setTab('style');
  };
  const changeShelf = (index: number, dir: string) => updateModel((m) => ({ ...m, dirs: m.dirs.map((d: string, i: number) => i === index ? dir : d) }));
  const toggleShelf = (index: number) => {
    const next = [...progress];
    next[index] = !next[index];
    setCompleted(next);
    window.Story3D.setProgress(scene.model, next);
  };
  const setSize = (size: string) => {
    const model = S.resize(scene.model, size);
    const stored = window.Story3D.getProgress(model);
    setCompleted(stored);
    setSelected((old) => Math.min(old, model.dirs.length - 1));
    setScene((old) => ({ ...old, model }));
  };
  const saveShareLink = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); window.alert('Build link copied.'); }
    catch { window.prompt('Copy your build link', url); }
  };

  return <div className="playroom">
    <section className={`stage ${roomColor(scene.wall) < .45 ? 'is-dark' : ''}`} style={{ backgroundColor: scene.wall, '--wall': scene.wall, '--floor-background': floorIsCustom ? (scene.floorKind === 'Carpet' ? carpet : plank)(scene.customFloorColor, S.shade(scene.customFloorColor, -.08)) : scene.floor.bg } as CSSProperties}>
      <div className="room-floor" />
      <div id="bookcase-model" ref={hostRef} />
      <div className="scene-copy"><h1>{scene.model.size === 'tall' ? 'Tall' : 'Standard'} &amp;<br /><span style={{ backgroundImage: `linear-gradient(transparent 64%, ${scene.model.color}66 64%)` }}>{activeColor?.name || 'Custom finish'}</span></h1>
        <p>{S.SIZES[scene.model.size].height}&quot; · {scene.model.dirs.length} shelves · {currentPattern.toLowerCase()} · {WALLS.find((w) => w[1] === scene.wall)?.[0] || 'custom'} wall</p></div>
      <div className="scene-stamp" aria-label="Twist it, stack it, style it">
        <svg viewBox="0 0 110 110"><defs><path id="stampCircle" d="M55,55 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs><text fontSize="10" fontWeight="700" letterSpacing="2.5" fill="currentColor"><textPath href="#stampCircle">TWIST IT · STACK IT · STYLE IT · </textPath></text></svg>
        <b>{tab === 'build' ? `${Math.round(done / progress.length * 100)}%` : `${S.SIZES[scene.model.size].height}″`}</b>
      </div>
      <div className="views">{VIEWS.map(([label, yaw, tilt], i) => <button key={label} className={viewIndex === i ? 'active' : ''} onClick={() => { setViewIndex(i); viewRef.current?.animateTo(yaw, tilt); }}>{label}</button>)}</div>
    </section>
    <section className="control-panel">
      <div className={`tabs ${tab === 'build' ? 'building' : ''}`}><i className="tab-pill" />
        <button className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}>Style it</button>
        <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>Build it <small>{done}/{scene.model.dirs.length}</small></button>
      </div>
      <div className="pane" hidden={tab !== 'style'}>
        <section className="section"><h2>How tall? <small>15¾&quot; square footprint</small></h2>
          <div className="size-options">{Object.values(S.SIZES).map((size: any) => <button key={size.id} className={`size-option ${scene.model.size === size.id ? 'active' : ''}`} onClick={() => setSize(size.id)}><b>{size.label}</b><span>{size.height}&quot; · {size.shelves} shelves</span></button>)}</div>
        </section>
        <section className="section"><h2>Finish <small>{activeColor?.name || `Custom ${scene.model.color}`}</small></h2>
          <div className="color-dots">{COLORS.map((c) => <button key={c.hex} aria-label={`${c.name} finish`} title={c.name} className={`color-dot ${scene.model.color.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}`} style={{ background: c.hex }} onClick={() => updateModel((m) => ({ ...m, color: c.hex }))} />)}
            <ColorPicker title="Custom finish" value={scene.model.color} presets={FINISH_PRESETS} onChange={(hex) => updateModel((m) => ({ ...m, color: hex }))}
              trigger={<button type="button" aria-label="Custom finish color" title="Custom color" className={`color-input ${!activeColor ? 'active' : ''}`} style={!activeColor ? { background: scene.model.color } : undefined} />} />
          </div>
        </section>
        <section className="section"><h2>Paint your wall <small>{WALLS.find((w) => w[1] === scene.wall)?.[0] || `Custom ${scene.wall.toUpperCase()}`}</small></h2>
          <div className="swatches">{WALLS.map(([name, hex]) => <button key={hex} className={`swatch ${scene.wall === hex ? 'active' : ''}`} onClick={() => setWall(hex)}><i style={{ background: hex }} />{name}</button>)}
            <ColorPicker title="Custom wall" value={scene.wall} presets={WALL_PRESETS} onChange={setWall}
              trigger={<button type="button" className={`swatch ${wallIsCustom ? 'active' : ''}`}><i style={{ background: wallIsCustom ? scene.wall : RAINBOW }} />Make your own</button>} />
          </div>
        </section>
        <section className="section"><h2>Pick your floor <small>{floorIsCustom ? 'Custom' : scene.floor.name} · {kindLabel(scene.floorKind)}</small></h2>
          <div className="floor-grid">{FLOOR_CHOICES.map((f) => <button key={f.id} className={`floor-swatch ${scene.floor.id === f.id ? 'active' : ''}`} onClick={() => setFloor(f)}><i style={{ background: f.bg }} />{f.name}<small>{kindLabel(f.kind)}</small></button>)}
            <ColorPicker title="Custom floor" value={scene.customFloorColor} presets={FLOOR_PRESETS}
              onOpen={() => { if (!floorIsCustom) setFloor(CUSTOM_FLOOR, scene.floorKind === 'Carpet' ? 'Carpet' : 'Laminate', scene.customFloorColor); }}
              onChange={(hex) => setFloor(CUSTOM_FLOOR, scene.floorKind === 'Carpet' ? 'Carpet' : 'Laminate', hex)}
              trigger={<button type="button" className={`floor-swatch ${floorIsCustom ? 'active' : ''}`}><i style={{ background: floorIsCustom ? (scene.floorKind === 'Carpet' ? carpet : plank)(scene.customFloorColor, S.shade(scene.customFloorColor, -.08)) : RAINBOW }} />Make your own<small>{floorIsCustom ? kindLabel(scene.floorKind) : 'Any color'}</small></button>}>
              <div className="tw-picker-texture"><span>Texture</span><div className="segment">{(['Laminate', 'Carpet'] as const).map((kind) => <button type="button" key={kind} className={scene.floorKind === kind ? 'active' : ''} onClick={() => setFloor(CUSTOM_FLOOR, kind, scene.customFloorColor)}>{kindLabel(kind)}</button>)}</div></div>
            </ColorPicker>
          </div>
        </section>
        <section className="section"><h2>Shelf pattern <small>{currentPattern}</small></h2>
          <div className="pattern-list">{S.PRESETS.map((p: any) => <button key={p.id} className={`pattern ${p.make(scene.model.dirs.length).join('') === scene.model.dirs.join('') ? 'active' : ''}`} onClick={() => choosePattern(p.id)}>{iconPlan(p.make(4)[1], 20)}{p.name}</button>)}
            <span className="random-controls"><button className={`pattern random ${rolled ? 'active' : ''}`} disabled={rolling} onClick={roll}><Dices size={15}/> Randomize</button><button aria-label="Randomize rules" className="pattern random" onClick={() => setRulesOpen(!rulesOpen)}><SlidersHorizontal size={16}/>{4 - allowed.size + Number(noRepeat) ? <small>{4 - allowed.size + Number(noRepeat)}</small> : null}</button></span>
            {rulesOpen && <div className="rules-pop"><h3>Shelves can face</h3><div className="allowed-grid">{Object.entries(directions).map(([dir, detail]) => <button key={dir} className={!allowed.has(dir) ? 'off' : ''} onClick={() => toggleAllowed(dir)}>{iconPlan(dir, 24)}<br />{detail.label}</button>)}</div><button className={`toggle-row ${noRepeat ? 'on' : ''}`} onClick={() => setNoRepeat(!noRepeat)}><i className="toggle" />No two neighbours alike</button><p className="note">{note}</p></div>}
          </div>
        </section>
        <section className="section"><h2>Fine-tune <small>or click a shelf</small></h2>
          <div className="tune-box">{selected < 0 ? <><div className="selected-shelf">?<small>no shelf</small></div><div style={{ color:'var(--muted-ink)', fontSize:13 }}>Select a shelf on the bookcase to turn it to a new side.</div></> :
            <><div className="selected-shelf">{selected + 1}<small>of {scene.model.dirs.length}</small></div><div className="segment">{Object.entries(directions).map(([dir, detail]) => <button key={dir} className={scene.model.dirs[selected] === dir ? 'active' : ''} onClick={() => changeShelf(selected, dir)}>{detail.label}</button>)}</div>
              <div className="step-buttons"><button className="button light small" onClick={() => setSelected(Math.max(0, selected - 1))}>Lower shelf</button><button className="button light small" onClick={() => setSelected(Math.min(scene.model.dirs.length - 1, selected + 1))}>Higher shelf</button></div></>}
          </div>
        </section>
        <section className="section" style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
          <button className="button light small" onClick={saveShareLink}><LinkIcon size={14}/>Copy room link</button>
          <button className="button coral small" onClick={() => onPublish(scene)}><Sparkles size={14}/>Share your build</button>
        </section>
      </div>
      <div className="pane" hidden={tab !== 'build'}>
        <section className="section"><div className="build-meter"><div className="build-meter-top"><b>{Math.round(done / progress.length * 100)}%</b><span>{done} of {progress.length} shelves</span></div><div className="progress-track"><i style={{ width:`${Math.max(4, done / progress.length * 100)}%` }} /></div><p>{fullyBuilt ? 'Every shelf is on. Anchor it to the wall with the strap in the box.' : done ? `Nice. Next up: shelf ${nextShelf + 1}, facing ${directions[scene.model.dirs[nextShelf]]?.label.toLowerCase()}.` : 'Start with the base and post, then shelf 1 at the bottom.'}</p></div></section>
        <section className="section"><h2>Bottom to top <small>tap as you place</small></h2><div className="shelf-list">{S.buildList(scene.model).map((shelf: any, i: number) => <button key={i} className={`shelf-row ${progress[i] ? 'done' : ''}`} onClick={() => toggleShelf(i)}><span className="shelf-number">{i + 1}</span>{iconPlan(shelf.dir, 23)}<span className="shelf-text"><b>Faces {shelf.label.toLowerCase()}</b><small>{i === 0 ? 'Lowest shelf' : i === progress.length - 1 ? 'Top shelf' : `${shelf.height.toFixed(1)}″ up`}</small></span><span className="mini-toggle" /></button>)}</div></section>
        <section className="section build-tools"><button className="button light small" onClick={() => { setCompleted(Array(progress.length).fill(false)); window.Story3D.setProgress(scene.model, []); }}>Start over</button><button className="button light small" onClick={() => S.printBuildSheet(scene.model)}>Print sheet</button><button className="button coral small" onClick={() => onPublish(scene)}>Share build</button></section>
      </div>
    </section>
  </div>;
}

function InspirationDrawer({ open, close, onUse, builds }: { open: boolean; close: () => void; onUse: (config: BuildConfiguration) => void; builds: Build[] }) {
  const hostRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    const mounted: any[] = [];
    hostRefs.current.forEach((el, i) => {
      if (!el) return;
      const look = LOOKS[i];
      const dirs = window.Story.PRESETS.find((p: any) => p.id === look.pattern).make(11);
      mounted[i] = window.Story3D.mount(el, { state:window.Story.createState('tall', look.color, dirs), fit:.75, floor:.88, yaw:-28, drag:false, shadow:.25 });
    });
    return () => mounted.forEach((instance) => instance?.stopSpin?.());
  }, [open]);
  const useConfig = (config: BuildConfiguration) => { onUse(config); close(); };
  return <>
    <button aria-label="Close inspiration panel" className={`drawer-scrim ${open ? 'open' : ''}`} onClick={close} />
    <aside className={`inspire-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-head"><div><span className="eyebrow">A little spark</span><h2>Get inspired</h2><p>Borrow a starting point, then make it feel like yours.</p></div><button aria-label="Close" className="icon-button" onClick={close}><X size={18}/></button></div>
      <div className="drawer-content">
        <div className="looks-grid">{LOOKS.map((look, i) => {
          const floor = FLOORS.find((f) => f.id === look.floor)!;
          const preset = window.Story.PRESETS.find((p: any) => p.id === look.pattern);
          return <article className="look-card" key={look.name}><div className="look-stage" style={{ background:look.wall, '--floor-background':floor.bg } as CSSProperties}><div className="room-floor"/><div className="look-model" ref={(node) => { hostRefs.current[i] = node; }} /></div><div className="look-meta"><div><b>{look.name}</b><span>{window.Story.colorName(look.color)} · {floor.name}</span></div><button className="button small" onClick={() => useConfig({ size:'tall', color:look.color, shelfDirections:preset.make(11), wallColor:look.wall, floorId:floor.id, floorKind:floor.kind as any, customFloorColor:null })}>Use look</button></div></article>;
        })}</div>
        {builds.length > 0 && <div style={{ marginTop:24 }}><div className="drawer-head" style={{ padding:'10px 0' }}><div><span className="eyebrow">From the community</span><h2 style={{ fontSize:27 }}>Makers’ rooms</h2></div><Link className="button light small" href="/inspiration" onClick={close}>See all</Link></div>
          <div className="looks-grid">{builds.slice(0, 4).map((build) => <article className="look-card" key={build.id}><div className="look-stage" style={{ background:build.configuration.wallColor }}><div className="room-floor"/><div className="look-model"><BookcaseSketch color={build.configuration.color} dirs={build.configuration.shelfDirections}/></div></div><div className="look-meta"><div><b>{build.title}</b><span>by @{build.creatorUsername}</span></div><button className="button small" onClick={() => useConfig(build.configuration)}>Open</button></div></article>)}</div>
        </div>}
        <div className="empty-state" style={{ marginTop:16 }}><b>Room to make it your own.</b><br/>Public member builds are also waiting in the inspiration gallery.</div>
        <Link className="button coral" href="/inspiration" onClick={close} style={{ marginTop:14 }}>Browse the gallery</Link>
      </div>
    </aside>
  </>;
}

function PublishDialog({ open, close, initial, onSaved }: { open: boolean; close: () => void; initial: Scene; onSaved: (build: Build) => void }) {
  const create = useCreateBuild();
  const requestUpload = useRequestUploadUrl();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('Herman Miller');
  const [modelName, setModelName] = useState('Story');
  const [colorHex, setColorHex] = useState(initial.model.color);
  const [colorName, setColorName] = useState(window.Story.colorName(initial.model.color));
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const photoPaths = useRef<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setTitle(''); setDescription(''); setBrand('Herman Miller'); setModelName('Story');
    setColorHex(initial.model.color); setColorName(window.Story.colorName(initial.model.color));
    setTags([]); setCustomTag(''); setFiles([]); setPreviews([]); photoPaths.current = [];
    setStatus(''); setFailed(false);
  }, [open, initial]);
  const updateFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const nextFiles = [...files];
    for (const file of Array.from(incoming)) {
      if (nextFiles.length >= 8) { setStatus('Choose up to 8 photos.'); setFailed(true); break; }
      if (file.size > 12_000_000) { setStatus(`${file.name} is larger than 12 MB.`); setFailed(true); continue; }
      if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) { setStatus('Use a JPEG, PNG, WebP, or AVIF image.'); setFailed(true); continue; }
      nextFiles.push(file);
    }
    setFiles(nextFiles);
    setPreviews(nextFiles.map((f) => URL.createObjectURL(f)));
    setFailed(false);
    if (nextFiles.length) {
      const img = new Image();
      img.onload = () => {
        const suggestion = photoColorSuggestion(img);
        if (suggestion) {
          setColorHex(suggestion.hex);
          setColorName(suggestion.name);
        }
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(nextFiles[0]);
    }
  };
  const toggleTag = (tag: string) => setTags((old) => old.includes(tag) ? old.filter((x) => x !== tag) : old.length < 11 ? [...old, tag] : old);
  const uploadPhotos = async () => {
    const paths: string[] = [];
    for (const file of files) {
      const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
      const signed = await requestUpload.mutateAsync({ data:{ name:file.name, size:file.size, contentType } });
      const upload = await fetch(signed.uploadURL, { method:'PUT', headers:{ 'Content-Type':contentType }, body:file });
      if (!upload.ok) throw new Error(`Could not upload ${file.name}.`);
      paths.push(signed.objectPath);
      setStatus(`Uploading ${paths.length} of ${files.length} photos…`);
    }
    return paths;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setFailed(false);
    if (title.trim().length < 2) { setStatus('Give this build a name with at least 2 characters.'); setFailed(true); return; }
    if (!files.length && !photoPaths.current.length) { setStatus('Add at least one photo to publish.'); setFailed(true); return; }
    setStatus('Preparing your story…');
    try {
      const uploaded = files.length ? await uploadPhotos() : photoPaths.current;
      const config: BuildConfiguration = {
        size:initial.model.size, color:initial.model.color, shelfDirections:[...initial.model.dirs],
        wallColor:initial.wall, floorId:initial.floor.id, floorKind:initial.floorKind as any,
        customFloorColor:initial.floor.id === 'custom' ? initial.customFloorColor : null,
      };
      const payload: BuildInput = {
        title:title.trim(), description:description.trim() || null, brand:brand.trim() || null,
        modelName:modelName.trim() || null, category:'bookcase', colorName:colorName.trim() || 'Custom',
        colorHex:colorHex.toUpperCase(), tags:[colorName, ...tags].filter((v, i, a) => a.indexOf(v) === i).slice(0,12),
        photoPaths:uploaded, configuration:config,
      };
      const build = await create.mutateAsync({ data:payload });
      onSaved(build); close();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Publishing did not work. Please try again.');
      setFailed(true);
    }
  };
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <form className="modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">Pass it along</span><h2>Share your build</h2></div><button type="button" aria-label="Close" className="icon-button" onClick={close}><X size={18}/></button></div>
      <div className="form-grid">
        <div className="field full"><label htmlFor="build-title">Build name</label><input id="build-title" required minLength={2} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A name for this room" /></div>
        <div className="field"><label htmlFor="build-brand">Brand</label><input id="build-brand" maxLength={80} value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
        <div className="field"><label htmlFor="build-model">Model</label><input id="build-model" maxLength={120} value={modelName} onChange={(e) => setModelName(e.target.value)} /></div>
        <div className="field full"><label htmlFor="build-description">A few words about it</label><textarea id="build-description" maxLength={1200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The small details that make it yours…" /></div>
        <div className="field"><label htmlFor="bookcase-color">Suggested bookcase color</label><div style={{ display:'flex', gap:8 }}><input id="bookcase-color" type="color" value={colorHex} onChange={(e) => { const hex = e.target.value.toUpperCase(); setColorHex(hex); setColorName(colorNameFor(hex)); }} style={{ width:48, padding:4 }} /><input aria-label="Color name" value={colorName} onChange={(e) => setColorName(e.target.value)} maxLength={40} /></div><small className="note">Suggested from the center of your first photo. Check or adjust it before sharing.</small></div>
        <div className="field"><label>Style / room tags</label><div className="build-tags">{['Colorful','Small space','Reading nook','Minimal','Collected','Vintage','Living room','Bedroom','Kids room','DIY'].map((tag) => <button type="button" className={`tag ${tags.includes(tag) ? 'active' : ''}`} key={tag} onClick={() => toggleTag(tag)} style={tags.includes(tag) ? { background:'var(--ink)',color:'white' } : {}}>{tag}</button>)}</div><div style={{ display:'flex', gap:5 }}><input aria-label="Add custom tag" value={customTag} onChange={(e) => setCustomTag(e.target.value)} maxLength={32} placeholder="Add a tag" /><button type="button" className="button light small" onClick={() => { if (customTag.trim() && !tags.includes(customTag.trim())) toggleTag(customTag.trim()); setCustomTag(''); }}>Add</button></div></div>
      </div>
      <div className="file-drop"><label htmlFor="build-photos"><b>Room photos</b> <span className="note">· up to 8 images, 12 MB each</span></label><input id="build-photos" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => updateFiles(e.currentTarget.files)} />
        <div className="photo-preview">{previews.map((src, i) => <img key={`${src}-${i}`} src={src} alt={`Selected room ${i + 1}`} />)}</div>
      </div>
      <p className={`status ${failed ? 'error' : ''}`}>{status || 'Your room is inspiration, not a listing. No transactions here.'}</p>
      <div className="form-actions"><button type="button" className="button light" onClick={close}>Cancel</button><button className="button coral" disabled={create.isPending || requestUpload.isPending}>{create.isPending || requestUpload.isPending ? <><LoaderCircle size={15}/>Sharing…</> : 'Publish build'}</button></div>
    </form>
  </div>;
}

function usePublishedBuilds() {
  const params = useMemo(() => ({ sort:'recent' as const, limit:40 }), []);
  return useListBuilds(params);
}
function BuildCard({ build }: { build: Build }) {
  const photo = build.photoPaths?.[0];
  return <Link href={`/build/${build.id}`} className="build-card" data-testid={`card-build-${build.id}`}>
    {photo ? <img className="build-image" src={`/api/storage${photo}`} alt={`${build.title} bookcase`} /> :
      <div className="build-image placeholder" style={{ backgroundColor:build.configuration.wallColor }}><BookcaseSketch color={build.configuration.color} dirs={build.configuration.shelfDirections} tall={build.configuration.size === 'tall'} /></div>}
    <div className="build-info"><div className="build-info-head"><h3>{build.title}</h3></div><p>by @{build.creatorUsername} · {build.colorName}</p><div className="build-tags">{build.tags.slice(0,3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div>
  </Link>;
}
function LoadingCards() { return <div className="loading-grid" aria-label="Loading community builds">{[0,1,2,3,4,5].map((i) => <div className="skeleton" key={i}/>)}</div>; }
function Gallery() {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const params = useMemo(() => ({
    q:search.trim() || undefined,
    tag:selectedTag || undefined,
    sort:'recent' as const,
    limit:40,
  }), [search, selectedTag]);
  const { data:builds, isLoading, isError, refetch } = useListBuilds(params);
  const { data:summary } = useGetCommunitySummary();
  return <div className="tw-shell"><Header/><main className="gallery-page">
    <section className="gallery-hero"><div><span className="eyebrow">The Twistory inspiration gallery</span><h1>Rooms with<br/>a good story.</h1></div><p>{summary ? `${summary.totalBuilds} builds from ${summary.totalBuilders} makers.` : 'A collection of bookcase ideas from people who love making a room their own.'} Browse, borrow a detail, and bring a build back to your Playroom.</p></section>
    <div className="gallery-tools"><label className="search-box"><Search size={17}/><input aria-label="Search community builds" placeholder="Search a color, maker, or room…" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
    {!!summary?.popularTags.length && <div className="tag-filter" aria-label="Filter by tag">
      <button className={`tag ${!selectedTag ? 'active' : ''}`} onClick={() => setSelectedTag('')}>Everything</button>
      {summary.popularTags.map((tag) => <button key={tag} className={`tag ${selectedTag === tag ? 'active' : ''}`} onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}>{tag}</button>)}
    </div>}
    {isLoading ? <LoadingCards/> : isError ? <div className="empty-state"><h2>We couldn't load the gallery.</h2><p>Your inspiration is still here; try once more.</p><button className="button" onClick={() => refetch()}>Try again</button></div> : builds?.length ? <div className="build-grid">{builds.map((build) => <BuildCard key={build.id} build={build}/>)}</div> :
      <div className="empty-state"><Sparkles size={23}/><h2>No stories in this corner yet.</h2><p>Try another search, or be the first to share a room.</p><Link className="button coral" href="/">Open the Playroom</Link></div>}
  </main></div>;
}

function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const buildId = Number(id);
  const { data:build, isLoading, isError, refetch } = useGetBuild(buildId, { query:{ enabled:Number.isFinite(buildId) && buildId > 0, queryKey:getGetBuildQueryKey(buildId) } });
  if (isLoading) return <div className="tw-shell"><Header/><main className="gallery-page"><div className="skeleton"/></main></div>;
  if (isError || !build) return <div className="tw-shell"><Header/><main className="gallery-page empty-state"><h1>That build isn't here.</h1><p>It may have moved. The maker's story is still worth finding.</p><button className="button" onClick={() => refetch()}>Try again</button><Link href="/inspiration" className="button light">Back to inspiration</Link></main></div>;
  const setConfig = () => {
    const config = build.configuration;
    const unit = window.Story.encodeUnit({ size:config.size, color:config.color, dirs:config.shelfDirections });
    const custom = config.customFloorColor?.replace('#','') || 'B9A48A';
    const hash = `${unit}~${config.wallColor.replace('#','')}~${config.floorId}~${config.floorKind || 'Laminate'}~${custom}`;
    window.location.assign(`${basePath || ''}/#${hash}`);
  };
  return <div className="tw-shell"><Header/><main className="gallery-page">
    <Link href="/inspiration" className="button light small"><ArrowLeft size={15}/>Back to inspiration</Link>
    <div className="detail-layout">
      <div>{build.photoPaths.length ? <img className="detail-photo" src={`/api/storage${build.photoPaths[0]}`} alt={`${build.title} room`} /> : <div className="detail-photo" style={{ display:'grid',placeItems:'center',backgroundColor:build.configuration.wallColor }}><BookcaseSketch color={build.configuration.color} dirs={build.configuration.shelfDirections} tall={build.configuration.size === 'tall'} /></div>}
        {build.photoPaths.length > 1 && <div className="photo-preview">{build.photoPaths.slice(1).map((p,i) => <img key={p} src={`/api/storage${p}`} alt={`${build.title} detail ${i + 2}`} />)}</div>}</div>
      <section className="detail-copy"><span className="eyebrow">A community build · Bookcase</span><h1>{build.title}</h1><p>By @{build.creatorUsername} · {new Date(build.createdAt).toLocaleDateString(undefined,{ year:'numeric',month:'long',day:'numeric' })}</p>
         <p>{build.description || 'A room built around a bookcase, shared for the ideas it might start.'}</p><div className="detail-chips">{build.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
         <div className="detail-config"><b>{build.brand || 'Story'} {build.modelName || 'Bookcase'}</b><p style={{ margin:'7px 0' }}>{build.configuration.size === 'tall' ? 'Tall' : 'Standard'} · {build.configuration.shelfDirections.length} shelves · {build.colorName}</p></div>
        <button className="button coral" onClick={setConfig}><Sparkles size={16}/>Open this build in Playroom</button>
      </section>
    </div>
  </main></div>;
}

function UsernameEditor({ profile, onComplete }: { profile: Profile; onComplete: () => void }) {
  const [username, setUsername] = useState(profile.username || '');
  const update = useUpdateMyProfile();
  const validFormat = username.length >= 3 && username.length <= 24 && /^[A-Za-z0-9._-]+$/.test(username) && /[A-Za-z0-9]/.test(username);
  const checkParams = useMemo(() => ({ username:validFormat ? username : 'member-check' }), [username, validFormat]);
  const check = useCheckUsernameAvailability(checkParams, { query:{ enabled:validFormat && username !== profile.username, queryKey:getCheckUsernameAvailabilityQueryKey(checkParams) } });
  const queryClient = useQueryClient();
  const submit = () => {
    if (!validFormat || (username !== profile.username && !check.data?.available)) return;
    update.mutate({ data:{ username } }, { onSuccess:() => { queryClient.invalidateQueries({ queryKey:getGetMyProfileQueryKey() }); onComplete(); } });
  };
  return <div className="modal-backdrop"><section className="modal"><div className="modal-head"><div><span className="eyebrow">Your maker mark</span><h2>Choose a username</h2></div></div><p>It becomes your public Twistory address. Keep it unmistakably you.</p>
    <div className="field"><label htmlFor="username">Public username</label><input id="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} autoComplete="off" placeholder="your.name" /></div>
    <p className={`status ${!validFormat && username ? 'error' : ''}`}>{!validFormat && username ? '3–24 characters. Use letters, numbers, periods, underscores or hyphens; include at least one letter or number.' : username === profile.username ? 'Your current username is ready.' : check.isLoading ? 'Checking availability…' : check.data?.available ? 'That username is yours to claim.' : validFormat ? 'That username is already taken.' : '3–24 characters, letters / numbers / . _ -'}</p>
    {update.isError && <p className="status error">Couldn't save your username. Try a different one.</p>}
    <div className="form-actions"><button className="button coral" disabled={!validFormat || (username !== profile.username && !check.data?.available) || update.isPending} onClick={submit}>{update.isPending ? 'Saving…' : 'Save username'}</button></div>
  </section></div>;
}
function ProfilePage() {
  const { isSignedIn, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { data:profile, isLoading:profileLoading, isError:profileError, refetch } = useGetMyProfile({ query:{ enabled:!!isSignedIn, queryKey:getGetMyProfileQueryKey() } });
  const { data:allBuilds, isLoading:buildsLoading } = usePublishedBuilds();
  const updateBuild = useUpdateBuild();
  const deleteBuild = useDeleteBuild();
  const [editBuild, setEditBuild] = useState<Build | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Build | null>(null);
  if (!isLoaded) return <div className="tw-shell"><Header/><main className="gallery-page"><div className="skeleton"/></main></div>;
  if (!isSignedIn) return <div className="tw-shell"><Header/><main className="gallery-page empty-state"><h1>Your maker page.</h1><p>Sign in to claim your username and share the builds you’ve published.</p><Link className="button coral" href="/sign-in">Sign in to Twistory</Link></main></div>;
  if (profileLoading) return <div className="tw-shell"><Header/><main className="gallery-page"><div className="skeleton"/></main></div>;
  if (profileError) return <div className="tw-shell"><Header/><main className="gallery-page empty-state"><h1>Couldn't open your profile.</h1><button className="button" onClick={() => refetch()}>Try again</button></main></div>;
  const member = profile!;
  const ownBuilds = (allBuilds || []).filter((b) => b.creatorUsername === member.username);
  const patchUpdate = (build: Build, data: BuildUpdate) => updateBuild.mutate({ id:build.id, data }, { onSuccess:() => { queryClient.invalidateQueries({ queryKey:getListBuildsQueryKey() }); setEditBuild(null); } });
  return <div className="tw-shell"><Header/><main className="gallery-page">
    {member.isUsernameSet && member.username ? <>
      <section className="profile-head"><div className="profile-avatar">{member.username[0]?.toUpperCase()}</div><div><span className="eyebrow">Twistory maker</span><h1>@{member.username}</h1><p>{member.displayName || 'A collector of good rooms'} · {ownBuilds.length} shared {ownBuilds.length === 1 ? 'build' : 'builds'}</p></div><button className="button light small" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}${basePath}/profile`); }}>Share your page <LinkIcon size={14}/></button></section>
      <section style={{ paddingTop:24 }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div><span className="eyebrow">Your published stories</span><h2 style={{ margin:'5px 0 18px', fontSize:32, letterSpacing:'-.06em' }}>Things you’ve made</h2></div><Link className="button coral small" href="/">Plan another</Link></div>
        {buildsLoading ? <LoadingCards/> : ownBuilds.length ? <div className="build-grid">{ownBuilds.map((build) => <div key={build.id}><BuildCard build={build}/><div style={{ display:'flex', gap:7, marginTop:-8, marginBottom:12 }}><button className="button light small" onClick={() => setEditBuild(build)}>Edit details</button><button className="button light small" onClick={() => setConfirmDelete(build)}>Delete</button></div></div>)}</div> : <div className="empty-state"><h3>The first story is yours.</h3><p>Publish a photo of your Playroom bookcase and give it a name.</p><Link href="/" className="button coral">Make a build</Link></div>}
      </section>
    </> : <UsernameEditor profile={member} onComplete={() => queryClient.invalidateQueries({ queryKey:getGetMyProfileQueryKey() })}/>}
    {editBuild && <EditBuildDialog build={editBuild} close={() => setEditBuild(null)} onSave={(data) => patchUpdate(editBuild,data)} busy={updateBuild.isPending}/>}
    {confirmDelete && <div className="modal-backdrop"><div className="modal" style={{ width:440 }}><span className="eyebrow">A final check</span><h2>Remove “{confirmDelete.title}”?</h2><p>This removes it from your public maker page and the inspiration gallery.</p><div className="form-actions"><button className="button light" onClick={() => setConfirmDelete(null)}>Keep it</button><button className="button coral" disabled={deleteBuild.isPending} onClick={() => deleteBuild.mutate({ id:confirmDelete.id }, { onSuccess:() => { queryClient.invalidateQueries({ queryKey:getListBuildsQueryKey() }); queryClient.invalidateQueries({ queryKey:getGetBuildQueryKey(confirmDelete.id) }); setConfirmDelete(null); } })}>{deleteBuild.isPending ? 'Removing…' : 'Remove build'}</button></div></div></div>}
  </main></div>;
}
function EditBuildDialog({ build, close, onSave, busy }: { build: Build; close: () => void; onSave: (data: BuildUpdate) => void; busy: boolean }) {
  const [title, setTitle] = useState(build.title);
  const [description, setDescription] = useState(build.description || '');
  const [tags, setTags] = useState(build.tags.join(', '));
  return <div className="modal-backdrop"><form className="modal" onSubmit={(e) => { e.preventDefault(); onSave({ title:title.trim(), description:description.trim() || null, tags:tags.split(',').map((x) => x.trim()).filter(Boolean).slice(0,12) }); }}>
    <div className="modal-head"><div><span className="eyebrow">Keep it current</span><h2>Edit your story</h2></div><button type="button" className="icon-button" onClick={close}><X size={18}/></button></div>
    <div className="form-grid"><div className="field full"><label>Build name</label><input value={title} minLength={2} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></div><div className="field full"><label>About this room</label><textarea value={description} maxLength={1200} onChange={(e) => setDescription(e.target.value)} /></div><div className="field full"><label>Tags, separated by commas</label><input value={tags} onChange={(e) => setTags(e.target.value)} /></div></div>
    <div className="form-actions"><button type="button" className="button light" onClick={close}>Cancel</button><button className="button coral" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button></div>
  </form></div>;
}

function Home() {
  const [inspireOpen, setInspireOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [published, setPublished] = useState<Build[]>([]);
  const [sceneSnapshot, setSceneSnapshot] = useState<Scene>(() => initialScene());
  const buildsQuery = useListBuilds({ sort:'recent', limit:8 });
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const { data:profile } = useGetMyProfile({
    query:{ enabled:!!isSignedIn, queryKey:getGetMyProfileQueryKey() },
  });
  const syncScene = useCallback((scene: Scene) => setSceneSnapshot(scene), []);
  const onPublish = (scene: Scene = sceneSnapshot) => {
    if (!isSignedIn) {
      window.location.assign(`${basePath}/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
      return;
    }
    if (!profile?.isUsernameSet) {
      setLocation('/profile');
      return;
    }
    setSceneSnapshot(scene);
    setPublishOpen(true);
  };
  const onBuildSaved = (build: Build) => {
    setPublished((old) => [build, ...old]);
    queryClient.invalidateQueries({ queryKey:getListBuildsQueryKey() });
    queryClient.invalidateQueries({ queryKey:getGetCommunitySummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey:getGetMyProfileQueryKey() });
  };
  const useBuild = (config: BuildConfiguration) => {
    const floor = FLOORS.find((f) => f.id === config.floorId) || FLOORS[0];
    const hash = `${window.Story.encodeUnit({ size:config.size,color:config.color,dirs:config.shelfDirections })}~${config.wallColor.replace('#','')}~${config.floorId}~${config.floorKind || 'Laminate'}~${(config.customFloorColor || '#B9A48A').replace('#','')}`;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${hash}`);
    window.location.reload();
    void floor;
  };
  return <div className="tw-shell"><Header openPublish={() => onPublish()}/><main className="page-wrap">
    <Configurator onPublish={onPublish} onSceneChange={syncScene}/>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'16px 8px 0', flexWrap:'wrap' }}>
      <span style={{ color:'var(--muted-ink)', fontSize:12 }}>A little room for your next idea.</span>
      <button className="button light small" onClick={() => setInspireOpen(true)}><Sparkles size={14}/>Get inspired</button>
    </div>
    <InspirationDrawer open={inspireOpen} close={() => setInspireOpen(false)} onUse={useBuild} builds={buildsQuery.data || []}/>
    <PublishDialog open={publishOpen} close={() => setPublishOpen(false)} initial={sceneSnapshot} onSaved={onBuildSaved}/>
    {published.length > 0 && <div className="status">“{published[0].title}” is now part of the community gallery.</div>}
  </main></div>;
}

function BrandedSignIn() {
  return <main className="auth-frame"><Link className="brand auth-mark" href="/">twistory<i/></Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></main>;
}
function BrandedSignUp() {
  return <main className="auth-frame"><Link className="brand auth-mark" href="/">twistory<i/></Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></main>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prior = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const remove = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prior.current !== undefined && prior.current !== userId) client.clear();
      prior.current = userId;
    });
    return remove;
  }, [addListener, client]);
  return null;
}
function Router() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={{
    theme:shadcn, cssLayerName:'clerk',
    options:{ logoPlacement:'inside', logoLinkUrl:basePath || '/', logoImageUrl:`${window.location.origin}${basePath}/logo.svg` },
    variables:{ colorPrimary:'#ff6b4a', colorForeground:'#2b1e16', colorMutedForeground:'#94857a', colorDanger:'#b74336', colorBackground:'#fff8ee', colorInput:'#fffdf9', colorInputForeground:'#2b1e16', colorNeutral:'#e5d6c3', fontFamily:'Bricolage Grotesque', borderRadius:'1rem' },
    elements:{
      rootBox:'w-full flex justify-center', cardBox:'!bg-[#fff8ee] rounded-2xl w-[440px] max-w-full overflow-hidden', card:'!shadow-none !border-0 !bg-transparent !rounded-none', footer:'!shadow-none !border-0 !bg-transparent !rounded-none',
      headerTitle:{ color:'#2b1e16', fontWeight:'800' }, headerSubtitle:{ color:'#75665c' }, socialButtonsBlockButtonText:{ color:'#2b1e16', fontWeight:'700' }, formFieldLabel:{ color:'#2b1e16', fontWeight:'700' }, footerActionLink:{ color:'#d94f34', fontWeight:'700' }, footerActionText:{ color:'#75665c' }, dividerText:{ color:'#75665c' }, identityPreviewEditButton:{ color:'#d94f34' }, formFieldSuccessText:{ color:'#347656' }, alertText:{ color:'#2b1e16' },
      logoBox:'rounded-xl', logoImage:'rounded-xl', socialButtonsBlockButton:'!border-[#e8d9c8] !bg-white rounded-xl', formButtonPrimary:'!bg-[#ff6b4a] !text-white rounded-xl', formFieldInput:'!bg-white !text-[#2b1e16] !border-[#e5d6c3] rounded-xl', footerAction:'border-0', dividerLine:'!bg-[#e5d6c3]', alert:'!bg-[#fff1e6] rounded-xl', otpCodeFieldInput:'!bg-white !text-[#2b1e16]', formFieldRow:'gap-2', main:'gap-4',
    },
  }} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn:{ start:{ title:'Welcome back', subtitle:'Come back to your Twistory workshop.' } }, signUp:{ start:{ title:'Make yourself at home', subtitle:'Create an account and share your first room.' } } }}
    routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace:true })}>
    <ClerkQueryClientCacheInvalidator/>
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/inspiration" component={Gallery}/>
      <Route path="/build/:id" component={DetailPage}/>
      <Route path="/profile" component={ProfilePage}/>
      <Route path="/sign-in/*?" component={BrandedSignIn}/>
      <Route path="/sign-up/*?" component={BrandedSignUp}/>
      <Route component={NotFound}/>
    </Switch>
  </ClerkProvider>;
}
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><Router/></WouterRouter></QueryClientProvider>;
}
export default App;
