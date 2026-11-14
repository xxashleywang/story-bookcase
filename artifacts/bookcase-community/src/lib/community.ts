// Pure helpers for photo-first community sharing. Kept framework-free so they can be unit tested with node --test.

import { encodeDesign } from './design-url.ts';

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 12_000_000;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type PhotoType = typeof PHOTO_TYPES[number];

export type BlueprintLike = {
  size: 'standard' | 'tall';
  color: string;
  shelfDirections: string[];
  wallColor: string;
  floorId: string;
  floorKind?: 'Laminate' | 'Carpet' | 'Custom';
  customFloorColor?: string | null;
};

export type ShareGateProfile = 'loading' | 'error' | 'ready';
export type ShareGateDecision = 'wait' | 'sign-in' | 'retry' | 'username' | 'gallery';

/** Where a share click should go. Loading is not the same thing as a missing username. */
export function shareGateDecision(input: {
  authLoaded: boolean;
  signedIn: boolean;
  profile: ShareGateProfile;
  isUsernameSet: boolean;
}): ShareGateDecision {
  if (!input.authLoaded) return 'wait';
  if (!input.signedIn) return 'sign-in';
  if (input.profile === 'loading') return 'wait';
  if (input.profile === 'error') return 'retry';
  if (!input.isUsernameSet) return 'username';
  return 'gallery';
}

const SHELF_DIRECTIONS = ['F', 'L', 'B', 'R'] as const;
type ShelfDirection = typeof SHELF_DIRECTIONS[number];
const FLOOR_KINDS = ['Laminate', 'Carpet', 'Custom'] as const;

function isShelfDirection(value: unknown): value is ShelfDirection {
  return typeof value === 'string' && (SHELF_DIRECTIONS as readonly string[]).includes(value);
}

/** A stashed BuildConfiguration, or null when the stored value is missing or the wrong shape. */
export function readGalleryBlueprint(raw: string | null): (BlueprintLike & { shelfDirections: ShelfDirection[] }) | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.size !== 'standard' && record.size !== 'tall') return null;
  if (typeof record.color !== 'string' || record.color.length === 0) return null;
  if (typeof record.wallColor !== 'string' || record.wallColor.length === 0) return null;
  if (typeof record.floorId !== 'string' || record.floorId.length === 0) return null;
  if (!Array.isArray(record.shelfDirections) || record.shelfDirections.length === 0) return null;
  if (!record.shelfDirections.every(isShelfDirection)) return null;
  const blueprint: BlueprintLike & { shelfDirections: ShelfDirection[] } = {
    size: record.size,
    color: record.color,
    shelfDirections: record.shelfDirections,
    wallColor: record.wallColor,
    floorId: record.floorId,
  };
  if (record.floorKind !== undefined) {
    if (typeof record.floorKind !== 'string' || !(FLOOR_KINDS as readonly string[]).includes(record.floorKind)) return null;
    blueprint.floorKind = record.floorKind as BlueprintLike['floorKind'];
  }
  if (record.customFloorColor !== undefined) {
    if (record.customFloorColor !== null && typeof record.customFloorColor !== 'string') return null;
    blueprint.customFloorColor = record.customFloorColor;
  }
  return blueprint;
}

type FileLike = { name: string; size: number; type: string; lastModified?: number };

export function photoKey(file: FileLike) {
  return `${file.name}:${file.size}:${file.lastModified ?? 0}`;
}

/** Merge newly picked files into the current selection, enforcing count, size, type and de-duplication. */
export function mergePhotoSelection<T extends FileLike>(current: T[], incoming: T[], max = MAX_PHOTOS) {
  const accepted: T[] = [];
  const errors: string[] = [];
  const keys = new Set(current.map(photoKey));
  let overflow = 0;
  for (const file of incoming) {
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) { errors.push(`${file.name} is not a JPEG, PNG, WebP or AVIF image.`); continue; }
    if (file.size > MAX_PHOTO_BYTES) { errors.push(`${file.name} is larger than 12 MB.`); continue; }
    if (file.size < 1) { errors.push(`${file.name} looks empty.`); continue; }
    if (keys.has(photoKey(file))) continue;
    if (current.length + accepted.length >= max) { overflow += 1; continue; }
    keys.add(photoKey(file));
    accepted.push(file);
  }
  if (overflow) errors.push(`Only ${max} photos fit in one post. ${overflow} ${overflow === 1 ? 'photo was' : 'photos were'} left out.`);
  return { accepted, errors };
}

export function photoCountLabel(count: number, max = MAX_PHOTOS) {
  return `${count} of ${max} photos`;
}

/** Validate the text + photo part of a share before any upload starts. */
export function validateShare(input: { title: string; photoCount: number }) {
  const title = input.title.trim();
  if (title.length < 2) return 'Give it a title with at least 2 characters.';
  if (title.length > 80) return 'Keep the title under 80 characters.';
  if (input.photoCount < 1) return 'Add at least one room photo.';
  if (input.photoCount > MAX_PHOTOS) return `Choose up to ${MAX_PHOTOS} photos.`;
  return null;
}

export function createPayload(input: { title: string; description: string; photoPaths: string[]; blueprint: BlueprintLike | null }) {
  return {
    title: input.title.trim(),
    description: input.description.trim() || null,
    photoPaths: input.photoPaths,
    configuration: input.blueprint,
  };
}

/** Only send photoPaths when the owner explicitly replaced them, so historical sets with more than four survive. */
export function updatePayload(input: {
  title: string; description: string; removeBlueprint: boolean; hadBlueprint: boolean; replacementPhotoPaths: string[] | null;
}) {
  const data: { title: string; description: string | null; configuration?: null; photoPaths?: string[] } = {
    title: input.title.trim(),
    description: input.description.trim() || null,
  };
  if (input.hadBlueprint && input.removeBlueprint) data.configuration = null;
  if (input.replacementPhotoPaths) data.photoPaths = input.replacementPhotoPaths;
  return data;
}

/** The homepage hash format: unit~wall~floorId~floorKind~customFloor. */
export function blueprintHash(config: BlueprintLike, encodeUnit: (m: { size: string; color: string; dirs: string[] }) => string) {
  const unit = encodeUnit({ size: config.size, color: config.color, dirs: [...config.shelfDirections] });
  const kind = config.floorKind === 'Carpet' ? 'Carpet' : 'Laminate';
  const custom = (config.customFloorColor || '#B9A48A').replace('#', '');
  return `${unit}~${config.wallColor.replace('#', '')}~${config.floorId}~${kind}~${custom}`;
}

export function blueprintHref(base: string, config: BlueprintLike, encodeUnit: (m: { size: string; color: string; dirs: string[] }) => string) {
  const configHash = blueprintHash(config, encodeUnit);
  const code = encodeDesign(configHash);
  return code ? `${base || ''}/d/${code}` : `${base || ''}/#${configHash}`;
}

/** Empty for the factory default, so the address bar stays the bare domain. Any other design is `#` plus its config. */
export function addressHash(config: string, defaultConfig: string) {
  return config.toLowerCase() === defaultConfig.toLowerCase() ? '' : `#${config}`;
}

/** Photo-only handoff: keep whatever design the visitor already has, and name the reference in the path. */
export function referenceHref(base: string, buildId: number) {
  return `${base || ''}/from/${buildId}`;
}

export function readReferenceId(search: string) {
  const raw = new URLSearchParams(search).get('ref');
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function withoutParam(search: string, key: string) {
  const params = new URLSearchParams(search);
  params.delete(key);
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function safePhotos(build: { photoPaths?: string[] | null }) {
  return Array.isArray(build.photoPaths) ? build.photoPaths.filter((p) => typeof p === 'string' && p.length > 0) : [];
}

export function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
