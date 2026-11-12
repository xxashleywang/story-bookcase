import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';

function KeyCap({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
  return <Kbd className="shelf-key-hint-cap" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
      <path
        d={
          direction === 'up' ? 'M8 3l4 4H9v6H7V7H4z'
            : direction === 'down' ? 'M8 13l4-4H9V3H7v6H4z'
              : direction === 'left' ? 'M3 8l4-4v3h6v2H7v3z'
                : 'M13 8l-4-4v3H3v2h6v3z'
        }
        fill="currentColor"
      />
    </svg>
  </Kbd>;
}

export function ShelfKeyHint({
  onDismiss,
  className = '',
  style,
}: {
  onDismiss: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return <aside className={`shelf-key-hint ${className}`.trim()} style={style} role="status" aria-live="polite">
    <span className="sr-only">Use arrow keys. Up and down switch shelves. Left and right turns shelf direction.</span>
    <div className="shelf-key-hint-copy">
      <b>Keyboard controls</b>
      <span>Use arrows to move and turn shelves.</span>
    </div>
    <div className="shelf-key-hint-pad" aria-hidden="true">
      <span className="shelf-key-hint-pad-empty" />
      <KeyCap direction="up" />
      <span className="shelf-key-hint-pad-empty" />
      <KeyCap direction="left" />
      <KeyCap direction="down" />
      <KeyCap direction="right" />
    </div>
    <button type="button" className="icon-button shelf-key-hint-close" aria-label="Dismiss keyboard hint" onClick={onDismiss}>
      <X size={14} />
    </button>
  </aside>;
}
