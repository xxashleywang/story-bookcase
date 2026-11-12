type Rect = { left: number; right: number; top: number; bottom: number };
type Side = 'left' | 'right';

const HINT_EDGE_PADDING = 14;
const HINT_COLLISION_PADDING = 8;
const HINT_SIDE_GAP = 22;
const HINT_VERTICAL_NUDGES = [0, -56, 56, -98, 98];

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

type PlacementInput = {
  stageWidth: number;
  stageHeight: number;
  postX: number;
  shelfYs: number[];
  shelfDirs: string[];
  selected: number;
  targetTop: number;
  hintWidth: number;
  hintHeight: number;
  preferRight?: boolean;
  allowSideSwitch?: boolean;
};

type PlacementResult = { left: number; top: number; side: Side };

export function placeShelfHint({
  stageWidth,
  stageHeight,
  postX,
  shelfYs,
  shelfDirs,
  selected,
  targetTop,
  hintWidth,
  hintHeight,
  preferRight = true,
  allowSideSwitch = true,
}: PlacementInput): PlacementResult {
  const shelves = shelfYs.map((y, i) => shelfRect(postX, y, shelfDirs[i] || 'F'));
  if (!shelves.length || selected < 0 || selected >= shelfYs.length) {
    return { left: HINT_EDGE_PADDING, top: clamp(targetTop, HINT_EDGE_PADDING, stageHeight - HINT_EDGE_PADDING), side: 'right' };
  }

  // The selected shelf badge sits to the right of the post in this layout.
  const selectedY = shelfYs[selected];
  const badge: Rect = { left: postX + 40, right: postX + 88, top: selectedY - 24, bottom: selectedY + 24 };
  const blocked = [...shelves, badge];

  const minTop = HINT_EDGE_PADDING + hintHeight / 2;
  const maxTop = stageHeight - HINT_EDGE_PADDING - hintHeight / 2;
  const clampedTargetTop = clamp(targetTop, minTop, maxTop);
  const shelfLeftEdge = Math.min(...shelves.map((rect) => rect.left));
  const shelfRightEdge = Math.max(...shelves.map((rect) => rect.right));
  const baseLeft = shelfLeftEdge - HINT_SIDE_GAP - hintWidth;
  const baseRight = shelfRightEdge + HINT_SIDE_GAP;
  const sideOrder: Side[] = allowSideSwitch
    ? (preferRight ? ['right', 'left'] : ['left', 'right'])
    : [preferRight ? 'right' : 'left'];

  const candidates = HINT_VERTICAL_NUDGES.flatMap((delta) => {
    const top = clamp(clampedTargetTop + delta, minTop, maxTop);
    return sideOrder.map((side) => {
      const left = side === 'right' ? baseRight : baseLeft;
      const rect = {
        left,
        right: left + hintWidth,
        top: top - hintHeight / 2,
        bottom: top + hintHeight / 2,
      };
      return { left, top, side, rect };
    });
  });

  const firstValid = candidates.find((candidate) => outOfBoundsDistance(candidate.rect, stageWidth, stageHeight) === 0
    && blocked.every((rect) => !intersects(candidate.rect, rect, HINT_COLLISION_PADDING)));
  if (firstValid) return { left: firstValid.left, top: firstValid.top, side: firstValid.side };

  // Last-resort fallback: clamp to stage, then minimise overlap + movement.
  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const left = clamp(candidate.left, HINT_EDGE_PADDING, stageWidth - hintWidth - HINT_EDGE_PADDING);
    const top = clamp(candidate.top, minTop, maxTop);
    const rect = { left, right: left + hintWidth, top: top - hintHeight / 2, bottom: top + hintHeight / 2 };
    const collisionArea = blocked.reduce((sum, blockedRect) => sum + overlapArea(rect, blockedRect), 0);
    const boundsPenalty = outOfBoundsDistance(rect, stageWidth, stageHeight);
    const movementPenalty = Math.abs(top - clampedTargetTop);
    const sidePenalty = candidate.side === 'right' ? 0 : 24;
    const score = collisionArea * 5 + boundsPenalty * 100 + movementPenalty + sidePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = { ...candidate, left, top, rect };
    }
  }

  return { left: best.left, top: best.top, side: best.side };
}
