// Reversible short codes for a bookcase design, plus the planner paths those codes live on.
// The old `#unit~wall~floor~kind~custom` hash still decodes so links already shared keep opening.

const FLOORS = ['pale', 'honey', 'walnut', 'ash', 'white', 'oat', 'moss', 'custom'] as const;
const DIR_CHARS = ['F', 'L', 'B', 'R'] as const;
const CONFIG = /^([st])-([0-9a-f]{6})-([FLBR]*)~([0-9a-f]{6})~([a-z0-9-]{1,24})~(Laminate|Carpet)~([0-9a-f]{6})$/i;

export type PlannerTabName = 'style' | 'build';

export type PlannerLocation = {
  tab: PlannerTabName;
  code: string | null;
  referenceId: number | null;
  share: boolean;
};

function pathnameOf(path: string): string {
  const bare = path.split(/[?#]/)[0];
  if (bare.length > 1) return bare.replace(/\/+$/, '') || '/';
  return bare || '/';
}

class BitWriter {
  bits: number[] = [];
  write(value: number, width: number) {
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  bytes() {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => { if (bit) out[i >> 3] |= 1 << (7 - (i & 7)); });
    return out;
  }
}

class BitReader {
  i = 0;
  bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = bytes; }
  read(width: number) {
    if (this.i + width > this.bytes.length * 8) return null;
    let value = 0;
    for (let n = 0; n < width; n++) {
      const bit = (this.bytes[this.i >> 3] >> (7 - (this.i & 7))) & 1;
      this.i += 1;
      value = (value << 1) | bit;
    }
    return value;
  }
}

function bytesToCode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function codeToBytes(code: string) {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(code)) return null;
  const pad = code.length % 4 === 0 ? '' : '='.repeat(4 - (code.length % 4));
  try {
    const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function hexByte(value: number) {
  return value.toString(16).padStart(2, '0');
}

function hexColor(value: number) {
  return [hexByte((value >> 16) & 255), hexByte((value >> 8) & 255), hexByte(value & 255)].join('');
}

/** Short code for one design, or null when the config is not a design hash. The same design always yields the same code. */
export function encodeDesign(config: string) {
  const match = CONFIG.exec(config.trim());
  if (!match) return null;
  const [, size, color, dirs, wall, floorId, kind, custom] = match;
  const floorKey = floorId.toLowerCase();
  const known = FLOORS.indexOf(floorKey as typeof FLOORS[number]);
  const extended = known < 0;
  const writer = new BitWriter();
  writer.write(1, 4);
  writer.write(size.toLowerCase() === 't' ? 1 : 0, 1);
  writer.write(dirs.length, 4);
  for (const dir of dirs.toUpperCase()) writer.write(DIR_CHARS.indexOf(dir as typeof DIR_CHARS[number]), 2);
  writer.write(parseInt(color, 16), 24);
  writer.write(parseInt(wall, 16), 24);
  writer.write(parseInt(custom, 16), 24);
  writer.write(kind.toLowerCase() === 'carpet' ? 1 : 0, 1);
  writer.write(extended ? 1 : 0, 1);
  if (!extended) writer.write(known, 3);
  else {
    writer.write(floorKey.length, 5);
    for (const char of floorKey) writer.write(char.charCodeAt(0), 7);
  }
  return bytesToCode(writer.bytes());
}

/** Design hash for a short code, or null when the code is not one of ours. */
export function decodeDesign(code: string) {
  const bytes = codeToBytes(code);
  if (!bytes) return null;
  const reader = new BitReader(bytes);
  const version = reader.read(4);
  const tall = reader.read(1);
  const count = reader.read(4);
  if (version !== 1 || tall === null || count === null || count > 15) return null;
  let dirs = '';
  for (let i = 0; i < count; i++) {
    const dir = reader.read(2);
    if (dir === null) return null;
    dirs += DIR_CHARS[dir];
  }
  const color = reader.read(24);
  const wall = reader.read(24);
  const custom = reader.read(24);
  const carpet = reader.read(1);
  const extended = reader.read(1);
  if (color === null || wall === null || custom === null || carpet === null || extended === null) return null;
  let floor = 'pale';
  if (!extended) {
    const index = reader.read(3);
    if (index === null || !FLOORS[index]) return null;
    floor = FLOORS[index];
  } else {
    const length = reader.read(5);
    if (length === null || length < 1) return null;
    floor = '';
    for (let i = 0; i < length; i++) {
      const char = reader.read(7);
      if (char === null || char < 45 || char > 122) return null;
      floor += String.fromCharCode(char);
    }
    if (!/^[a-z0-9-]+$/.test(floor)) return null;
  }
  const size = tall ? 't' : 's';
  const kind = carpet ? 'Carpet' : 'Laminate';
  return `${size}-${hexColor(color)}-${dirs}~${hexColor(wall)}~${floor}~${kind}~${hexColor(custom)}`;
}

/** The old address-bar hash, when it is a design. Anything else is ignored. */
export function legacyConfigFromHash(hash: string) {
  const raw = hash.replace(/^#/, '').trim();
  if (!CONFIG.test(raw)) return null;
  return raw;
}

export function parsePlannerPath(path: string): PlannerLocation | null {
  const pathname = pathnameOf(path);
  if (pathname === '/') return { tab: 'style', code: null, referenceId: null, share: false };
  const match = pathname.match(/^(\/build-it)?(\/d\/([A-Za-z0-9_-]{8,80}))?(\/from\/([1-9]\d*))?(\/share)?$/);
  if (!match || (!match[1] && !match[2] && !match[4] && !match[6])) return null;
  const referenceId = match[5] ? Number(match[5]) : null;
  return {
    tab: match[1] ? 'build' : 'style',
    code: match[3] ?? null,
    referenceId: referenceId && Number.isInteger(referenceId) ? referenceId : null,
    share: Boolean(match[6]),
  };
}

export function formatPlannerPath(location: PlannerLocation) {
  let path = location.tab === 'build' ? '/build-it' : '';
  if (location.code) path += `/d/${location.code}`;
  if (location.referenceId) path += `/from/${location.referenceId}`;
  if (location.share) path += '/share';
  return path || '/';
}

export function referenceIdFromSearch(search: string) {
  const raw = new URLSearchParams(search).get('ref');
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

function withoutKeys(search: string, keys: string[]) {
  const params = new URLSearchParams(search);
  for (const key of keys) params.delete(key);
  const next = params.toString();
  return next ? `?${next}` : '';
}

function joinBase(base: string, path: string) {
  const prefix = base.replace(/\/$/, '');
  return path === '/' ? `${prefix}/` : `${prefix}${path}`;
}

function relativeToBase(pathname: string, base: string) {
  const prefix = base.replace(/\/$/, '');
  const path = pathnameOf(pathname);
  if (!prefix) return path || '/';
  if (path === prefix) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || '/';
  return path;
}

/**
 * Design to open for this address.
 * A short code wins. An old hash is next. A saved design is used only when the
 * address itself names no design, so a bad share link cannot show a different bookcase.
 */
export function designConfigFromLocation(pathname: string, hash: string, stored: string | null) {
  const parsed = parsePlannerPath(pathname);
  if (parsed?.code) return decodeDesign(parsed.code) ?? '';
  return legacyConfigFromHash(hash) ?? stored ?? '';
}

/** Canonical link for a design. The factory default stays on `/`. */
export function shareHref(origin: string, base: string, config: string, defaultConfig: string) {
  const root = `${origin}${joinBase(base, '/')}`;
  if (config.toLowerCase() === defaultConfig.toLowerCase()) return root;
  const code = encodeDesign(config);
  if (!code) return `${origin}${joinBase(base, '/')}#${config}`;
  return `${origin}${joinBase(base, `/d/${code}`)}`;
}

/** Where a share request should come back to, as a path rather than a query string. */
export function shareReturnPath(mode: 'photo' | 'blueprint', pathname: string, search: string, hash: string) {
  if (mode === 'photo') return '/gallery/share';
  const parsed = parsePlannerPath(pathname) ?? { tab: 'style' as const, code: null, referenceId: null, share: false };
  const legacy = legacyConfigFromHash(hash);
  const code = parsed.code ?? (legacy ? encodeDesign(legacy) : null);
  const next = formatPlannerPath({
    tab: parsed.tab,
    code,
    referenceId: parsed.referenceId ?? referenceIdFromSearch(search),
    share: true,
  });
  const leftover = !code && legacy ? `#${legacy}` : '';
  return `${next}${withoutKeys(search, ['share', 'ref'])}${leftover}`;
}

/** Drop a one-shot share marker without dropping the design or the reference. */
export function locationWithoutShare(base: string, pathname: string, search: string, hash: string) {
  const relative = relativeToBase(pathname, base);
  const cleaned = withoutKeys(search, ['share']);
  if (relative === '/gallery/share') return `${joinBase(base, '/gallery')}${cleaned}${hash}`;
  const parsed = parsePlannerPath(relative);
  if (!parsed) return `${pathname}${cleaned}${hash}`;
  return `${joinBase(base, formatPlannerPath({ ...parsed, share: false }))}${cleaned}${hash}`;
}
