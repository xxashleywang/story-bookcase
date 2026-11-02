import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { LoaderCircle, Trash2, Undo2, X } from 'lucide-react';
import { photoRemovalPlan } from '@/lib/account';
import type { Build, BuildConfiguration, BuildInput, BuildUpdate } from '@workspace/api-client-react';
import { useCreateBuild, useRequestUploadUrl } from '@workspace/api-client-react';
import { PhotoUploader, usePhotoItems } from '@/components/photo-uploader';
import type { PhotoItem } from '@/components/photo-uploader';
import { MAX_PHOTOS, createPayload, safePhotos, updatePayload, validateShare } from '@/lib/community';
import { trackEvent } from '@/lib/analytics';

const FOCUSABLE = 'button:not(:disabled),[href],input:not(:disabled):not([tabindex="-1"]),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])';

/** Traps Tab inside the dialog, closes on Escape (unless busy) and restores focus to the opener. */
export function useDialogFocus(ref: React.RefObject<HTMLElement | null>, onClose: () => void, busy: boolean) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const initialFocus = node?.querySelector<HTMLElement>('[data-autofocus]') || node;
    initialFocus?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!node) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!busyRef.current) closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [ref]);
}

function useUploadPhotos() {
  const requestUpload = useRequestUploadUrl();
  const requestRef = useRef(requestUpload.mutateAsync);
  requestRef.current = requestUpload.mutateAsync;
  return async (items: PhotoItem[], onProgress: (text: string) => void) => {
    const paths: string[] = [];
    for (const [i, { file }] of items.entries()) {
      onProgress(`Uploading photo ${i + 1} of ${items.length}…`);
      const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
      const signed = await requestRef.current({ data: { name: file.name.slice(0, 180) || 'photo', size: file.size, contentType } });
      const upload = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!upload.ok) throw new Error(`Could not upload ${file.name}. Check your connection and try again.`);
      paths.push(signed.objectPath);
    }
    return paths;
  };
}

function errorText(error: unknown, fallback: string) {
  const data = (error as { data?: { error?: string } })?.data;
  if (data?.error) return data.error;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PublishDialog({ close, blueprint, attachByDefault, blueprintPreview, onSaved, source }: {
  close: () => void; blueprint: BuildConfiguration | null; attachByDefault: boolean; blueprintPreview?: ReactNode; onSaved: (build: Build) => void;
  source: 'gallery' | 'playroom';
}) {
  const create = useCreateBuild();
  const upload = useUploadPhotos();
  const photos = usePhotoItems();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attach, setAttach] = useState(!!blueprint && attachByDefault);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLFormElement>(null);
  useDialogFocus(ref, close, busy);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (photos.errors.length) { setError('Fix the photo selection above before sharing.'); return; }
    const invalid = validateShare({ title, photoCount: photos.items.length });
    if (invalid) { setError(invalid); return; }
    setError(''); setBusy(true);
    try {
      const photoPaths = await upload(photos.items, setProgress);
      setProgress('Publishing…');
      const data = createPayload({ title, description, photoPaths, blueprint: attach ? blueprint : null }) as BuildInput;
      const build = await create.mutateAsync({ data });
      trackEvent('room_published', { source, type: build.configuration ? 'blueprint_backed' : 'photo_only' });
      onSaved(build); close();
    } catch (e) {
      setError(errorText(e, 'Sharing did not work. Your photos are still here; try again.'));
      setProgress('');
    } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
    <form ref={ref} className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title" aria-busy={busy} onSubmit={submit} noValidate tabIndex={-1}>
      <div className="modal-head"><div><span className="eyebrow">Show us the room</span><h2 id="share-title">Share your room</h2></div>
        <button type="button" aria-label="Close" className="icon-button" onClick={close} disabled={busy} data-testid="button-close-share"><X size={18} /></button></div>
      <PhotoUploader items={photos.items} errors={photos.errors} onAdd={photos.add} onRemove={photos.remove} disabled={busy} progress={busy ? progress : ''} />
      <div className="form-grid">
        <div className="field full"><label htmlFor="share-title-input">Title</label>
          <input id="share-title-input" data-autofocus data-testid="input-share-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="The reading corner, finally" /></div>
        <div className="field full"><label htmlFor="share-description">A few words about it <span className="optional">optional</span></label>
          <textarea id="share-description" data-testid="input-share-description" maxLength={1200} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} placeholder="What's on the shelves, where the light comes from, what you'd do again." /></div>
      </div>
      {blueprint && <label className={`blueprint-toggle ${attach ? 'on' : ''}`}>
        <input type="checkbox" checked={attach} disabled={busy} onChange={(e) => setAttach(e.target.checked)} data-testid="checkbox-attach-blueprint" />
        <span className="blueprint-preview" aria-hidden="true">{blueprintPreview}</span>
        <span><b>Attach my current blueprint</b><small>Optional. Others can open your exact shelf arrangement, size, finish, wall and floor in their Playroom.</small></span>
        <i className="toggle" aria-hidden="true" />
      </label>}
      {error && <p className="status error" role="alert" data-testid="status-share-error">{error}</p>}
      <div className="form-actions"><button type="button" className="button light" onClick={close} disabled={busy}>Cancel</button>
        <button className="button coral" disabled={busy} data-testid="button-publish">{busy ? <><LoaderCircle size={15} className="spin" />Sharing…</> : 'Share to the gallery'}</button></div>
    </form>
  </div>;
}

export function EditBuildDialog({ build, close, onSave, onDelete }: { build: Build; close: () => void; onSave: (data: BuildUpdate) => Promise<unknown>; onDelete?: () => void }) {
  const upload = useUploadPhotos();
  const photos = usePhotoItems();
  const existing = safePhotos(build);
  const hadBlueprint = !!build.configuration;
  const [title, setTitle] = useState(build.title);
  const [description, setDescription] = useState(build.description || '');
  const [removeBlueprint, setRemoveBlueprint] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState<string[]>([]);
  const [asking, setAsking] = useState<string | null>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLFormElement>(null);
  useDialogFocus(ref, close, busy);
  useEffect(() => {
    if (!asking) return;
    askRef.current?.focus();
    const index = existing.indexOf(asking);
    return () => { queueMicrotask(() => ref.current?.querySelector<HTMLButtonElement>(`[data-photo-index="${index}"] button`)?.focus()); };
  }, [asking]);
  const askPlan = asking ? photoRemovalPlan(existing, [...removed, asking]) : null;
  const visible = existing.filter((p) => !removed.includes(p));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (replacing && photos.errors.length) { setError('Fix the photo selection above before saving.'); return; }
    const invalid = validateShare({ title, photoCount: replacing ? photos.items.length : 1 });
    if (invalid) { setError(invalid); return; }
    setError(''); setBusy(true);
    try {
      const replacement = replacing ? await upload(photos.items, setProgress) : null;
      setProgress('Saving…');
      const data = updatePayload({ title, description, removeBlueprint, hadBlueprint, replacementPhotoPaths: replacement }) as BuildUpdate;
      if (!replacing && removed.length) data.removePhotoPaths = removed;
      await onSave(data);
      close();
    } catch (e) {
      setError(errorText(e, 'Saving did not work. Try again.'));
      setProgress('');
    } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
    <form ref={ref} className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" aria-busy={busy} onSubmit={submit} noValidate tabIndex={-1}>
      <div className="modal-head"><div><span className="eyebrow">Keep it current</span><h2 id="edit-title">Edit your post</h2></div>
        <button type="button" className="icon-button" aria-label="Close" onClick={close} disabled={busy}><X size={18} /></button></div>
      <div className="form-grid">
        <div className="field full"><label htmlFor="edit-title-input">Title</label><input id="edit-title-input" data-autofocus maxLength={80} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field full"><label htmlFor="edit-description">A few words about it <span className="optional">optional</span></label><textarea id="edit-description" maxLength={1200} value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      {!replacing ? <div className="current-photos">
        <div className="current-photos-head"><b>Photos</b><span className="uploader-count">{visible.length} {visible.length === 1 ? 'photo' : 'photos'}{removed.length ? ` · ${removed.length} to remove` : ''}</span></div>
        <ul className="photo-strip editable" aria-label="Current photos">{existing.map((p, i) => {
          const gone = removed.includes(p);
          return <li key={`${p}-${i}`} data-photo-index={i} className={`${gone ? 'gone' : ''} ${asking === p ? 'asking' : ''}`}>
            <img src={`/api/storage${p}`} alt={`Current photo ${i + 1}${gone ? ', marked for removal' : ''}`} />
            {gone ? <button type="button" className="photo-chip" disabled={busy} onClick={() => setRemoved((r) => r.filter((x) => x !== p))} aria-label={`Keep photo ${i + 1}`}><Undo2 size={13} /></button>
              : <button type="button" className="photo-chip danger" disabled={busy} onClick={() => setAsking(p)} aria-label={`Remove photo ${i + 1}`} data-testid={`button-remove-photo-${i}`}><Trash2 size={13} /></button>}
          </li>;
        })}</ul>
        {asking && askPlan && <div className="inline-confirm" role="alertdialog" aria-labelledby="photo-confirm-title" aria-describedby="photo-confirm-body">
          {askPlan.removesLast ? <>
            <b id="photo-confirm-title">This is the last photo.</b>
            <p id="photo-confirm-body">A room post needs at least one photo. To take this one down, delete the whole post instead. Its blueprint goes with it.</p>
            <div className="inline-confirm-actions"><button ref={askRef} type="button" className="button light small" onClick={() => setAsking(null)}>Keep the photo</button>
              {onDelete && <button type="button" className="button danger small" onClick={() => { const del = onDelete; close(); del(); }} data-testid="button-delete-whole-post">Delete whole post</button>}</div>
          </> : <>
            <b id="photo-confirm-title">Remove photo {existing.indexOf(asking) + 1}?</b>
            <p id="photo-confirm-body">It comes off this post when you save. Until then you can undo it.</p>
            <div className="inline-confirm-actions"><button ref={askRef} type="button" className="button light small" onClick={() => setAsking(null)}>Keep it</button>
              <button type="button" className="button danger small" onClick={() => { setRemoved((r) => [...r, asking]); setAsking(null); }} data-testid="button-confirm-remove-photo">Remove photo</button></div>
          </>}
        </div>}
        <p className="uploader-help">{existing.length > MAX_PHOTOS ? `This post keeps all ${existing.length} photos unless you remove or replace them. New sets hold up to ${MAX_PHOTOS}.` : 'Remove single photos, or replace the whole set.'}</p>
        <button type="button" className="button light small" disabled={busy} onClick={() => { setRemoved([]); setAsking(null); setReplacing(true); }} data-testid="button-replace-photos">Replace photos</button>
      </div> : <>
        <PhotoUploader label="Replacement photos" items={photos.items} errors={photos.errors} onAdd={photos.add} onRemove={photos.remove} disabled={busy} progress={busy ? progress : ''} />
        <button type="button" className="button light small keep-photos" disabled={busy} onClick={() => { photos.clear(); setReplacing(false); }}>Keep current photos</button>
      </>}
      {hadBlueprint && <label className={`blueprint-toggle ${!removeBlueprint ? 'on' : ''}`}>
        <input type="checkbox" checked={!removeBlueprint} disabled={busy} onChange={(e) => setRemoveBlueprint(!e.target.checked)} data-testid="checkbox-keep-blueprint" />
        <span><b>Keep blueprint attached</b><small>{removeBlueprint ? 'The blueprint will be removed when you save. Your photos stay.' : 'Visitors can open it in their Playroom.'}</small></span>
        <i className="toggle" aria-hidden="true" />
      </label>}
      {error && <p className="status error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button light" onClick={close} disabled={busy}>Cancel</button>
        <button className="button coral" disabled={busy} data-testid="button-save-edit">{busy ? <><LoaderCircle size={15} className="spin" />Saving…</> : 'Save changes'}</button></div>
    </form>
  </div>;
}
