import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from 'lucide-react';

/** Card size used by the stage placement math; keep in sync with `.shelf-key-hint` in index.css. */
export const SHELF_HINT_SIZE = { width:236, height:184 };

function PadButton({ icon, label, onClick, disabled = false, className = '' }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; className?: string;
}) {
  return <button type="button" className={`shelf-key-hint-btn ${className}`.trim()} onClick={onClick} disabled={disabled}>
    {icon}<span>{label}</span>
  </button>;
}

export function ShelfKeyHint({
  shelf,
  count,
  facing,
  onDismiss,
  onMoveUp,
  onMoveDown,
  onTurnLeft,
  onTurnRight,
  className = '',
  style,
}: {
  shelf: number;
  count: number;
  facing: string;
  onDismiss: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTurnLeft: () => void;
  onTurnRight: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return <aside className={`shelf-key-hint ${className}`.trim()} style={style} aria-label={`Shelf ${shelf + 1} controls`}>
    <div className="shelf-key-hint-head">
      <div>
        <b>Shelf {shelf + 1} <span>of {count}</span></b>
        <small>Faces {facing.toLowerCase()}</small>
      </div>
      <button type="button" className="shelf-key-hint-close" aria-label="Close shelf controls" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
    <div className="shelf-key-hint-pad" role="group" aria-label="Move or turn the shelf" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight">
      <PadButton className="is-up" icon={<ArrowUp size={16} />} label="Shelf up" onClick={onMoveUp} disabled={shelf >= count - 1} />
      <PadButton icon={<ArrowLeft size={16} />} label="Turn left" onClick={onTurnLeft} />
      <PadButton icon={<ArrowDown size={16} />} label="Shelf down" onClick={onMoveDown} disabled={shelf <= 0} />
      <PadButton icon={<ArrowRight size={16} />} label="Turn right" onClick={onTurnRight} />
    </div>
    <p className="shelf-key-hint-foot">Arrow keys work too</p>
  </aside>;
}
