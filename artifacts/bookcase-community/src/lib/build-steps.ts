/**
 * Build-step helpers for the Playroom build guide.
 *
 * Step 1 is always the base + post, so progress never starts at 0%.
 * Shelves then follow from bottom to top and must stay contiguous.
 */
export type BuildSteps = {
  normalized: boolean[];
  doneShelves: number;
  doneSteps: number;
  totalSteps: number;
  nextShelfIndex: number;
  isComplete: boolean;
  percent: number;
};

function leadingDone(progress: readonly boolean[]): number {
  let i = 0;
  while (i < progress.length && progress[i]) i += 1;
  return i;
}

/** Keep only the leading done run so "shelf 3 done before shelf 2" cannot persist. */
export function normalizeBuildProgress(progress: readonly boolean[]): boolean[] {
  const run = leadingDone(progress);
  return progress.map((_, i) => i < run);
}

/** Convert shelf completion into user-facing step progress with base counted as step 1. */
export function buildSteps(progress: readonly boolean[]): BuildSteps {
  const normalized = normalizeBuildProgress(progress);
  const doneShelves = leadingDone(normalized);
  const totalSteps = normalized.length + 1;
  const doneSteps = doneShelves + 1;
  const nextShelfIndex = doneShelves >= normalized.length ? -1 : doneShelves;
  const isComplete = nextShelfIndex === -1;
  const percent = Math.round((doneSteps / totalSteps) * 100);
  return { normalized, doneShelves, doneSteps, totalSteps, nextShelfIndex, isComplete, percent };
}

/** Mark the next pending shelf complete; no-op once the build is complete. */
export function advanceBuildProgress(progress: readonly boolean[]): boolean[] {
  const { normalized, nextShelfIndex } = buildSteps(progress);
  if (nextShelfIndex < 0) return normalized;
  const next = [...normalized];
  next[nextShelfIndex] = true;
  return next;
}

/** Undo only the most recently completed shelf, preserving strict order. */
export function rewindBuildProgress(progress: readonly boolean[]): boolean[] {
  const { normalized, doneShelves } = buildSteps(progress);
  if (doneShelves <= 0) return normalized;
  const next = [...normalized];
  next[doneShelves - 1] = false;
  return next;
}
