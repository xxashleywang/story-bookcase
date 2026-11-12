import type { CSSProperties } from 'react';
import { X } from 'lucide-react';

function ArrowGlyph({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
  return <svg viewBox="0 0 16 16" width="12" height="12" focusable="false" aria-hidden="true">
    <path
      d={
        direction === 'up' ? 'M8 3l4 4H9v6H7V7H4z'
          : direction === 'down' ? 'M8 13l4-4H9V3H7v6H4z'
            : direction === 'left' ? 'M3 8l4-4v3h6v2H7v3z'
              : 'M13 8l-4-4v3H3v2h6v3z'
      }
      fill="currentColor"
    />
  </svg>;
}

export function ShelfKeyHint({
  onDismiss,
  onMoveUp,
  onMoveDown,
  onTurnLeft,
  onTurnRight,
  canMoveUp,
  canMoveDown,
  className = '',
  style,
}: {
  onDismiss: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTurnLeft: () => void;
  onTurnRight: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return <aside className={`shelf-key-hint ${className}`.trim()} style={style} role="status" aria-live="polite">
    <span className="sr-only">Use arrow keys or the controls. Up and down switch shelves. Left and right turn shelf direction.</span>
    <div className="shelf-key-hint-copy">
      <b>Shelf controls</b>
      <span>Up and down move shelves. Left and right turn the shelf.</span>
    </div>
    <div className="shelf-key-hint-pad" role="group" aria-label="Shelf controls">
      <span className="shelf-key-hint-pad-empty" aria-hidden="true" />
      <button type="button" className="shelf-key-hint-btn" onClick={onMoveUp} aria-label="Move up one shelf" disabled={!canMoveUp}>
        <ArrowGlyph direction="up" />
      </button>
      <span className="shelf-key-hint-pad-empty" aria-hidden="true" />
      <button type="button" className="shelf-key-hint-btn" onClick={onTurnLeft} aria-label="Turn shelf left">
        <ArrowGlyph direction="left" />
      </button>
      <button type="button" className="shelf-key-hint-btn" onClick={onMoveDown} aria-label="Move down one shelf" disabled={!canMoveDown}>
        <ArrowGlyph direction="down" />
      </button>
      <button type="button" className="shelf-key-hint-btn" onClick={onTurnRight} aria-label="Turn shelf right">
        <ArrowGlyph direction="right" />
      </button>
    </div>
    <button type="button" className="icon-button shelf-key-hint-close" aria-label="Dismiss keyboard hint" onClick={onDismiss}>
      <X size={14} />
    </button>
  </aside>;
}
