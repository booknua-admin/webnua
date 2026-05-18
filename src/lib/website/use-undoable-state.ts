'use client';

// =============================================================================
// useUndoableState — a useState replacement with undo / redo history
// (Phase 6 · section-library uplift · editor undo/redo).
//
// Lean by design: history lives in memory only — no localStorage, no
// serialization. Because the editor mutates sections immutably, each history
// entry is just an array of mostly-shared object references, so 50 entries
// cost almost nothing. The stack is capped; nothing is persisted, so leaving
// the editor discards history (intended).
// =============================================================================

import { useCallback, useState } from 'react';

const HISTORY_LIMIT = 50;

export type UndoableState<T> = {
  value: T;
  /** Set a new value, pushing the current one onto the undo stack. */
  set: (next: T | ((prev: T) => T)) => void;
  /** Replace the value AND clear history (e.g. the editor's source changed). */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: T[]; present: T; future: T[] };

export function useUndoableState<T>(initial: T | (() => T)): UndoableState<T> {
  const [history, setHistory] = useState<History<T>>(() => ({
    past: [],
    present: typeof initial === 'function' ? (initial as () => T)() : initial,
    future: [],
  }));

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setHistory((h) => {
      const value =
        typeof next === 'function' ? (next as (prev: T) => T)(h.present) : next;
      if (value === h.present) return h;
      const past = [...h.past, h.present];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { past, present: value, future: [] };
    });
  }, []);

  const reset = useCallback((next: T) => {
    setHistory({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return {
        past: [...h.past, h.present],
        present: next,
        future: h.future.slice(1),
      };
    });
  }, []);

  return {
    value: history.present,
    set,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
