// Pure helpers for photo-first community sharing. Kept framework-free so they can be unit tested with node --test.

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
  return `${base || ''}/#${blueprintHash(config, encodeUnit)}`;
}

/** Photo-only handoff: keep whatever design the visitor already has, only add a reference id. */
export function referenceHref(base: string, buildId: number) {
  return `${base || ''}/?ref=${buildId}`;
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
