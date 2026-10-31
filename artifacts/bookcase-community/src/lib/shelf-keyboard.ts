type ShelfKeyAction = { type:'rotate' | 'select'; step:1 | -1 };
const ARROW_ACTIONS: Record<string, ShelfKeyAction> = {
  ArrowUp:{ type:'select', step:1 }, ArrowDown:{ type:'select', step:-1 },
  ArrowLeft:{ type:'rotate', step:-1 }, ArrowRight:{ type:'rotate', step:1 },
};
const CLOCKWISE = ['F', 'R', 'B', 'L'];

export function rotateShelfDirection(direction: string, step: number): string {
  const index = CLOCKWISE.indexOf(direction);
  if (index < 0) throw new Error(`Invalid shelf direction: ${direction}`);
  return CLOCKWISE[((index + step) % 4 + 4) % 4];
}

export function moveShelfSelection(selected: number, count: number, step: number): number {
  return Math.max(0, Math.min(count - 1, selected + step));
}

const NATIVE_KEY_TARGETS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], [role="spinbutton"], [role="dialog"], .modal-backdrop, .inspire-drawer';

export function shelfActionFromKey(event: KeyboardEvent, {
  selected, count, designing, rolling,
}: { selected: number; count: number; designing: boolean; rolling: boolean }): ShelfKeyAction | null {
  if (!designing || rolling || selected < 0 || selected >= count) return null;
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const target = event.target as Element | null;
  if (typeof target?.closest === 'function' && target.closest(NATIVE_KEY_TARGETS)) return null;
  return ARROW_ACTIONS[event.key] || null;
}
