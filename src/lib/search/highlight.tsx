import type { ReactNode } from 'react';

/**
 * Wraps each case-insensitive occurrence of `query` inside `text` with a rust
 * highlight. Returns the original string untouched when `query` is empty or
 * has no match.
 */
export function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;

  const parts: ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  let cursor = 0;
  let markKey = 0;

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={markKey++} className="rounded-[3px] bg-rust-soft px-0.5 text-rust">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    cursor = idx + q.length;
  }

  return parts;
}
