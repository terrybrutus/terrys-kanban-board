import { useCallback, useRef, useState } from "react";
import type { Card, ColumnView, Swimlane } from "../backend.d";

export interface BoardSnapshot {
  cards: Card[];
  columns: ColumnView[];
  swimlanes: Swimlane[];
}

const MAX_UNDO = 10;

export function useUndoRedo() {
  const undoStack = useRef<BoardSnapshot[]>([]);
  const redoStack = useRef<BoardSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  /** Call this BEFORE any destructive action, passing current board state */
  const pushSnapshot = useCallback(
    (snapshot: BoardSnapshot) => {
      undoStack.current.push(snapshot);
      if (undoStack.current.length > MAX_UNDO) {
        undoStack.current.shift();
      }
      // Clear redo stack on new action
      redoStack.current = [];
      sync();
    },
    [sync],
  );

  /** Returns the previous snapshot (caller must apply it to the React Query cache) */
  const undo = useCallback((): BoardSnapshot | null => {
    const snap = undoStack.current.pop();
    if (!snap) return null;
    redoStack.current.push(snap);
    sync();
    return snap;
  }, [sync]);

  const redo = useCallback((): BoardSnapshot | null => {
    const snap = redoStack.current.pop();
    if (!snap) return null;
    undoStack.current.push(snap);
    sync();
    return snap;
  }, [sync]);

  const clearAll = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    sync();
  }, [sync]);

  return { pushSnapshot, undo, redo, clearAll, canUndo, canRedo };
}
