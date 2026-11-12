type Rect = { left: number; right: number; top: number; bottom: number };
type Side = 'left' | 'right';

const HINT_EDGE_PADDING = 14;
const HINT_COLLISION_PADDING = 8;
const HINT_SIDE_GAP = 22;
/** Sit slightly below the lower shelf in a pair so the lowest slot covers the wall/floor line. */
const HINT_PAIR_OFFSET = 26;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shelfRect(postX: number, y: number, dir: string): Rect {
  const top = y - 12;
  const bottom = y + 12;
  if (dir === 'L') return { left: postX - 136, right: postX - 8, top, bottom };
  if (dir === 'R') return { left: postX + 8, right: postX + 136, top, bottom };
  return { left: postX - 92, right: postX + 92, top, bottom };
}

function intersects(a: Rect, b: Rect, pad = 0): boolean {
  return !(
    a.right <= b.left - pad
    || a.left >= b.right + pad
    || a.bottom <= b.top - pad
    || a.top >= b.bottom + pad
  );
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function outOfBoundsDistance(rect: Rect, stageWidth: number, stageHeight: number): number {
  let distance = 0;
  if (rect.left < HINT_EDGE_PADDING) distance += HINT_EDGE_PADDING - rect.left;
  if (rect.right > stageWidth - HINT_EDGE_PADDING) distance += rect.right - (stageWidth - HINT_EDGE_PADDING);
  if (rect.top < HINT_EDGE_PADDING) distance += HINT_EDGE_PADDING - rect.top;
  if (rect.bottom > stageHeight - HINT_EDGE_PADDING) distance += rect.bottom - (stageHeight - HINT_EDGE_PADDING);
  return distance;
}

/** Shelves 1&2, 3&4, 5&6... share a slot. `selected` is 0-based from the bottom. */
export function shelfHintPairIndex(selected: number): number {
  return Math.floor(Math.max(0, selected) / 2);
}

/** Lower shelf in the selected pair (shelf 1 for 1–2, shelf 3 for 3–4, leftover odd shelf alone). */
export function shelfHintPairStart(selected: number): number {
  return shelfHintPairIndex(selected) * 2;
}

type PlacementInput = {
  stageWidth: number;
  stageHeight: number;
  postX: number;
  shelfYs: number[];
  shelfDirs: string[];
  selected: number;
  hintWidth: number;
  hintHeight: number;
  preferRight?: boolean;
  allowSideSwitch?: boolean;
};

type PlacementResult = { left: number; top: number; side: Side; pairIndex: number };

export function placeShelfHint({
  stageWidth,
  stageHeight,
  postX,
  shelfYs,
  shelfDirs,
  selected,
  hintWidth,
  hintHeight,
  preferRight = true,
  allowSideSwitch = true,
}: PlacementInput): PlacementResult {
  const pairIndex = shelfHintPairIndex(selected);
  const pairStart = shelfHintPairStart(selected);
  const fallbackTop = clamp(HINT_EDGE_PADDING + hintHeight / 2, HINT_EDGE_PADDING, stageHeight - HINT_EDGE_PADDING);
  if (!shelfYs.length || selected < 0 || selected >= shelfYs.length) {
    return { left: HINT_EDGE_PADDING, top: fallbackTop, side: 'right', pairIndex };
  }

  const shelves = shelfYs.map((y, i) => shelfRect(postX, y, shelfDirs[i] || 'F'));
  const blocked = [...shelves];
  const minTop = HINT_EDGE_PADDING + hintHeight / 2;
  const maxTop = stageHeight - HINT_EDGE_PADDING - hintHeight / 2;
  const targetTop = clamp((shelfYs[pairStart] ?? shelfYs[selected]) + HINT_PAIR_OFFSET, minTop, maxTop);
  const shelfLeftEdge = Math.min(...shelves.map((rect) => rect.left));
  const shelfRightEdge = Math.max(...shelves.map((rect) => rect.right));
  const baseLeft = shelfLeftEdge - HINT_SIDE_GAP - hintWidth;
  const baseRight = shelfRightEdge + HINT_SIDE_GAP;
  const sideOrder: Side[] = allowSideSwitch
    ? (preferRight ? ['right', 'left'] : ['left', 'right'])
    : [preferRight ? 'right' : 'left'];

  const candidates = sideOrder.map((side) => {
    const left = side === 'right' ? baseRight : baseLeft;
    const rect = {
      left,
      right: left + hintWidth,
      top: targetTop - hintHeight / 2,
      bottom: targetTop + hintHeight / 2,
    };
    return { left, top: targetTop, side, rect };
  });

  const firstValid = candidates.find((candidate) => outOfBoundsDistance(candidate.rect, stageWidth, stageHeight) === 0
    && blocked.every((rect) => !intersects(candidate.rect, rect, HINT_COLLISION_PADDING)));
  if (firstValid) return { left: firstValid.left, top: firstValid.top, side: firstValid.side, pairIndex };

  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const left = clamp(candidate.left, HINT_EDGE_PADDING, stageWidth - hintWidth - HINT_EDGE_PADDING);
    const top = clamp(candidate.top, minTop, maxTop);
    const rect = { left, right: left + hintWidth, top: top - hintHeight / 2, bottom: top + hintHeight / 2 };
    const collisionArea = blocked.reduce((sum, blockedRect) => sum + overlapArea(rect, blockedRect), 0);
    const boundsPenalty = outOfBoundsDistance(rect, stageWidth, stageHeight);
    const sidePenalty = candidate.side === 'right' ? 0 : 24;
    const score = collisionArea * 5 + boundsPenalty * 100 + sidePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = { ...candidate, left, top, rect };
    }
  }

  return { left: best.left, top: best.top, side: best.side, pairIndex };
}
