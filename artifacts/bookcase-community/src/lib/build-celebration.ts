type BuildTab = 'style' | 'build';

type CelebrationInput = {
  previousDone: number;
  currentDone: number;
  totalShelves: number;
  tab: BuildTab;
};

/**
 * Fire the completion celebration only when build progress crosses into "done"
 * while the builder is actively in the Build tab.
 */
export function shouldCelebrateBuildCompletion({
  previousDone,
  currentDone,
  totalShelves,
  tab,
}: CelebrationInput) {
  if (tab !== 'build') return false;
  if (totalShelves <= 0) return false;
  if (previousDone >= totalShelves) return false;
  return currentDone >= totalShelves;
}
