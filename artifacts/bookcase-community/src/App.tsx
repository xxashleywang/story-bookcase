import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
// Keep the verified prototype geometry, finishing values, and shelf patterns as the model's source of truth.
// @ts-ignore prototype is a browser-global IIFE intentionally bundled as-is.
import '../reference/story-core.js';
// @ts-ignore prototype renderer is a browser-global IIFE intentionally bundled as-is.
import '../reference/story-v2.js';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  AlertTriangle, ArrowLeft, Bookmark, Camera, ChevronDown, Dices, Heart, ImageOff, Images, Link as LinkIcon,
  LoaderCircle, PencilLine, Plus, RefreshCw, RotateCcw, Ruler, Search, Settings, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import type { Build, BuildConfiguration, BuildPage, BuildUpdate, Profile } from '@workspace/api-client-react';
import { AccountMenu, ConfirmDialog, FavouriteButton, LogoutButton, refreshAccountViews } from '@/components/account-ui';
import { cleanupMessage, privateListKey } from '@/lib/account';
import { CursorAccountProvider, useCursorAccount } from '@/lib/cursor-account';
import { clerkConfigured } from '@/lib/local-clerk';
import { EditBuildDialog, PublishDialog } from '@/components/share-dialog';
import { blueprintHref, readReferenceId, referenceHref, safePhotos, withoutParam } from '@/lib/community';
import { completeInspirationHandoff, inspirationHref, trackEvent } from '@/lib/analytics';
import type { InspirationHandoff } from '@/lib/analytics';
import {
  getCheckUsernameAvailabilityQueryKey, getGetBuildQueryKey, getGetCommunitySummaryQueryKey,
  getGetMyProfileQueryKey, getListBuildsQueryKey, getListMyBuildsQueryKey, getListMyFavouritesQueryKey,
  useCheckUsernameAvailability, useDeleteBuild, useGetBuild, useGetCommunitySummary, useGetMyProfile, useListBuilds,
  useListMyBuilds, useListMyFavourites, useRetryPhotoCleanup, useUpdateBuild, useUpdateMyProfile,
} from '@workspace/api-client-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import { ColorPicker } from '@/components/color-picker';
import { BuildCelebration } from '@/components/build-celebration';
import { SHELF_HINT_SIZE, ShelfKeyHint } from '@/components/shelf-key-hint';
import { placeShelfHint } from '@/lib/shelf-hint-placement';
import { shouldCelebrateBuildCompletion } from '@/lib/build-celebration';
import { moveShelfSelection, rotateShelfDirection, shelfActionFromKey } from '@/lib/shelf-keyboard';
import { advanceBuildProgress, buildSteps, normalizeBuildProgress, rewindBuildProgress } from '@/lib/build-steps';
import { roomDesignChanged } from '@/lib/room-design';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

declare global {
  interface Window {
    Story: any;
    Story3D: any;
  }
}

const LAST_SCENE_KEY = 'twistory:last-scene';
const clerkPubKey = clerkConfigured
  ? publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  : '';
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
type AccountUser = {
  id?: string | null;
  firstName?: string | null;
  fullName?: string | null;
  username?: string | null;
} | null;
type AuthState = {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: AccountUser;
};
const signedOutAuth: AuthState = { isSignedIn: false, isLoaded: true, user: null };
const AuthContext = createContext<AuthState>(signedOutAuth);
function useAuth() {
  return useContext(AuthContext);
}
function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, user } = useUser();
  return <AuthContext.Provider value={{ isSignedIn: !!isSignedIn, isLoaded, user: user ?? null }}>{children}</AuthContext.Provider>;
}
function BrandWordmark() {
  return <>
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="#ff6b4a">
        <rect x="30" y="6" width="12" height="24" rx="6" />
        <rect x="34" y="30" width="24" height="12" rx="6" />
        <rect x="22" y="34" width="12" height="24" rx="6" />
        <rect x="6" y="22" width="24" height="12" rx="6" />
      </g>
      <circle cx="32" cy="32" r="7" fill="#2b1e16" />
      <circle cx="32" cy="32" r="2.6" fill="#ffd66b" />
    </svg>
    <span>ImagineM<span className="macron">o</span>de</span>
  </>;
}
function LocalAuthDisabled() {
  return <main className="auth-frame"><Link className="brand auth-mark" href="/"><BrandWordmark/></Link><p>Sign-in is not configured for this local preview. The planner still works.</p><Link className="button coral" href="/">Back to the planner</Link></main>;
}
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
const VIEWS = [['Front', 0, -10], ['Angled', -32, -10], ['Side', -90, -10], ['Top', -20, -62]] as const;
const DEFAULT_VIEW_INDEX = 0;
const directions: Record<string, { label: string; rotation: number }> = {
  F: { label: 'Front', rotation: 0 }, L: { label: 'Left', rotation: 90 },
  B: { label: 'Back', rotation: 180 }, R: { label: 'Right', rotation: -90 },
};

function createDefaultScene(S: any) {
  return {
    model: S.createState('tall', '#E2B062', S.PRESETS.find((p: any) => p.id === 'pairs').make(11)),
    wall: '#F6F4F0',
    floor: FLOORS[0],
    floorKind: FLOORS[0].kind,
    customFloorColor: '#B9A48A',
  };
}

function initialScene() {
  const S = window.Story;
  let source = window.location.hash.slice(1);
  if (!source) { try { source = window.localStorage.getItem(LAST_SCENE_KEY) || ''; } catch { source = ''; } }
  let parsed = null;
  try { parsed = source.split('~')[0] ? S.decodeUnit(source.split('~')[0]) : null; } catch { parsed = null; }
  const extras = parsed ? source.split('~') : [];
  const savedFloor = FLOORS.find((f) => f.id === extras[2]);
  const customHex = extras[4] ? `#${extras[4]}` : '#B9A48A';
  const floorKind = extras[3] === 'Carpet' ? 'Carpet' : (savedFloor?.kind || 'Laminate');
  const selectedFloor = extras[2] === 'custom'
    ? { id:'custom', name:'Custom', kind:floorKind, bg:(floorKind === 'Carpet' ? carpet : plank)(customHex, S.shade(customHex, -.08)) }
    : savedFloor;
  const defaults = createDefaultScene(S);
  return {
    model: parsed || defaults.model,
    wall: extras[1] ? `#${extras[1]}` : defaults.wall,
    floor: selectedFloor || defaults.floor,
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
  try { window.localStorage.setItem(LAST_SCENE_KEY, config); } catch { /* storage may be unavailable */ }
}
function sceneBlueprint(scene: Scene): BuildConfiguration {
  return {
    size:scene.model.size, color:scene.model.color, shelfDirections:[...scene.model.dirs],
    wallColor:scene.wall, floorId:scene.floor.id, floorKind:scene.floorKind as BuildConfiguration['floorKind'],
    customFloorColor:scene.floor.id === 'custom' ? scene.customFloorColor : null,
  };
}
const encodeUnit = (m: { size:string; color:string; dirs:string[] }) => window.Story.encodeUnit(m);
/** Single handoff for attached blueprints: a full load so the configurator re-initialises from the hash. */
function openBlueprint(config: BuildConfiguration, handoff?: InspirationHandoff) {
  const alreadyHome = stripBase(window.location.pathname) === '/';
  const href = blueprintHref(basePath, config, encodeUnit);
  const target = handoff ? inspirationHref(href, handoff) : href;
  const sameDocument = alreadyHome && new URL(target, window.location.origin).search === window.location.search;
  window.location.assign(target);
  // On the homepage this is only a hash change; remount to consume the new blueprint.
  if (sameDocument) window.location.reload();
}
const photoUrl = (path: string) => `/api/storage${path}`;
const SHARE_INTENT_KEY = 'twistory:share-intent';
function rememberShareIntent(path: string) { try { window.sessionStorage.setItem(SHARE_INTENT_KEY, path); } catch { /* ignore */ } }
function takeShareIntent() { try { const v = window.sessionStorage.getItem(SHARE_INTENT_KEY); window.sessionStorage.removeItem(SHARE_INTENT_KEY); return v; } catch { return null; } }
/** Route a share request through sign-in and username setup, preserving where it started. */
function useShareGate(mode: 'photo' | 'blueprint') {
  const { isSignedIn, isLoaded } = useAuth();
  const cursor = useCursorAccount();
  const [, setLocation] = useLocation();
  const { data:profile } = useGetMyProfile({ query:{ enabled:!!isSignedIn, queryKey:getGetMyProfileQueryKey() } });
  const ready = !!isSignedIn && !!profile?.isUsernameSet;
  useEffect(() => {
    if (isSignedIn && profile && !profile.isUsernameSet && new URLSearchParams(window.location.search).has('share')) {
      rememberShareIntent(`${stripBase(window.location.pathname)}${window.location.search}${window.location.hash}`);
      setLocation('/profile');
    }
  }, [isSignedIn, profile, setLocation]);
  const request = (open: () => void, intent: string = mode) => {
    if (!isLoaded) return;
    const here = `${stripBase(window.location.pathname)}${withoutParam(window.location.search, 'share')}`;
    const back = `${here}${here.includes('?') ? '&' : '?'}share=${intent}`;
    if (!isSignedIn) {
      // A person who logged out in the app still has a Cursor session. Bring
      // the account back on this page and let the share continue.
      if (cursor.signedOutInApp) {
        rememberShareIntent(`${back}${window.location.hash}`);
        window.history.replaceState(null, '', `${window.location.pathname}${back.includes('?') ? back.slice(back.indexOf('?')) : ''}${window.location.hash}`);
        cursor.resumeSession();
        return;
      }
      // Keep a local copy too: sign-in can finish on the profile page rather
      // than the redirect destination, especially during first-user setup.
      rememberShareIntent(`${back}${window.location.hash}`);
      window.location.assign(`${basePath}/sign-in?redirect_url=${encodeURIComponent(`${window.location.origin}${basePath}${back}${window.location.hash}`)}`);
      return;
    }
    if (!profile?.isUsernameSet) { rememberShareIntent(`${back}${window.location.hash}`); setLocation('/profile'); return; }
    takeShareIntent();
    open();
  };
  return { ready, request };
}

function roomColor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function iconPlan(dir: string, size = 23) {
  const direction = directions[dir] || directions.F;
  return <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`${direction.label} facing shelf, viewed from above`}>
    <g transform={`rotate(${direction.rotation} 16 16)`}>
      <rect x="7" y="18" width="18" height="11" rx="2" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 26.5h18" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </g>
    <circle cx="16" cy="16" r="2.5" fill="currentColor" />
  </svg>;
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
function Header() {
  const { isSignedIn, isLoaded } = useAuth();
  const cursor = useCursorAccount();
  return <header className="topbar">
    <Link className="brand" href="/"><BrandWordmark/></Link>
    <span className="tagline">Design first. Build once.</span>
    <nav className="top-actions">
      <Link className="button light small" href="/inspiration">Gallery</Link>
      {!isLoaded ? null : isSignedIn ? <AccountMenu/> : cursor.signedOutInApp
        ? <button type="button" className="button small" onClick={cursor.resumeSession}>Log in</button>
        : <Link className="button small" href="/sign-in">Log in</Link>}
    </nav>
  </header>;
}


// Blank stage, headings, and empty panel space dismiss. Shelf faces, the rail,
// the selector (including its portaled menu), the editor, and other controls do not.
const SHELF_KEEP_SELECTOR = [
  '.shelf-editor',
  '.shelf-select',
  '.shelf-select-menu',
  '.build-rail-tick',
  '.rules-pop',
  '.views',
  '.shelf-key-hint',
  '.tw-picker',
  '[data-radix-popper-content-wrapper]',
  '[data-i]',
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="menuitem"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(', ');

function pointerElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function keepsShelfSelection(target: Element): boolean {
  return target.closest(SHELF_KEEP_SELECTOR) !== null;
}

function keepsRulesOpen(target: Element, pop: HTMLElement | null, button: HTMLElement | null): boolean {
  return pop?.contains(target) === true
    || button?.contains(target) === true
    || target.closest('.rules-pop, .random-rules') !== null;
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
  const [viewIndex, setViewIndex] = useState(DEFAULT_VIEW_INDEX);
  const [showNumbers, setShowNumbers] = useState(false);
  const [completed, setCompleted] = useState<boolean[]>(() => {
    try {
      const config = initialScene().model;
      return normalizeBuildProgress(window.Story3D.getProgress(config));
    } catch { return []; }
  });

  const stageRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rulesPopRef = useRef<HTMLDivElement>(null);
  const rulesButtonRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<ViewHandle | null>(null);
  const selectRef = useRef<(index: number) => void>(() => undefined);
  const [showShelfKeyHint, setShowShelfKeyHint] = useState(true);
  const [railFrame, setRailFrame] = useState({ width: 0, height: 0 });
  const [celebrationBurstId, setCelebrationBurstId] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [completionAnnouncement, setCompletionAnnouncement] = useState('');
  const celebrationTimeoutRef = useRef<number | null>(null);
  selectRef.current = (i: number) => {
    setSelected(i);
    hostRef.current?.focus({ preventScroll:true });
  };

  const S = window.Story;
  const defaults = useMemo(() => createDefaultScene(S), [S]);
  const activeColor = COLORS.find((c) => c.hex.toLowerCase() === scene.model.color.toLowerCase());
  const floorIsCustom = scene.floor.id === 'custom';
  const wallIsCustom = !WALLS.some(([, hex]) => hex.toLowerCase() === scene.wall.toLowerCase());
  const progress = useMemo(
    () => normalizeBuildProgress(completed.length === scene.model.dirs.length ? completed : Array.from({ length: scene.model.dirs.length }, (_, i) => !!completed[i])),
    [completed, scene.model.dirs.length],
  );
  const steps = useMemo(() => buildSteps(progress), [progress]);
  const nextShelf = steps.nextShelfIndex;
  const fullyBuilt = steps.isComplete;
  const previousDoneRef = useRef(steps.doneSteps);

  const railLayout = useMemo(() => {
    if (!railFrame.width || !railFrame.height) return null;
    const k = (railFrame.height * 0.66) / S.SIZES.tall.height;
    const floorY = railFrame.height * 0.86;
    const y = (h: number) => floorY - h * k * 0.985;
    const hs = S.shelfHeights(scene.model.size);
    const top = steps.doneShelves ? y(hs[steps.doneShelves - 1]) : floorY;
    return {
      hs,
      top,
      left: railFrame.width / 2 + 22 * k,
      y,
      floorY,
    };
  }, [S, railFrame.height, railFrame.width, scene.model.size, steps.doneShelves]);
  const shelfHintStyle = useMemo<CSSProperties | undefined>(() => {
    if (selected < 0 || !railLayout || railFrame.height <= 0 || selected >= railLayout.hs.length) return undefined;
    const hintWidth = SHELF_HINT_SIZE.width;
    const hintHeight = SHELF_HINT_SIZE.height;
    const placement = placeShelfHint({
      stageWidth: railFrame.width,
      stageHeight: railFrame.height,
      postX: railFrame.width / 2,
      shelfYs: railLayout.hs.map((height: number) => railLayout.y(height)),
      shelfDirs: scene.model.dirs,
      selected,
      hintWidth,
      hintHeight,
      // Right-side only, with 1&2 / 3&4 / 5&6 pair slots.
      preferRight: true,
      allowSideSwitch: false,
    });
    // The card sits in a shared pair slot, so the pointer slides to whichever shelf of the pair is selected.
    const shelfY = railLayout.y(railLayout.hs[selected]);
    const tail = Math.max(22, Math.min(hintHeight - 22, shelfY - (placement.top - hintHeight / 2)));
    return {
      '--shelf-hint-top': `${(placement.top / railFrame.height) * 100}%`,
      '--shelf-hint-left': `${placement.left}px`,
      '--shelf-hint-tail': `${tail}px`,
    } as CSSProperties;
  }, [railFrame.height, railFrame.width, railLayout, scene.model.dirs, selected]);

  const roomChanged = roomDesignChanged(
    { wall: scene.wall, floorId: scene.floor.id },
    { wall: defaults.wall, floorId: defaults.floor.id },
  );

  const numbersVisible = tab === 'build' || showNumbers;
  const showRail = viewIndex !== 3 && numbersVisible;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);
  useEffect(() => () => {
    if (celebrationTimeoutRef.current != null) window.clearTimeout(celebrationTimeoutRef.current);
  }, []);
  useEffect(() => {
    const previousDone = previousDoneRef.current;
    const shouldCelebrate = shouldCelebrateBuildCompletion({
      previousDone,
      currentDone: steps.doneSteps,
      totalShelves: steps.totalSteps,
      tab,
    });
    previousDoneRef.current = steps.doneSteps;
    if (!shouldCelebrate) {
      if (!fullyBuilt) {
        setCompletionAnnouncement('');
        if (isCelebrating) setIsCelebrating(false);
      }
      return;
    }
    setCompletionAnnouncement('Bookcase complete.');
    if (reduceMotion) return;
    setCelebrationBurstId((value) => value + 1);
    setIsCelebrating(true);
    if (celebrationTimeoutRef.current != null) window.clearTimeout(celebrationTimeoutRef.current);
    celebrationTimeoutRef.current = window.setTimeout(() => {
      setIsCelebrating(false);
      celebrationTimeoutRef.current = null;
    }, 4400);
  }, [fullyBuilt, isCelebrating, reduceMotion, steps.doneSteps, steps.totalSteps, tab]);
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    viewRef.current = window.Story3D.mount(hostRef.current, {
      state: scene.model, fit: .66, floor: .86, accent: '#FF6B4A', turntable: false,
      yaw: VIEWS[DEFAULT_VIEW_INDEX][1], tilt: VIEWS[DEFAULT_VIEW_INDEX][2],
      selectable: true,
      onSelect: (i: number) => selectRef.current(i),
    });
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

  useEffect(() => {
    hashFor(scene);
    viewRef.current?.update(scene.model, {
      selected: tab === 'build' ? -1 : selected,
      selectable: tab === 'style',
      build: tab === 'build' ? { installed: progress, style: 'wire', next: nextShelf } : null,
    });
  }, [scene, selected, tab, progress, nextShelf]);

  useEffect(() => onSceneChange(scene), [scene, onSceneChange]);

  const progressConfigKey = useRef(S.encodeUnit(scene.model));
  useEffect(() => {
    const key = S.encodeUnit(scene.model);
    if (key !== progressConfigKey.current) {
      progressConfigKey.current = key;
      setCompleted(normalizeBuildProgress(window.Story3D.getProgress(scene.model)));
      return;
    }
    if (completed.length !== progress.length || completed.some((value, i) => value !== progress[i])) {
      setCompleted(progress);
      return;
    }
    window.Story3D.setProgress(scene.model, progress);
  }, [S, completed, progress, scene.model]);

  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const observe = () => setRailFrame({ width: el.clientWidth, height: el.clientHeight });
    observe();
    const ro = new ResizeObserver(observe);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!rulesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setRulesOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rulesOpen]);

  useEffect(() => {
    if (selected < 0 && !rulesOpen) return;
    // The model captures the pointer, so click/pointerup are retargeted to the
    // host. Decide from the pointerdown element. A drag over 4px is an orbit,
    // matching the shelf-select slop in story-v2, and does not dismiss.
    let origin: { x: number; y: number; el: Element } | null = null;
    let dragged = false;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const el = pointerElement(event.target);
      if (!el) return;
      origin = { x: event.clientX, y: event.clientY, el };
      dragged = false;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!origin) return;
      dragged = Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y) > 4;
    };
    const onPointerCancel = () => {
      origin = null;
      dragged = false;
    };
    const onClick = () => {
      const start = origin;
      const moved = dragged;
      origin = null;
      dragged = false;
      if (!start || moved) return;
      if (tab === 'style' && selected >= 0 && !keepsShelfSelection(start.el)) {
        setSelected(-1);
      }
      if (rulesOpen && !keepsRulesOpen(start.el, rulesPopRef.current, rulesButtonRef.current)) {
        setRulesOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('click', onClick, true);
    };
  }, [rulesOpen, selected, tab]);

  useEffect(() => {
    const onArrow = (event: KeyboardEvent) => {
      const action = shelfActionFromKey(event, {
        selected, count:scene.model.dirs.length, designing:tab === 'style', rolling,
      });
      if (!action) return;
      event.preventDefault();
      if (action.type === 'select') {
        setSelected((old) => moveShelfSelection(old, scene.model.dirs.length, action.step));
        return;
      }
      setScene((old) => {
        const dir = rotateShelfDirection(old.model.dirs[selected], action.step);
        return { ...old, model:{ ...old.model, dirs:old.model.dirs.map((d: string, i: number) => i === selected ? dir : d) } };
      });
    };
    window.addEventListener('keydown', onArrow);
    return () => window.removeEventListener('keydown', onArrow);
  }, [selected, scene.model.dirs.length, tab, rolling, showShelfKeyHint]);

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
      setRolled(false);
      setRulesOpen(false);
      setNote('');
    }
  };

  const toggleAllowed = (dir: string) => {
    setAllowed((old) => {
      const nextAllowed = new Set(old);
      if (nextAllowed.has(dir) && nextAllowed.size === 1) {
        setNote('Keep at least one direction. Shelves have to face somewhere.');
        return old;
      }
      if (nextAllowed.has(dir)) nextAllowed.delete(dir); else nextAllowed.add(dir);
      setNote(nextAllowed.size === 1 ? `Only ${directions[[...nextAllowed][0]]?.label} left, so every roll is the same.` : '');
      return nextAllowed;
    });
  };

  const roll = () => {
    if (rolling) return;
    const pool = [...allowed];
    const finalDirs = S.randomDirs(scene.model.dirs.length, { allowed: pool, noRepeat, current: scene.model.dirs });
    setRolling(true);
    setRolled(true);
    setRulesOpen(false);
    let tick = 0;
    const animate = () => {
      if (tick++ < 6) {
        updateModel((model) => ({ ...model, dirs: model.dirs.map(() => pool[Math.floor(Math.random() * pool.length)]) }));
        window.setTimeout(animate, 65);
      } else {
        updateModel((model) => ({ ...model, dirs: finalDirs }));
        setRolling(false);
      }
    };
    animate();
  };

  const completeNextShelf = () => {
    const next = advanceBuildProgress(progress);
    if (next.every((value, i) => value === progress[i])) return;
    setCompleted(next);
    window.Story3D.setProgress(scene.model, next);
  };

  const undoLastShelf = () => {
    const next = rewindBuildProgress(progress);
    if (next.every((value, i) => value === progress[i])) return;
    setCompleted(next);
    window.Story3D.setProgress(scene.model, next);
  };

  const setSize = (size: string) => {
    const model = S.resize(scene.model, size);
    const stored = normalizeBuildProgress(window.Story3D.getProgress(model));
    setCompleted(stored);
    setSelected((old) => Math.min(old, model.dirs.length - 1));
    setScene((old) => ({ ...old, model }));
  };

  const resetRoomDesign = () => {
    const next = createDefaultScene(S);
    // Room only. Bookcase size, finish, shelf directions, and every other
    // configurator state stay. hashFor() then saves that bookcase with the default room.
    setScene((old) => ({
      ...old,
      wall: next.wall,
      floor: { ...next.floor },
      floorKind: next.floorKind,
      customFloorColor: next.customFloorColor,
    }));
  };

  const saveShareLink = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); window.alert('Build link copied.'); }
    catch { window.prompt('Copy your build link', url); }
  };

  return <div className="playroom">
    <section ref={stageRef} className={`stage ${roomColor(scene.wall) < .45 ? 'is-dark' : ''}`} style={{ backgroundColor: scene.wall, '--wall': scene.wall, '--floor-background': floorIsCustom ? (scene.floorKind === 'Carpet' ? carpet : plank)(scene.customFloorColor, S.shade(scene.customFloorColor, -.08)) : scene.floor.bg } as CSSProperties}>
      <div className="room-floor" />
      <div id="bookcase-model" ref={hostRef} tabIndex={-1} aria-label="Bookcase model" />
      <div className="scene-copy"><h1>Design your bookcase</h1>
        <p className="scene-sub">Select a shelf to start.</p>
      </div>
      {tab === 'style' && selected >= 0 && showShelfKeyHint && <ShelfKeyHint
        className="stage-shelf-hint"
        style={shelfHintStyle}
        shelf={selected}
        count={scene.model.dirs.length}
        facing={directions[scene.model.dirs[selected]]?.label || 'Front'}
        onDismiss={() => setShowShelfKeyHint(false)}
        onMoveUp={() => setSelected((old) => moveShelfSelection(old, scene.model.dirs.length, 1))}
        onMoveDown={() => setSelected((old) => moveShelfSelection(old, scene.model.dirs.length, -1))}
        onTurnLeft={() => setScene((old) => {
          const dir = rotateShelfDirection(old.model.dirs[selected], -1);
          return { ...old, model:{ ...old.model, dirs:old.model.dirs.map((d: string, i: number) => i === selected ? dir : d) } };
        })}
        onTurnRight={() => setScene((old) => {
          const dir = rotateShelfDirection(old.model.dirs[selected], 1);
          return { ...old, model:{ ...old.model, dirs:old.model.dirs.map((d: string, i: number) => i === selected ? dir : d) } };
        })}
      />}
      {tab === 'build' && isCelebrating && !reduceMotion && <BuildCelebration burstId={celebrationBurstId} />}
      {tab === 'build' && <div className={`scene-stamp${fullyBuilt ? ' is-complete' : ''}${isCelebrating ? ' is-celebrating' : ''}`} aria-label="Assembly progress">
        <svg viewBox="0 0 110 110"><defs><path id="stampCircle" d="M55,55 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs><text fontSize="10" fontWeight="700" letterSpacing="2.5" fill="currentColor"><textPath href="#stampCircle">{fullyBuilt ? 'BUILT IT · BUILT IT · BUILT IT · ' : 'TWIST IT · STACK IT · STYLE IT · '}</textPath></text></svg>
        <b>{fullyBuilt ? <span className="scene-stamp-success" aria-label="Bookcase complete"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 12.5l4.2 4.1L19 7.8" /></svg></span> : `${steps.percent}%`}</b>
      </div>}
      {showRail && railLayout && <div className={`build-rail ${tab === 'build' ? 'is-build' : 'is-style'} ${numbersVisible ? 'numbered' : ''}`} style={{ left:`${railLayout.left}px` }}>
        <i className="build-rail-track" style={{ top:railLayout.y(railLayout.hs[railLayout.hs.length - 1]), height:railLayout.floorY - railLayout.y(railLayout.hs[railLayout.hs.length - 1]) }} />
        <i className="build-rail-fill" style={{ top:railLayout.top, height:railLayout.floorY - railLayout.top }} />
        {railLayout.hs.map((height: number, i: number) => {
          const isDone = progress[i];
          const isNext = tab === 'build' && i === nextShelf;
          const isSelected = tab === 'style' && i === selected;
          return <button type="button" key={i} disabled={tab !== 'style'}
            className={`build-rail-tick ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''} ${isSelected ? 'is-selected' : ''}`}
            style={{ top:railLayout.y(height) }}
            onClick={() => {
              if (tab !== 'style') return;
              setSelected(i);
              hostRef.current?.focus({ preventScroll:true });
            }}>{numbersVisible ? i + 1 : ''}</button>;
        })}
        {tab === 'build' && nextShelf >= 0 && <span className="build-rail-label" style={{ top:railLayout.y(railLayout.hs[nextShelf]) }}>Shelf {nextShelf + 1} <span>faces {directions[scene.model.dirs[nextShelf]]?.label.toLowerCase()}</span></span>}
      </div>}
      <div className="sr-only" role="status" aria-live="polite">{completionAnnouncement}</div>
      <div className="views" role="group" aria-label="Bookcase view"><span className="view-label" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>View</span>{VIEWS.map(([label, yaw, tilt], i) => <button key={label} aria-pressed={viewIndex === i} className={viewIndex === i ? 'active' : ''} onClick={() => { setViewIndex(i); viewRef.current?.animateTo(yaw, tilt); }}>{label}</button>)}</div>
      {tab === 'style' && <button type="button" role="switch" aria-checked={showNumbers} className={`shelf-numbers-toggle ${showNumbers ? 'on' : ''}`} onClick={() => setShowNumbers((old) => !old)}><i className="shelf-numbers-switch" aria-hidden="true" />Shelf numbers</button>}
    </section>
    <section className="control-panel">
      <div className={`tabs ${tab === 'build' ? 'building' : ''}`}><i className="tab-pill" />
        <button className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}>Style it</button>
        <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>Build it</button>
      </div>
      <div className="pane style-pane" hidden={tab !== 'style'}>
        <div className="pane-fixed">
          <section className="section compact"><h2>Bookcase <small>15¾&quot; square footprint</small></h2>
            <div className="bookcase-row">
              <div className="size-options">{Object.values(S.SIZES).map((size: any) => <button key={size.id} aria-pressed={scene.model.size === size.id} className={`size-option ${scene.model.size === size.id ? 'active' : ''}`} onClick={() => setSize(size.id)}><b>{size.label}</b><span>{size.height}&quot; · {size.shelves} shelves</span></button>)}</div>
              <div className="color-dots">{COLORS.map((c) => <button key={c.hex} aria-label={`${c.name} finish`} aria-pressed={scene.model.color.toLowerCase() === c.hex.toLowerCase()} className={`color-dot ${scene.model.color.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}`} style={{ background: c.hex }} onClick={() => updateModel((m) => ({ ...m, color: c.hex }))} />)}
                <ColorPicker title="Custom finish" value={scene.model.color} presets={FINISH_PRESETS} onChange={(hex) => updateModel((m) => ({ ...m, color: hex }))}
                  trigger={<button type="button" aria-label="Custom finish color" className={`color-input ${!activeColor ? 'active' : ''}`} style={!activeColor ? { background: scene.model.color } : undefined} />} />
              </div>
            </div>
          </section>
        </div>
        <div className="pane-scroll">
          <section className="section"><h2>Try a shelf arrangement</h2>
            <div className="pattern-list"><div className="preset-grid" role="group" aria-label="Shelf arrangements">{S.PRESETS.map((preset: any) => <button key={preset.id} aria-pressed={preset.make(scene.model.dirs.length).join('') === scene.model.dirs.join('')} className={`pattern preset-option ${preset.make(scene.model.dirs.length).join('') === scene.model.dirs.join('') ? 'active' : ''}`} onClick={() => choosePattern(preset.id)}>{preset.name}</button>)}</div>
              <span className="random-controls" role="group" aria-label="Randomize shelves"><button className={`pattern random random-dice ${rolling ? 'is-rolling' : ''}`} disabled={rolling} onClick={roll}><Dices size={15}/> Randomize</button><button ref={rulesButtonRef} type="button" aria-label="Randomize rules" aria-expanded={rulesOpen} className="pattern random random-rules" onClick={() => setRulesOpen(!rulesOpen)}><Settings size={16}/>Rules{4 - allowed.size + Number(noRepeat) ? <small>{4 - allowed.size + Number(noRepeat)}</small> : null}</button></span>
              {rulesOpen && <div ref={rulesPopRef} className="rules-pop"><h3>Randomize rules</h3><p className="rules-hint">Tap X to stop shelves facing that way.</p><div className="allowed-grid">{Object.entries(directions).map(([dir, detail]) => <button key={dir} aria-pressed={allowed.has(dir)} className={!allowed.has(dir) ? 'off' : ''} onClick={() => toggleAllowed(dir)}><span className="rule-toggle">{allowed.has(dir) ? <X size={11}/> : <Plus size={11}/>}</span>{iconPlan(dir, 24)}<span className="rule-label">{detail.label}</span><small>{allowed.has(dir) ? 'On' : 'Off'}</small></button>)}</div><button className={`toggle-row ${noRepeat ? 'on' : ''}`} aria-pressed={noRepeat} onClick={() => setNoRepeat(!noRepeat)}><i className="toggle" />No two neighbours alike</button><p className="note">{note}</p></div>}
            </div>
          </section>
          <details className="section room-preview">
            <summary onClick={(event) => {
              if (event.target instanceof Element && event.target.closest('.room-reset')) event.preventDefault();
            }}><h2>
              <span className="room-design-label">Room design
                {roomChanged && <button type="button" className="button light small room-reset" onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resetRoomDesign();
                }}><RotateCcw size={14} aria-hidden="true" />Reset to default</button>}
              </span>
              <span className="room-design-status">
                <small>{WALLS.find((w) => w[1] === scene.wall)?.[0] || 'Custom'} wall · {floorIsCustom ? 'Custom' : scene.floor.name}</small>
                <ChevronDown className="room-design-chevron" size={16} aria-hidden="true" />
              </span>
            </h2></summary>
            <h3>Wall <small>{WALLS.find((w) => w[1] === scene.wall)?.[0] || `Custom ${scene.wall.toUpperCase()}`}</small></h3>
            <div className="swatches">{WALLS.map(([name, hex]) => <button key={hex} className={`swatch ${scene.wall === hex ? 'active' : ''}`} onClick={() => setWall(hex)}><i style={{ background: hex }} />{name}</button>)}
              <ColorPicker title="Custom wall" value={scene.wall} presets={WALL_PRESETS} onChange={setWall}
                trigger={<button type="button" className={`swatch ${wallIsCustom ? 'active' : ''}`}><i style={{ background: wallIsCustom ? scene.wall : RAINBOW }} />Make your own</button>} />
            </div>
            <h3>Floor <small>{floorIsCustom ? 'Custom' : scene.floor.name} · {kindLabel(scene.floorKind)}</small></h3>
            <div className="floor-grid">{FLOOR_CHOICES.map((f) => <button key={f.id} className={`floor-swatch ${scene.floor.id === f.id ? 'active' : ''}`} onClick={() => setFloor(f)}><i style={{ background: f.bg }} />{f.name}<small>{kindLabel(f.kind)}</small></button>)}
              <ColorPicker title="Custom floor" value={scene.customFloorColor} presets={FLOOR_PRESETS}
                onOpen={() => { if (!floorIsCustom) setFloor(CUSTOM_FLOOR, scene.floorKind === 'Carpet' ? 'Carpet' : 'Laminate', scene.customFloorColor); }}
                onChange={(hex) => setFloor(CUSTOM_FLOOR, scene.floorKind === 'Carpet' ? 'Carpet' : 'Laminate', hex)}
                trigger={<button type="button" className={`floor-swatch ${floorIsCustom ? 'active' : ''}`}><i style={{ background: floorIsCustom ? (scene.floorKind === 'Carpet' ? carpet : plank)(scene.customFloorColor, S.shade(scene.customFloorColor, -.08)) : RAINBOW }} />Make your own<small>{floorIsCustom ? kindLabel(scene.floorKind) : 'Any color'}</small></button>}>
                <div className="tw-picker-texture"><span>Texture</span><div className="segment">{(['Laminate', 'Carpet'] as const).map((kind) => <button type="button" key={kind} className={scene.floorKind === kind ? 'active' : ''} onClick={() => setFloor(CUSTOM_FLOOR, kind, scene.customFloorColor)}>{kindLabel(kind)}</button>)}</div></div>
              </ColorPicker>
            </div>
          </details>
          <section className="section cta-row">
            <button className="link-copy-button" onClick={saveShareLink} aria-label="Copy link to this design" title="Copy link to this design"><LinkIcon size={14}/></button>
            <button className="button coral small" onClick={() => onPublish(scene)}><Sparkles size={14}/>Share your bookcase</button>
          </section>
        </div>
      </div>
      <div className="pane" hidden={tab !== 'build'}>
        <section className="section"><div className={`build-meter${fullyBuilt ? ' is-complete' : ''}${isCelebrating ? ' is-celebrating' : ''}`}><div className="build-meter-top"><b>{steps.percent}%</b><span>{steps.doneSteps} of {steps.totalSteps} steps</span></div><div className="progress-track"><i style={{ width:`${Math.max(4, steps.percent)}%` }} /></div><p>{fullyBuilt ? 'Every shelf is on. Anchor it to the wall with the strap in the box.' : `Base and post are counted. Next: shelf ${nextShelf + 1}, facing ${directions[scene.model.dirs[nextShelf]]?.label.toLowerCase()}.`}</p></div></section>
        <section className="section"><h2>Next step <small>follow along as you assemble</small></h2><p className="build-guide-copy">Follow these steps as you assemble your bookcase.</p>{fullyBuilt ? <div className="build-step-card done"><h3>Build complete</h3><p>Everything is in place. Use Print sheet if you want a checklist copy.</p></div> : (() => {
          const shelf = S.buildList(scene.model)[nextShelf];
          const detail = nextShelf === 0 ? 'Lowest shelf' : nextShelf === progress.length - 1 ? 'Top shelf' : `${shelf.height.toFixed(1)}″ up`;
          return <div className="build-step-card"><div className="build-step-head">{iconPlan(shelf.dir, 24)}<div><h3>Shelf {nextShelf + 1}</h3><p><b>Faces {shelf.label.toLowerCase()}</b> · {detail}</p></div></div><div className="build-step-actions"><button className="button light small" onClick={undoLastShelf} disabled={steps.doneShelves <= 0}>Back</button><button className="button small" onClick={completeNextShelf}>Done, next</button></div></div>;
        })()}</section>
        <section className="section build-tools"><button className="button light small" onClick={() => { const reset = Array(progress.length).fill(false); setCompleted(reset); window.Story3D.setProgress(scene.model, []); }}>Start over</button><button className="button light small" onClick={() => S.printBuildSheet(scene.model)}>Print sheet</button><button className="button coral small" onClick={() => onPublish(scene)}><Sparkles size={14}/>Share your bookcase</button></section>
      </div>
    </section>
  </div>;
}

function BuildVisual({ build, className, alt }: { build: Build; className: string; alt?: string }) {
  const photo = safePhotos(build)[0];
  if (photo) return <img className={className} src={photoUrl(photo)} alt={alt || `${build.title}, shared by @${build.creatorUsername}`} loading="lazy" />;
  const config = build.configuration;
  if (config) return <div className={`${className} placeholder`} style={{ backgroundColor:config.wallColor }}><BookcaseSketch color={config.color} dirs={config.shelfDirections} tall={config.size === 'tall'} /></div>;
  return <div className={`${className} placeholder empty-photo`} aria-label="No photo available"><ImageOff size={22}/></div>;
}

function BuildCard({ build, children }: { build: Build; children?: ReactNode }) {
  const count = safePhotos(build).length;
  return <article className="build-card-shell">
    <Link href={`/build/${build.id}`} className="build-card" data-testid={`card-build-${build.id}`}>
      <div className="build-card-media"><BuildVisual build={build} className="build-image"/>
        {count > 1 && <span className="photo-count-badge"><Images size={12}/>{count}</span>}</div>
      <div className="build-info"><div className="build-info-head"><h3>{build.title}</h3><span className="heart-count" aria-label={`${build.likesCount} likes`}><Heart size={12}/>{build.likesCount}</span></div>
        <p>by @{build.creatorUsername}</p>
        {build.description && <p className="build-desc">{build.description}</p>}
        {build.configuration && <span className="blueprint-chip"><Ruler size={11}/>Blueprint attached</span>}
      </div>
    </Link>
    <FavouriteButton build={build}/>
    {children}
  </article>;
}
function LoadingCards() { return <div className="loading-grid" aria-label="Loading community bookcases">{[0,1,2,3,4,5].map((i) => <div className="skeleton" key={i}/>)}</div>; }
function Gallery() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [shareOpen, setShareOpen] = useState(false);
  const gate = useShareGate('photo');
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const params = useMemo(() => ({ q:search.trim() || undefined, sort, limit:40 }), [search, sort]);
  const { data:builds, isLoading, isError, refetch } = useListBuilds(params);
  const { data:summary } = useGetCommunitySummary();
  useEffect(() => {
    if (!gate.ready || !new URLSearchParams(window.location.search).has('share')) return;
    takeShareIntent();
    window.history.replaceState(null, '', `${window.location.pathname}${withoutParam(window.location.search, 'share')}`);
    setShareOpen(true);
  }, [gate.ready]);
  const openShare = () => gate.request(() => setShareOpen(true));
  return <div className="tw-shell"><Header/><main className="gallery-page">
    <section className="gallery-hero"><div><span className="eyebrow">ImagineMōde gallery</span><h1>Shelfies from the community.</h1></div><div><p>{summary ? `${summary.totalBuilds} bookcases from ${summary.totalBuilders} people.` : 'Story bookcases styled by the community.'} Some come with a blueprint you can open and make your own.</p><button className="button coral small" onClick={openShare} data-testid="button-share-room"><Camera size={14}/>Share your bookcase</button></div></section>
    <div className="gallery-tools"><label className="search-box"><Search size={17}/><input aria-label="Search bookcases" data-testid="input-search" placeholder="Search a bookcase, maker, or detail…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <Select value={sort} onValueChange={(value) => setSort(value as 'recent' | 'popular')}>
        <SelectTrigger aria-label="Sort bookcases" data-testid="select-sort" className="sort-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="sort-select-menu" position="popper" sideOffset={6} collisionPadding={12}>
          <SelectItem className="shelf-select-option" value="recent">Newest</SelectItem>
          <SelectItem className="shelf-select-option" value="popular">Most loved</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {isLoading ? <LoadingCards/> : isError ? <div className="empty-state"><h2>We couldn't load the gallery.</h2><p>Your inspiration is still here; try once more.</p><button className="button" onClick={() => refetch()}>Try again</button></div> : builds?.length ? <div className="build-grid">{builds.map((build: Build) => <BuildCard key={build.id} build={build}/>)}</div> :
      <div className="empty-state"><Camera size={23}/><h2>No bookcases in this corner yet.</h2><p>Try another search, or be the first to share one.</p><button className="button coral" onClick={openShare}>Share your bookcase</button></div>}
    {shareOpen && <PublishDialog source="gallery" close={() => setShareOpen(false)} blueprint={null} attachByDefault={false} onSaved={(build) => {
      client.invalidateQueries({ queryKey:getListBuildsQueryKey() }); client.invalidateQueries({ queryKey:getGetCommunitySummaryQueryKey() }); setLocation(`/build/${build.id}`);
    }}/>}
  </main></div>;
}

function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const buildId = Number(id);
  const [active, setActive] = useState(0);
  const { data:build, isLoading, isError, refetch } = useGetBuild(buildId, { query:{ enabled:Number.isFinite(buildId) && buildId > 0, queryKey:getGetBuildQueryKey(buildId) } });
  if (isLoading) return <div className="tw-shell"><Header/><main className="gallery-page"><div className="skeleton"/></main></div>;
  if (isError || !build) return <div className="tw-shell"><Header/><main className="gallery-page empty-state"><h1>That bookcase post isn't here.</h1><p>It may have been removed by its maker.</p><button className="button" onClick={() => refetch()}>Try again</button> <Link href="/inspiration" className="button light">Back to the gallery</Link></main></div>;
  const photos = safePhotos(build);
  const current = photos[Math.min(active, photos.length - 1)];
  const config = build.configuration;
  return <div className="tw-shell"><Header/><main className="gallery-page">
    <Link href="/inspiration" className="button light small"><ArrowLeft size={15}/>Back to the gallery</Link>
    <div className="detail-layout">
      <div>{current ? <img className="detail-photo" src={photoUrl(current)} alt={`${build.title}, photo ${active + 1} of ${photos.length}`} data-testid="img-detail-photo"/> : <BuildVisual build={build} className="detail-photo"/>}
        {photos.length > 1 && <div className="detail-thumbs" role="group" aria-label="Choose a photo">{photos.map((p, i) => <button key={`${p}-${i}`} className={i === active ? 'active' : ''} aria-pressed={i === active} aria-label={`Show photo ${i + 1} of ${photos.length}`} data-testid={`button-photo-${i}`} onClick={() => setActive(i)}><img src={photoUrl(p)} alt="" loading="lazy"/></button>)}</div>}</div>
      <section className="detail-copy"><span className="eyebrow">A community bookcase</span><h1>{build.title}</h1><p>By @{build.creatorUsername} · {new Date(build.createdAt).toLocaleDateString(undefined,{ year:'numeric',month:'long',day:'numeric' })} · <Heart size={12} style={{ verticalAlign:'-1px' }}/> {build.likesCount}</p>
        <div className="detail-actions"><FavouriteButton build={build} variant="detail"/>
          {build.isOwner && <Link href="/profile" className="button light small"><PencilLine size={14}/>Manage in your profile</Link>}</div>
        {build.description && <p className="detail-description">{build.description}</p>}
        {config ? <div className="detail-config"><span className="eyebrow">Blueprint attached</span><div className="detail-config-row"><div className="detail-config-sketch" style={{ backgroundColor:config.wallColor }}><BookcaseSketch color={config.color} dirs={config.shelfDirections} tall={config.size === 'tall'}/></div><p>{config.size === 'tall' ? 'Tall' : 'Standard'} · {config.shelfDirections.length} shelves · {window.Story.colorName(config.color)} finish</p></div>
          <button className="button coral" onClick={() => openBlueprint(config, 'blueprint_detail')} data-testid="button-use-blueprint"><Sparkles size={16}/>Use this blueprint</button></div>
        : <div className="detail-config"><span className="eyebrow">Photo only</span><p>No blueprint was shared with this post. Keep the photo beside your Playroom while you set up your own arrangement.</p>
          <a className="button coral" href={inspirationHref(referenceHref(basePath, build.id), 'reference_detail')} data-testid="button-build-from-inspiration"><Sparkles size={16}/>Build from this inspiration</a></div>}
      </section>
    </div>
  </main></div>;
}

function UsernameEditor({ profile, onComplete, onCancel }: { profile: Profile; onComplete: () => void; onCancel?: () => void }) {
  const [username, setUsername] = useState(profile.username || '');
  const update = useUpdateMyProfile();
  const queryClient = useQueryClient();
  const validFormat = username.length >= 3 && username.length <= 24 && /^[A-Za-z0-9._-]+$/.test(username) && /[A-Za-z0-9]/.test(username);
  const checkParams = useMemo(() => ({ username:validFormat ? username : 'member-check' }), [username, validFormat]);
  const check = useCheckUsernameAvailability(checkParams, { query:{ enabled:validFormat && username !== profile.username, queryKey:getCheckUsernameAvailabilityQueryKey(checkParams) } });
  const unchanged = username === profile.username;
  const canSave = validFormat && !unchanged && !!check.data?.available && !update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    update.mutate({ data:{ username } }, { onSuccess:() => { void refreshAccountViews(queryClient); onComplete(); } });
  };
  const hint = !validFormat && username ? '3 to 24 characters: letters, numbers, periods, underscores or hyphens.' : unchanged && username ? 'This is your current username.' : check.isLoading ? 'Checking availability...' : check.data?.available ? 'That one is free. It is yours if you want it.' : validFormat ? 'Someone already has that one.' : 'Shown on the bookcases you share. You can change it later.';
  return <form className="username-panel" onSubmit={submit} aria-labelledby="username-panel-title">
    <div><span className="eyebrow">Your maker mark</span><h2 id="username-panel-title">{profile.isUsernameSet ? 'Change your username' : 'Pick a username'}</h2>
      <p>{profile.isUsernameSet ? 'Your shared bookcases update to the new name everywhere.' : 'You need one to share bookcases. Saving favourites works without it.'}</p></div>
    <div className="username-row"><span className="at" aria-hidden="true">@</span>
      <input id="username" aria-label="Public username" aria-describedby="username-hint" data-autofocus value={username} onChange={(e) => setUsername(e.target.value.trim())} maxLength={24} autoComplete="off" placeholder="your.name" data-testid="input-username"/>
      <button className="button coral small" disabled={!canSave} data-testid="button-save-username">{update.isPending ? <><LoaderCircle size={14} className="spin"/>Saving</> : 'Save'}</button>
      {onCancel && <button type="button" className="button light small" onClick={onCancel} disabled={update.isPending}>Cancel</button>}</div>
    <p id="username-hint" className={`status ${(!validFormat && username) || (validFormat && !unchanged && check.data && !check.data.available) ? 'error' : ''}`} aria-live="polite">{hint}</p>
    {update.isError && <p className="status error" role="alert">Could not save that username. Try a different one.</p>}
  </form>;
}

type ListKind = 'uploads' | 'favourites';
function useMyPage(kind: ListKind, cursor: number | undefined, userId: string | null) {
  const params = useMemo(() => cursor === undefined ? undefined : { cursor }, [cursor]);
  const enabled = !!userId;
  const uploads = useListMyBuilds(params, { query:{ enabled:enabled && kind === 'uploads', queryKey:privateListKey(getListMyBuildsQueryKey(params), userId) } });
  const favourites = useListMyFavourites(params, { query:{ enabled:enabled && kind === 'favourites', queryKey:privateListKey(getListMyFavouritesQueryKey(params), userId) } });
  return kind === 'uploads' ? uploads : favourites;
}
function BuildChunk({ kind, userId, cursor, isLast, onMore, renderActions, onPage }: {
  kind: ListKind; userId: string; cursor: number | undefined; isLast: boolean; onMore: (next: number) => void;
  renderActions?: (build: Build) => ReactNode; onPage?: (page: BuildPage) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useMyPage(kind, cursor, userId);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  useEffect(() => { if (data) onPageRef.current?.(data); }, [data]);
  if (isLoading) return <>{[0, 1, 2].map((i) => <div className="skeleton profile-skeleton" key={i} aria-hidden="true"/>)}<span className="sr-only" role="status">Loading</span></>;
  if (isError || !data) return <div className="profile-inline-error" role="alert"><AlertTriangle size={18}/><span>{cursor === undefined ? 'This shelf would not load.' : 'The next few would not load.'}</span><button className="button light small" onClick={() => refetch()}>Try again</button></div>;
  if (cursor === undefined && data.items.length === 0) return <ProfileEmpty kind={kind}/>;
  return <>
    {data.items.map((build: Build) => <BuildCard key={build.id} build={build}>{renderActions?.(build)}</BuildCard>)}
    {isLast && data.nextCursor !== null && <div className="load-more-row"><button className="button light" disabled={isFetching} onClick={() => onMore(data.nextCursor!)} data-testid={`button-load-more-${kind}`}>Show more</button></div>}
  </>;
}
function ProfileEmpty({ kind }: { kind: ListKind }) {
  return kind === 'uploads'
    ? <div className="profile-empty"><span className="profile-empty-icon"><Upload size={22}/></span><h3>Nothing on the wall yet.</h3><p>Share a photo of a corner you love. Attach your blueprint if you want people to borrow it.</p><Link href="/inspiration?share=photo" className="button coral small"><Camera size={14}/>Share your bookcase</Link></div>
    : <div className="profile-empty"><span className="profile-empty-icon"><Bookmark size={22}/></span><h3>No saved bookcases yet.</h3><p>Tap the bookmark on any post in the gallery. It will wait for you here, private to you.</p><Link href="/inspiration" className="button coral small">Browse the gallery</Link></div>;
}
function PagedBuilds({ kind, userId, renderActions, onFirstPage }: { kind: ListKind; userId: string; renderActions?: (build: Build) => ReactNode; onFirstPage?: (page: BuildPage) => void }) {
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  return <div className="profile-grid" id={`panel-${kind}`} role="tabpanel" aria-labelledby={`tab-${kind}`}>
    {cursors.map((cursor, i) => <BuildChunk key={cursor ?? 'first'} kind={kind} userId={userId} cursor={cursor} isLast={i === cursors.length - 1}
      onMore={(next) => setCursors((old) => old.includes(next) ? old : [...old, next])} renderActions={renderActions} onPage={(page) => {
        if (i === 0) onFirstPage?.(page);
        // Removal/save mutations can shift a page boundary. Drop later pages
        // rather than showing overlapping rows from an obsolete cursor.
        setCursors((old) => old.length > i + 1 && old[i + 1] !== page.nextCursor ? old.slice(0, i + 1) : old);
      }}/>)}
  </div>;
}
function CleanupNotice({ pending }: { pending: number }) {
  const retry = useRetryPhotoCleanup();
  const client = useQueryClient();
  const [result, setResult] = useState('');
  if (pending <= 0 && !result) return null;
  const run = async () => {
    setResult('');
    try {
      const out = await retry.mutateAsync();
      await refreshAccountViews(client);
      setResult(out.pending ? `${out.pending} still waiting. Retry cleanup to try again.` : 'All cleared from storage.');
    } catch { setResult('The retry did not reach storage. Try again in a moment.'); }
  };
  return <aside className="cleanup-notice" role="status">
    <AlertTriangle size={18} aria-hidden="true"/>
    <div><b>{pending > 0 ? cleanupMessage(pending) : 'Storage cleanup'}</b>
      <p>They are gone from your posts. Copies already cached by browsers may take a while to expire.{result && <> <strong>{result}</strong></>}</p></div>
    {pending > 0 && <button className="button light small" onClick={run} disabled={retry.isPending} data-testid="button-retry-cleanup">{retry.isPending ? <LoaderCircle size={14} className="spin"/> : <RefreshCw size={14}/>}Retry cleanup</button>}
  </aside>;
}
function ProfilePage() {
  const { isSignedIn, isLoaded, user } = useAuth();
  const userId = isSignedIn ? user?.id ?? null : null;
  const queryClient = useQueryClient();
  const { data:profile, isLoading:profileLoading, isError:profileError, refetch } = useGetMyProfile({ query:{ enabled:!!userId, queryKey:getGetMyProfileQueryKey() } });
  const [, setLocation] = useLocation();
  const updateBuild = useUpdateBuild();
  const deleteBuild = useDeleteBuild();
  const [tab, setTabState] = useState<ListKind>(() => new URLSearchParams(window.location.search).get('tab') === 'favourites' ? 'favourites' : 'uploads');
  const [editingName, setEditingName] = useState(false);
  const [editBuild, setEditBuild] = useState<Build | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Build | null>(null);
  const [pending, setPending] = useState(0);
  const [pendingIntent] = useState(() => { try { return !!window.sessionStorage.getItem(SHARE_INTENT_KEY); } catch { return false; } });
  const tabRefs = useRef<Record<ListKind, HTMLButtonElement | null>>({ uploads:null, favourites:null });
  useEffect(() => {
    if (isSignedIn && profile?.isUsernameSet) {
      const intent = takeShareIntent();
      if (intent) setLocation(intent);
    }
  }, [isSignedIn, profile?.isUsernameSet, setLocation]);
  const setTab = (next: ListKind) => {
    setTabState(next);
    const params = new URLSearchParams(window.location.search);
    if (next === 'favourites') params.set('tab', 'favourites'); else params.delete('tab');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  };
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = tab === 'uploads' ? 'favourites' : 'uploads';
    setTab(next); tabRefs.current[next]?.focus();
  };
  const shell = (body: ReactNode) => <div className="tw-shell"><Header/><main className="gallery-page profile-page">{isSignedIn && (!profile || profileLoading || profileError) && <LogoutButton/>}{body}</main></div>;
  if (!isLoaded || (userId && profileLoading)) return shell(<div className="profile-loading" aria-label="Loading your page"><div className="skeleton profile-head-skeleton"/><div className="profile-grid">{[0, 1, 2].map((i) => <div className="skeleton profile-skeleton" key={i}/>)}</div></div>);
  if (!userId) return shell(<section className="profile-gate"><span className="profile-gate-mark" aria-hidden="true"><Bookmark size={26}/></span><span className="eyebrow">Your own corner</span><h1>Your posts and the ones you saved, together.</h1><p>Sign in to see your uploads and keep a private shelf of bookcases you want to come back to.</p><Link className="button coral" href="/sign-in">Sign in to ImagineMōde</Link></section>);
  if (profileError || !profile) return shell(<section className="profile-gate"><h1>Your page would not open.</h1><p>Your posts are safe. This is a loading problem.</p><button className="button" onClick={() => refetch()}>Try again</button></section>);
  const member = profile;
  const showEditor = editingName || (!member.isUsernameSet && pendingIntent);
  const initial = (member.username || member.displayName || user?.firstName || 'T')[0]!.toUpperCase();
  const patchUpdate = async (build: Build, data: BuildUpdate) => {
    const saved = await updateBuild.mutateAsync({ id:build.id, data });
    queryClient.setQueryData(getGetBuildQueryKey(build.id), saved);
    await refreshAccountViews(queryClient);
    return saved;
  };
  const removeBuild = async (build: Build) => {
    await deleteBuild.mutateAsync({ id:build.id });
    queryClient.removeQueries({ queryKey:getGetBuildQueryKey(build.id) });
    await refreshAccountViews(queryClient);
  };
  return shell(<>
    <section className="profile-hero">
      <div className="profile-avatar" aria-hidden="true">{initial}</div>
      <div className="profile-id">
        <span className="eyebrow">Your page</span>
        <h1>{member.isUsernameSet && member.username ? `@${member.username}` : (member.displayName || user?.firstName || 'Hello there')}</h1>
        <p>{member.isUsernameSet ? (member.displayName || 'Your uploads and saved bookcases live here.') : 'No username yet. You can still save bookcases; pick one when you want to share.'}</p>
        {!showEditor && <button className="text-button" onClick={() => setEditingName(true)} data-testid="button-edit-username"><PencilLine size={13}/>{member.isUsernameSet ? 'Change username' : 'Pick a username'}</button>}
      </div>
      <div className="profile-hero-actions"><Link className="button coral small" href="/inspiration?share=photo"><Camera size={14}/>Share your bookcase</Link><LogoutButton/></div>
    </section>
    {showEditor && <UsernameEditor profile={member} onCancel={() => setEditingName(false)} onComplete={() => { setEditingName(false); void refetch(); const intent = takeShareIntent(); if (intent) setLocation(intent); }}/>}
    <CleanupNotice pending={pending}/>
    <div className="profile-tabs" role="tablist" aria-label="Your posts" onKeyDown={onTabKey}>
      {(['uploads', 'favourites'] as const).map((kind) => <button key={kind} ref={(n) => { tabRefs.current[kind] = n; }} role="tab" id={`tab-${kind}`} aria-selected={tab === kind} aria-controls={`panel-${kind}`} tabIndex={tab === kind ? 0 : -1}
        className={tab === kind ? 'active' : ''} onClick={() => setTab(kind)} data-testid={`tab-${kind}`}>
        {kind === 'uploads' ? <><Upload size={15}/>Your uploads</> : <><Bookmark size={15}/>Favourites</>}</button>)}
      <i className={`profile-tab-pill ${tab}`} aria-hidden="true"/>
    </div>
    {tab === 'uploads'
      ? <PagedBuilds key={`uploads-${userId}`} kind="uploads" userId={userId} onFirstPage={(page) => setPending(page.cleanupPending)}
        renderActions={(build) => <div className="owner-actions"><button className="button light small" onClick={() => setEditBuild(build)} data-testid={`button-edit-${build.id}`}><PencilLine size={13}/>Edit</button><button className="button light small danger-text" onClick={() => setConfirmDelete(build)} data-testid={`button-delete-${build.id}`}><Trash2 size={13}/>Delete</button></div>}/>
      : <PagedBuilds key={`favourites-${userId}`} kind="favourites" userId={userId} onFirstPage={(page) => setPending(page.cleanupPending)}/>}
    {editBuild && <EditBuildDialog build={editBuild} close={() => setEditBuild(null)} onSave={(data) => patchUpdate(editBuild, data)} onDelete={() => { const target = editBuild; setEditBuild(null); setConfirmDelete(target); }}/>}
    {confirmDelete && <ConfirmDialog eyebrow="This cannot be undone" title={`Delete "${confirmDelete.title}"?`} confirmLabel="Delete post" pendingLabel="Deleting"
      close={() => setConfirmDelete(null)} onConfirm={() => removeBuild(confirmDelete)}>
      <p>The post, all {safePhotos(confirmDelete).length} of its photos{confirmDelete.configuration ? ' and its blueprint' : ''} leave the gallery and anyone's saved list.</p>
    </ConfirmDialog>}
  </>);
}
function ReferenceCard({ id, onDismiss }: { id: number; onDismiss: () => void }) {
  const { data:build, isLoading, isError } = useGetBuild(id, { query:{ queryKey:getGetBuildQueryKey(id), retry:1 } });
  const photo = build ? safePhotos(build)[0] : undefined;
  return <aside className="reference-card" aria-label="Inspiration reference" data-testid="card-reference">
    {isLoading ? <div className="reference-thumb skeleton"/> : photo ? <img key={id} className="reference-thumb" src={photoUrl(photo)} onLoad={() => {
      if (!isError && build?.id === id) completeInspirationHandoff('reference');
    }} alt={build ? `Reference photo: ${build.title}` : 'Reference photo'}/> : <div className="reference-thumb empty-photo"><ImageOff size={16}/></div>}
    <div className="reference-text">{isError ? <><b>That reference isn't available.</b><span>It may have been removed.</span></> : build ? <><span className="eyebrow">Your reference</span><b>{build.title}</b><span>Photo by @{build.creatorUsername}<span className="reference-explanation">. Set the shelves yourself; your design is untouched.</span></span></> : <b>Loading reference…</b>}</div>
    {build && <Link className="button light small" href={`/build/${build.id}`}>View post</Link>}
    <button className="icon-button" aria-label="Dismiss reference" onClick={onDismiss} data-testid="button-dismiss-reference"><X size={16}/></button>
  </aside>;
}

function Home() {
  const [publish, setPublish] = useState<{ attach: boolean } | null>(null);
  const [published, setPublished] = useState<Build | null>(null);
  const [refId, setRefId] = useState<number | null>(() => readReferenceId(window.location.search));
  const sceneRef = useRef<Scene>(initialScene());
  const [blueprint, setBlueprint] = useState<BuildConfiguration | null>(null);
  const queryClient = useQueryClient();
  const gate = useShareGate('blueprint');
  const syncScene = useCallback((scene: Scene) => {
    sceneRef.current = scene;
    completeInspirationHandoff('blueprint');
  }, []);
  const openPublish = (attach: boolean) => gate.request(() => { setBlueprint(sceneBlueprint(sceneRef.current)); setPublish({ attach }); }, attach ? 'blueprint' : 'photo');
  useEffect(() => {
    if (!gate.ready) return;
    const mode = new URLSearchParams(window.location.search).get('share');
    if (!mode) return;
    takeShareIntent();
    window.history.replaceState(null, '', `${window.location.pathname}${withoutParam(window.location.search, 'share')}${window.location.hash}`);
    setBlueprint(sceneBlueprint(sceneRef.current));
    setPublish({ attach:mode === 'blueprint' });
  }, [gate.ready]);
  const setReference = (id: number | null) => {
    const search = withoutParam(id ? window.location.search : withoutParam(window.location.search, 'inspiration'), 'ref');
    const next = id ? `${search ? `${search}&` : '?'}ref=${id}` : search;
    window.history.replaceState(null, '', `${window.location.pathname}${next}${window.location.hash}`);
    setRefId(id);
  };
  const onBuildSaved = (build: Build) => {
    setPublished(build);
    queryClient.invalidateQueries({ queryKey:getListBuildsQueryKey() });
    queryClient.invalidateQueries({ queryKey:getGetCommunitySummaryQueryKey() });
  };
  const preview = blueprint ? <span style={{ backgroundColor:blueprint.wallColor }}><BookcaseSketch color={blueprint.color} dirs={blueprint.shelfDirections} tall={blueprint.size === 'tall'}/></span> : null;
  return <div className="tw-shell"><Header/><main className={`page-wrap ${refId ? 'has-reference' : ''}`}>
    {refId && <ReferenceCard id={refId} onDismiss={() => {
      setReference(null);
      trackEvent('inspiration_reference_dismissed', { source:'playroom', type:'reference' });
    }}/>}
    <Configurator onPublish={(scene) => { sceneRef.current = scene; openPublish(true); }} onSceneChange={syncScene}/>
    {published && <div style={{ color:'var(--muted-ink)', fontSize:12, padding:'16px 8px 0' }}>“{published.title}” is in the gallery. <Link href={`/build/${published.id}`}>See it</Link></div>}
    {publish && <PublishDialog source="playroom" close={() => setPublish(null)} blueprint={blueprint} attachByDefault={publish.attach} blueprintPreview={preview} onSaved={onBuildSaved}/>}
  </main></div>;
}

function BrandedSignIn() {
  return <main className="auth-frame"><Link className="brand auth-mark" href="/"><BrandWordmark/></Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></main>;
}
function BrandedSignUp() {
  return <main className="auth-frame"><Link className="brand auth-mark" href="/"><BrandWordmark/></Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></main>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prior = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const remove = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prior.current !== undefined && prior.current !== userId) { void client.cancelQueries(); client.clear(); }
      prior.current = userId;
    });
    return remove;
  }, [addListener, client]);
  return null;
}
/** Separate cache instances and component state at the identity boundary.
 * A late mutation can only write to its original, now-disconnected account cache.
 */
function AccountRoutes() {
  const { user, isLoaded } = useUser();
  const identity = user?.id ?? 'public';
  const client = useMemo(() => new QueryClient(), [identity]);
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  if (!isLoaded) return <div className="skeleton" aria-label="Loading account"/>;
  return <QueryClientProvider client={client}>
    <ClerkQueryClientCacheInvalidator key={`cache-${identity}`}/>
    <Switch key={identity}>
      <Route path="/" component={Home}/>
      <Route path="/inspiration" component={Gallery}/>
      <Route path="/build/:id" component={DetailPage}/>
      <Route path="/profile" component={ProfilePage}/>
      <Route path="/sign-in/*?" component={BrandedSignIn}/>
      <Route path="/sign-up/*?" component={BrandedSignUp}/>
      <Route component={NotFound}/>
    </Switch>
  </QueryClientProvider>;
}
function LocalRoutes() {
  const client = useMemo(() => new QueryClient(), []);
  return <QueryClientProvider client={client}>
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/inspiration" component={Gallery}/>
      <Route path="/build/:id" component={DetailPage}/>
      <Route path="/profile" component={ProfilePage}/>
      <Route path="/sign-in/*?" component={LocalAuthDisabled}/>
      <Route path="/sign-up/*?" component={LocalAuthDisabled}/>
      <Route component={NotFound}/>
    </Switch>
  </QueryClientProvider>;
}
function Router() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) return <LocalRoutes/>;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={{
    theme:shadcn, cssLayerName:'clerk',
    options:{ logoPlacement:'inside', logoLinkUrl:basePath || '/', logoImageUrl:`${window.location.origin}${basePath}/logo.svg` },
    variables:{ colorPrimary:'#ff6b4a', colorForeground:'#2b1e16', colorMutedForeground:'#94857a', colorDanger:'#b74336', colorBackground:'#fff8ee', colorInput:'#fffdf9', colorInputForeground:'#2b1e16', colorNeutral:'#e5d6c3', fontFamily:'Clash Display', borderRadius:'1rem' },
    elements:{
      rootBox:'w-full flex justify-center', cardBox:'!bg-[#fff8ee] rounded-2xl w-[440px] max-w-full overflow-hidden', card:'!shadow-none !border-0 !bg-transparent !rounded-none', footer:'!shadow-none !border-0 !bg-transparent !rounded-none',
      headerTitle:{ color:'#2b1e16', fontWeight:'600' }, headerSubtitle:{ color:'#75665c' }, socialButtonsBlockButtonText:{ color:'#2b1e16', fontWeight:'700' }, formFieldLabel:{ color:'#2b1e16', fontWeight:'700' }, footerActionLink:{ color:'#d94f34', fontWeight:'700' }, footerActionText:{ color:'#75665c' }, dividerText:{ color:'#75665c' }, identityPreviewEditButton:{ color:'#d94f34' }, formFieldSuccessText:{ color:'#347656' }, alertText:{ color:'#2b1e16' },
      logoBox:'rounded-xl', logoImage:'rounded-xl', socialButtonsBlockButton:'!border-[#e8d9c8] !bg-white rounded-xl', formButtonPrimary:'!bg-[#ff6b4a] !text-white rounded-xl', formFieldInput:'!bg-white !text-[#2b1e16] !border-[#e5d6c3] rounded-xl', footerAction:'border-0', dividerLine:'!bg-[#e5d6c3]', alert:'!bg-[#fff1e6] rounded-xl', otpCodeFieldInput:'!bg-white !text-[#2b1e16]', formFieldRow:'gap-2', main:'gap-4',
    },
  }} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn:{ start:{ title:'Welcome back', subtitle:'Come back to your ImagineMōde workshop.' } }, signUp:{ start:{ title:'Make yourself at home', subtitle:'Create an account and share your first bookcase.' } } }}
    routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace:true })}>
    <ClerkAuthBridge>
      <AccountRoutes/>
    </ClerkAuthBridge>
  </ClerkProvider>;
}
function CursorSignIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const cursor = useCursorAccount();
  const [, setLocation] = useLocation();
  return <main className="auth-frame"><Link className="brand auth-mark" href="/"><BrandWordmark/></Link>
    <p>{cursor.signedOutInApp
      ? 'You are logged out. The planner is still yours. Log in when you want to share a photo.'
      : isLoaded && isSignedIn ? 'You are signed in with Cursor.' : 'This private app uses your Cursor sign-in. Open it from your Cursor link while you are signed in.'}</p>
    {cursor.signedOutInApp
      ? <button type="button" className="button coral" onClick={() => { cursor.resumeSession(); setLocation('/'); }}>Log in</button>
      : <Link className="button coral" href="/">Back to the planner</Link>}
  </main>;
}
function CursorRoutes() {
  const session = useCursorAccount();
  const identity = session.viewerId ?? 'public';
  const client = useMemo(() => new QueryClient(), [identity]);
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  if (!session.isLoaded) return <div className="skeleton" aria-label="Loading account"/>;
  return <QueryClientProvider client={client}>
    <AuthContext.Provider value={{ isSignedIn: session.isSignedIn, isLoaded: true, user: session.user }}>
      <Switch key={identity}>
        <Route path="/" component={Home}/>
        <Route path="/inspiration" component={Gallery}/>
        <Route path="/build/:id" component={DetailPage}/>
        <Route path="/profile" component={ProfilePage}/>
        <Route path="/sign-in/*?" component={CursorSignIn}/>
        <Route path="/sign-up/*?" component={CursorSignIn}/>
        <Route component={NotFound}/>
      </Switch>
    </AuthContext.Provider>
  </QueryClientProvider>;
}
function App() {
  return <WouterRouter base={basePath}>{clerkPubKey ? <Router/> : <CursorAccountProvider><CursorRoutes/></CursorAccountProvider>}</WouterRouter>;
}
export default App;
