import { X } from 'lucide-react';
import type { Ref } from 'react';

const DIRS = [['F', 'Front'], ['L', 'Left'], ['B', 'Back'], ['R', 'Right']] as const;

type Props = {
  open: boolean;
  selected: number;
  dirs: string[];
  onDirection: (dir: string) => void;
  onSelect: (index: number) => void;
  onClose: () => void;
  containerRef?: Ref<HTMLDivElement>;
};

export function ShelfEditor({ open, selected, dirs, onDirection, onSelect, onClose, containerRef }: Props) {
  const count = dirs.length;
  const has = selected >= 0 && selected < count;
  return (
    <div ref={containerRef} className={`shelf-editor ${open && has ? 'open' : ''}`} role="group" aria-label="Shelf direction editor" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown">
      {!has ? <p className="shelf-empty">Select a shelf.</p> : <>
        <div className="shelf-editor-head">
          <div className="selected-shelf">{selected + 1}<small>of {count}, from bottom</small></div>
          <button type="button" className="icon-button shelf-close" aria-label="Close shelf editor" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="segment dir-buttons">
          {DIRS.map(([dir, label]) => (
            <button type="button" key={dir} aria-pressed={dirs[selected] === dir} className={dirs[selected] === dir ? 'active' : ''} onClick={() => onDirection(dir)}>{label}</button>
          ))}
        </div>
        <div className="step-buttons">
          <button type="button" className="button light small" aria-keyshortcuts="ArrowDown" disabled={selected <= 0} onClick={() => onSelect(selected - 1)}>Previous shelf</button>
          <button type="button" className="button light small" aria-keyshortcuts="ArrowUp" disabled={selected >= count - 1} onClick={() => onSelect(selected + 1)}>Next shelf</button>
        </div>
      </>}
    </div>
  );
}
