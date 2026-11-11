import { X } from 'lucide-react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

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

function StackIcon() {
  return <svg className="shelf-key-hint-action" viewBox="0 0 18 18" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M4 5.5h10M4 9h10M4 12.5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}

function RotateIcon() {
  return <svg className="shelf-key-hint-action" viewBox="0 0 18 18" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M12.7 5.7A5 5 0 1 0 13.1 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M10.3 3.8h3.9v3.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function ShelfKeyHint({ onDismiss }: { onDismiss: () => void }) {
  return <aside className="shelf-key-hint" role="status" aria-live="polite">
    <span className="sr-only">Use arrow keys: up and down switch shelves, left and right turns shelf direction.</span>
    <div className="shelf-key-hint-groups" aria-hidden="true">
      <KbdGroup className="shelf-key-hint-group select">
        <KeyCap direction="up" />
        <KeyCap direction="down" />
        <StackIcon />
      </KbdGroup>
      <KbdGroup className="shelf-key-hint-group rotate">
        <KeyCap direction="left" />
        <KeyCap direction="right" />
        <RotateIcon />
      </KbdGroup>
    </div>
    <button type="button" className="icon-button shelf-key-hint-close" aria-label="Dismiss keyboard hint" onClick={onDismiss}>
      <X size={14} />
    </button>
  </aside>;
}
