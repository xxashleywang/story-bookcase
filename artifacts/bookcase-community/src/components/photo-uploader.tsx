import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { MAX_PHOTOS, PHOTO_TYPES, formatBytes, mergePhotoSelection, photoCountLabel } from '@/lib/community';

export type PhotoItem = { id: string; file: File; url: string };

/** Owns preview URLs for a list of picked files and revokes them on removal/unmount. */
export function usePhotoItems() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const live = useRef<PhotoItem[]>([]);
  live.current = items;
  useEffect(() => () => live.current.forEach((item) => URL.revokeObjectURL(item.url)), []);
  const add = (files: File[]) => {
    const { accepted, errors: next } = mergePhotoSelection(live.current.map((i) => i.file), files);
    const added = accepted.map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`, file, url: URL.createObjectURL(file) }));
    setItems((old) => [...old, ...added]);
    setErrors(next);
  };
  const remove = (id: string) => {
    setItems((old) => {
      const gone = old.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return old.filter((i) => i.id !== id);
    });
    setErrors([]);
  };
  const clear = () => {
    live.current.forEach((item) => URL.revokeObjectURL(item.url));
    setItems([]); setErrors([]);
  };
  return { items, errors, add, remove, clear, setErrors };
}

export function PhotoUploader({ items, errors, onAdd, onRemove, disabled, label = 'Room photos', progress }: {
  items: PhotoItem[]; errors: string[]; onAdd: (files: File[]) => void; onRemove: (id: string) => void;
  disabled?: boolean; label?: string; progress?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const helpId = useId();
  const errorId = useId();
  const full = items.length >= MAX_PHOTOS;
  const pick = (list: FileList | null) => { if (list?.length) onAdd(Array.from(list)); };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files); };
  return <fieldset className={`uploader ${dragging ? 'dragging' : ''}`} disabled={disabled}
    onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    <legend className="uploader-legend">{label}</legend>
    <div className="uploader-bar">
      <button type="button" className="button coral small" data-testid="button-add-photos" disabled={disabled || full}
        aria-describedby={`${helpId} ${errors.length ? errorId : ''}`} onClick={() => inputRef.current?.click()}>
        <ImagePlus size={15} /> Add photos
      </button>
      <span className="uploader-count" aria-live="polite" data-testid="text-photo-count">{photoCountLabel(items.length)}</span>
    </div>
    <p className="uploader-help" id={helpId}>Up to {MAX_PHOTOS} images, 12 MB each. JPEG, PNG, WebP or AVIF. You can also drop them here.</p>
    <input ref={inputRef} className="sr-only" type="file" tabIndex={-1} aria-hidden="true" multiple accept={PHOTO_TYPES.join(',')} data-testid="input-photos"
      onChange={(e) => { pick(e.currentTarget.files); e.currentTarget.value = ''; }} />
    {items.length > 0 ? <ul className="uploader-grid">
      {items.map((item, i) => <li key={item.id} className="uploader-thumb">
        <img src={item.url} alt={`Selected photo ${i + 1}: ${item.file.name}`} />
        {i === 0 && <span className="uploader-cover">Cover</span>}
        <span className="uploader-size">{formatBytes(item.file.size)}</span>
        <button type="button" className="uploader-remove" aria-label={`Remove ${item.file.name}`} data-testid={`button-remove-photo-${i}`} onClick={() => onRemove(item.id)}><X size={14} /></button>
      </li>)}
      {Array.from({ length: MAX_PHOTOS - items.length }, (_, i) => <li key={`slot-${i}`} className="uploader-slot" aria-hidden="true" />)}
    </ul> : <button type="button" className="uploader-empty" onClick={() => inputRef.current?.click()} tabIndex={-1} aria-hidden="true">
      <ImagePlus size={22} /><span>Your room, the way you live in it.</span>
    </button>}
    {progress && <p className="uploader-progress" role="status">{progress}</p>}
    {errors.length > 0 && <ul className="uploader-errors" id={errorId} role="alert" data-testid="status-photo-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
  </fieldset>;
}
