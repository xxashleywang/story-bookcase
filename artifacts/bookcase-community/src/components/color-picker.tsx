import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#B9A48A';
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 30, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  presets: string[];
  title: string;
  trigger: ReactNode;
  children?: ReactNode;
  onOpen?: () => void;
};

export function ColorPicker({ value, onChange, presets, title, trigger, children, onOpen }: ColorPickerProps) {
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(value));
  const [hexDraft, setHexDraft] = useState(value.toUpperCase());

  useEffect(() => {
    setHexDraft(value.toUpperCase());
    if (hslToHex(hsl) !== value.toUpperCase()) setHsl(hexToHsl(value));
    // Only react to outside changes in the selected color.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (next: Hsl) => {
    setHsl(next);
    onChange(hslToHex(next));
  };
  const commitHex = (raw: string) => {
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toUpperCase());
    else setHexDraft(value.toUpperCase());
  };

  return (
    <Popover onOpenChange={(open) => { if (open) onOpen?.(); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="tw-picker"
        style={{ '--picker-hue': hsl.h, '--picker-sat': `${hsl.s}%` } as CSSProperties}
      >
        <div className="tw-picker-head">
          <span className="tw-picker-preview" style={{ background: value }} />
          <div>
            <b>{title}</b>
            <label className="tw-picker-hex">
              <span>#</span>
              <input
                aria-label={`${title} hex code`}
                value={hexDraft.replace('#', '')}
                maxLength={6}
                spellCheck={false}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={(e) => commitHex(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitHex(e.currentTarget.value); }}
              />
            </label>
          </div>
        </div>
        <div className="tw-picker-presets">
          {presets.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Use ${hex}`}
              className={hex.toUpperCase() === value.toUpperCase() ? 'active' : ''}
              style={{ background: hex }}
              onClick={() => onChange(hex.toUpperCase())}
            />
          ))}
        </div>
        <label className="tw-picker-slider">
          <span>Hue</span>
          <input
            type="range" min={0} max={359} value={hsl.h}
            className="hue"
            onChange={(e) => update({ ...hsl, h: Number(e.target.value), s: Math.max(hsl.s, 18) })}
          />
        </label>
        <label className="tw-picker-slider">
          <span>Richness</span>
          <input
            type="range" min={0} max={100} value={hsl.s}
            className="sat"
            onChange={(e) => update({ ...hsl, s: Number(e.target.value) })}
          />
        </label>
        <label className="tw-picker-slider">
          <span>Light</span>
          <input
            type="range" min={8} max={96} value={hsl.l}
            className="light"
            onChange={(e) => update({ ...hsl, l: Number(e.target.value) })}
          />
        </label>
        {children}
      </PopoverContent>
    </Popover>
  );
}
