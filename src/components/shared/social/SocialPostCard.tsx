'use client';

// =============================================================================
// SocialPostCard — one post on the /social calendar.
//
// Approval-first: drafts carry Approve / Edit / Dismiss; approved posts show
// their publish time + can drop back to draft; published posts are read-only
// history; failed posts surface the error + a retry. Edit mode is inline
// (caption + hashtags + reschedule + photo) so a non-technical owner never
// leaves the card.
// =============================================================================

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { uploadAdImage } from '@/lib/integrations/meta-ads/upload-ad-image';
import { useUpdateSocialPost } from '@/lib/social/queries';
import { POST_KIND_LABEL, type SocialPostKind, type SocialPostRow } from '@/lib/social/types';
import { cn } from '@/lib/utils';

const STATUS_PILL: Record<SocialPostRow['status'], { label: string; cls: string }> = {
  draft: { label: 'Draft — needs approval', cls: 'bg-rust-soft text-rust' },
  approved: { label: 'Scheduled', cls: 'bg-good-soft text-good' },
  published: { label: 'Published', cls: 'bg-good-soft text-good' },
  failed: { label: 'Failed', cls: 'bg-warn/10 text-warn' },
  dismissed: { label: 'Dismissed', cls: 'bg-paper-2 text-ink-quiet' },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** ISO → the value a datetime-local input wants (local wall clock). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SocialPostCard({ post }: { post: SocialPostRow }) {
  const update = useUpdateSocialPost();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [when, setWhen] = useState(isoToLocalInput(post.scheduled_for));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pill = STATUS_PILL[post.status];
  const kindLabel =
    POST_KIND_LABEL[post.post_kind as SocialPostKind] ?? POST_KIND_LABEL.tip;
  const busy = update.isPending || uploading;

  const mutate = (
    patch: Partial<Parameters<typeof update.mutate>[0]>,
    after?: () => void,
  ) => {
    setError(null);
    update.mutate(
      { id: post.id, clientId: post.client_id, ...patch },
      {
        onSuccess: after,
        onError: (e) => setError(e instanceof Error ? e.message : 'Something went wrong.'),
      },
    );
  };

  const handleSaveEdit = () => {
    mutate(
      {
        caption: caption.trim(),
        hashtags: hashtags.trim(),
        scheduledFor: new Date(when).toISOString(),
      },
      () => setEditing(false),
    );
  };

  const handlePhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    const result = await uploadAdImage(post.client_id, file);
    setUploading(false);
    if (!result.ok) {
      setError('Could not upload that photo — try a JPG or PNG under 4 MB.');
      return;
    }
    mutate({ imageUrl: result.data.url });
  };

  return (
    <article
      className={cn(
        'rounded-xl border bg-card px-4 py-4 md:px-5',
        post.status === 'failed' ? 'border-warn/40' : 'border-rule',
        post.status === 'published' && 'opacity-80',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
          {formatWhen(post.scheduled_for)}
        </span>
        <span className="rounded-full bg-paper-2 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
          {kindLabel}
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
            pill.cls,
          )}
        >
          {pill.label}
        </span>
        <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
          Facebook
        </span>
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-28 font-sans text-[13px]"
            aria-label="Post caption"
          />
          <Input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#hashtags"
            aria-label="Hashtags"
          />
          <label className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-soft">
            Posts on
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="h-9 rounded-md border border-rule bg-card px-2.5 text-[13px]"
            />
          </label>
        </div>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
            {post.caption}
          </p>
          {post.hashtags ? (
            <p className="mt-1.5 font-mono text-[11px] text-rust">{post.hashtags}</p>
          ) : null}
        </>
      )}

      {post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="mt-3 max-h-52 rounded-lg border border-rule object-cover"
        />
      ) : null}

      {post.status === 'failed' && post.publish_error ? (
        <p className="mt-2 rounded-md bg-warn/10 px-3 py-2 text-[12px] font-semibold text-warn">
          {post.publish_error}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] font-semibold text-warn">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button size="sm" disabled={busy || !caption.trim()} onClick={handleSaveEdit}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setCaption(post.caption);
                setHashtags(post.hashtags);
                setWhen(isoToLocalInput(post.scheduled_for));
              }}
            >
              Cancel
            </Button>
          </>
        ) : post.status === 'draft' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => mutate({ status: 'approved' })}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading…' : post.image_url ? 'Change photo' : '+ Photo'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => mutate({ status: 'dismissed' })}>
              Dismiss
            </Button>
          </>
        ) : post.status === 'approved' ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate({ status: 'draft' })}>
              Back to draft
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => mutate({ status: 'dismissed' })}>
              Dismiss
            </Button>
          </>
        ) : post.status === 'failed' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => mutate({ status: 'approved' })}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => mutate({ status: 'dismissed' })}>
              Dismiss
            </Button>
          </>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePhoto(file);
          e.target.value = '';
        }}
      />
    </article>
  );
}
