import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { MAX_PHOTOS, PHOTO_TYPES, formatBytes, mergePhotoSelection, photoCountLabel, withCoverFirst } from '@/lib/community';

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
  const makeCover = (id: string) => {
    setItems((old) => withCoverFirst(old, old.findIndex((item) => item.id === id)));
  };
  const clear = () => {
    live.current.forEach((item) => URL.revokeObjectURL(item.url));
    setItems([]); setErrors([]);
  };
  return { items, errors, add, remove, makeCover, clear, setErrors };
}

function PhotoTile({ item, index, cover, onMakeCover, onRemove }: {
  item: PhotoItem; index: number; cover: boolean; onMakeCover: (id: string) => void; onRemove: (id: string) => void;
}) {
  return <>
    <button type="button" className="uploader-pick" aria-pressed={cover}
      data-testid={cover ? 'button-cover-photo' : `button-make-cover-${index}`}
      aria-label={cover ? `Cover photo: ${item.file.name}` : `Make ${item.file.name} the cover`}
      onClick={() => { if (!cover) onMakeCover(item.id); }}>
      <img src={item.url} alt="" />
    </button>
    {cover && <span className="uploader-cover">Cover</span>}
    {cover && <span className="uploader-size">{formatBytes(item.file.size)}</span>}
    <button type="button" className="uploader-remove" aria-label={`Remove ${item.file.name}`} data-testid={`button-remove-photo-${index}`} onClick={() => onRemove(item.id)}><X size={14} /></button>
  </>;
}

export function PhotoUploader({ items, errors, onAdd, onRemove, onMakeCover, disabled, label = 'Photos', progress, compose = false }: {
  items: PhotoItem[]; errors: string[]; onAdd: (files: File[]) => void; onRemove: (id: string) => void; onMakeCover: (id: string) => void;
  disabled?: boolean; label?: string; progress?: string; compose?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const helpId = useId();
  const errorId = useId();
  const hintId = useId();
  const full = items.length >= MAX_PHOTOS;
  const empty = items.length === 0;
  const cover = items[0];
  const pick = (list: FileList | null) => { if (list?.length) onAdd(Array.from(list)); };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files); };
  return <fieldset className={`uploader ${dragging ? 'dragging' : ''} ${empty ? 'is-empty' : ''}`} disabled={disabled} aria-label={compose ? label : undefined}
    onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    {!compose && <legend className="uploader-legend">{label}</legend>}
    <div className="uploader-bar">
      <button type="button" className={`button coral ${empty ? '' : 'small'}`} data-testid="button-add-photos" disabled={disabled || full}
        data-autofocus={compose ? '' : undefined}
        aria-describedby={`${helpId} ${errors.length ? errorId : ''}`} onClick={() => inputRef.current?.click()}>
        <ImagePlus size={empty ? 18 : 15} /> Add photos
      </button>
      {!empty && <span className="uploader-count" aria-live="polite" data-testid="text-photo-count">{photoCountLabel(items.length)}</span>}
    </div>
    <p className={empty ? 'sr-only' : 'uploader-help'} id={helpId}>Up to {MAX_PHOTOS} images, 12 MB each. JPEG, PNG, WebP or AVIF. You can also drop them here.</p>
    <input ref={inputRef} className="sr-only" type="file" tabIndex={-1} aria-hidden="true" multiple accept={PHOTO_TYPES.join(',')} data-testid="input-photos"
      onChange={(e) => { pick(e.currentTarget.files); e.currentTarget.value = ''; }} />
    {cover && <div className="uploader-stage" role="group" aria-label="Photos. The largest is the cover." aria-describedby={items.length > 1 ? hintId : undefined}>
      {items.length > 1 && <p className="uploader-cover-hint" id={hintId}>Tap a photo to make it the cover.</p>}
      <div className="uploader-hero">
        <PhotoTile item={cover} index={0} cover onMakeCover={onMakeCover} onRemove={onRemove} />
      </div>
      {items.length > 1 && <ul className="uploader-rest">
        {items.slice(1).map((item, i) => <li key={item.id} className="uploader-mini">
          <PhotoTile item={item} index={i + 1} cover={false} onMakeCover={onMakeCover} onRemove={onRemove} />
        </li>)}
      </ul>}
    </div>}
    {progress && <p className="uploader-progress" role="status">{progress}</p>}
    {errors.length > 0 && <ul className="uploader-errors" id={errorId} role="alert" data-testid="status-photo-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
  </fieldset>;
}
