// =============================================================================
// insertAtCursor — click-to-insert helper for variable chips.
//
// Phase 8 · Session 3. Used by the automation action editor and the platform
// template editor: a click on a {{variable}} chip splices it at the textarea's
// current cursor, replacing any current selection, and leaves focus + caret
// where the inserted text ends.
//
// Pure on the (value, selectionStart, selectionEnd, insert) tuple — the
// callers wrap it with a ref + an onChange so the React state stays in sync.
// =============================================================================

export type InsertResult = {
  /** The next value to write back to the controlled textarea / input. */
  value: string;
  /** Cursor position to set after the next render — both selectionStart and
   *  selectionEnd land here (no residual selection). */
  cursor: number;
};

export function insertAtCursor(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): InsertResult {
  const start = Math.max(0, Math.min(selectionStart, current.length));
  const end = Math.max(start, Math.min(selectionEnd, current.length));
  const before = current.slice(0, start);
  const after = current.slice(end);
  return {
    value: before + insert + after,
    cursor: start + insert.length,
  };
}

/** Apply an `insertAtCursor` result to a textarea / input ref and write the
 *  value back via the provided setter. Focus + caret restore happens on the
 *  next animation frame so React's re-render lands first. */
export function applyInsertToField(
  field: HTMLTextAreaElement | HTMLInputElement | null,
  setValue: (next: string) => void,
  insert: string,
): void {
  if (!field) return;
  const result = insertAtCursor(
    field.value,
    field.selectionStart ?? field.value.length,
    field.selectionEnd ?? field.value.length,
    insert,
  );
  setValue(result.value);
  requestAnimationFrame(() => {
    field.focus();
    try {
      field.setSelectionRange(result.cursor, result.cursor);
    } catch {
      // Some input types (e.g. number) reject setSelectionRange — swallow.
    }
  });
}
