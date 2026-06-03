"use client";

import { useCallback, useRef, useState } from "react";

export interface UndoControls {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface Stack<T> {
  past: T[];
  present: T;
  future: T[];
}

const MAX_HISTORY = 100;
// Rapid changes (e.g. a trim drag) within this window collapse into one undo step.
const COALESCE_MS = 500;

/**
 * `useState` with an undo/redo history. The setter accepts a value or updater,
 * just like useState; consecutive changes inside COALESCE_MS merge into a single
 * history entry so a drag is one undo, not fifty.
 */
export function useUndoable<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void, UndoControls] {
  const [stack, setStack] = useState<Stack<T>>(() => ({
    past: [],
    present: typeof initial === "function" ? (initial as () => T)() : initial,
    future: [],
  }));
  const lastTs = useRef(0);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    // Decide coalescing OUTSIDE the reducer so the reducer stays pure — React
    // StrictMode double-invokes reducers, and a side-effect here (mutating the
    // timestamp ref) would make the replay see a ~0ms delta and wrongly coalesce,
    // dropping the first checkpoint.
    const now = performance.now();
    const coalesce = now - lastTs.current < COALESCE_MS;
    lastTs.current = now;
    setStack((s) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(s.present) : next;
      if (Object.is(value, s.present)) return s;
      if (coalesce) {
        // Replace the present without recording a new checkpoint.
        return { past: s.past, present: value, future: [] };
      }
      const past = [...s.past, s.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    lastTs.current = 0; // the next edit after an undo always checkpoints
    setStack((s) => {
      if (s.past.length === 0) return s;
      const present = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present, future: [s.present, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    lastTs.current = 0;
    setStack((s) => {
      if (s.future.length === 0) return s;
      const present = s.future[0];
      return { past: [...s.past, s.present], present, future: s.future.slice(1) };
    });
  }, []);

  return [
    stack.present,
    set,
    { undo, redo, canUndo: stack.past.length > 0, canRedo: stack.future.length > 0 },
  ];
}
