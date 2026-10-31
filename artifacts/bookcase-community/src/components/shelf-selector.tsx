import { useRef } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const LABELS: Record<string, string> = { F:'Front', L:'Left', B:'Back', R:'Right' };

export function ShelfSelector({ selected, dirs, onSelect, onSelectionCommit }: {
  selected: number;
  dirs: string[];
  onSelect: (index: number) => void;
  onSelectionCommit: () => void;
}) {
  const committed = useRef(false);
  return <div className="shelf-select">
    <span id="shelf-selector-label">Select shelf</span>
    <Select value={String(selected)} onValueChange={(value) => {
      committed.current = Number(value) >= 0;
      onSelect(Number(value));
    }}>
      <SelectTrigger aria-labelledby="shelf-selector-label" className="shelf-select-trigger">
        <SelectValue placeholder="Select a shelf" />
      </SelectTrigger>
      <SelectContent className="shelf-select-menu" position="popper" sideOffset={6} collisionPadding={12}
        onCloseAutoFocus={(event) => {
          if (!committed.current) return;
          committed.current = false;
          event.preventDefault();
          onSelectionCommit();
        }}>
        <SelectItem className="shelf-select-option" value="-1">None</SelectItem>
        {dirs.map((dir, i) => <SelectItem key={i} className="shelf-select-option" value={String(i)}>
          <span className="shelf-option-content"><span>Shelf {i + 1}</span><span className="shelf-option-detail">
            {i === 0 ? 'Bottom · ' : i === dirs.length - 1 ? 'Top · ' : ''}{LABELS[dir]}
          </span></span>
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
