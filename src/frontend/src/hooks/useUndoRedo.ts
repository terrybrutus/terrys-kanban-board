import { useCallback, useRef, useState } from "react";

export interface UndoAction {
  label: string;
  undoFn: () => Promise<void>;
  redoFn?: () => Promise<void>;
}

export interface RedoAction {
  label: string;
  redoFn: () => Promise<void>;
}

const MAX_STACK = 50;

export function useUndoRedo() {
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<RedoAction[]>([]);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [redoLabel, setRedoLabel] = useState<string | null>(null);

  const sync = useCallback(() => {
    const u = undoStackRef.current;
    const r = redoStackRef.current;
    setUndoLabel(u.length > 0 ? u[u.length - 1].label : null);
    setRedoLabel(r.length > 0 ? r[r.length - 1].label : null);
  }, []);

  const pushUndo = useCallback(
    (action: UndoAction, redoAction?: RedoAction) => {
      undoStackRef.current.push(action);
      if (undoStackRef.current.length > MAX_STACK) {
        undoStackRef.current.shift();
      }
      // Pushing a new action clears the redo stack (unless we're redoing)
      if (!redoAction) {
        redoStackRef.current = [];
      }
      sync();
    },
    [sync],
  );

  const undo = useCallback(async () => {
    const action = undoStackRef.current.pop();
    if (!action) return;
    sync();
    // If the action has a redoFn, push it to the redo stack
    if (action.redoFn) {
      redoStackRef.current.push({
        label: action.label,
        redoFn: action.redoFn,
      });
      sync();
    }
    await action.undoFn();
  }, [sync]);

  const redo = useCallback(async () => {
    const action = redoStackRef.current.pop();
    if (!action) return;
    sync();
    await action.redoFn();
  }, [sync]);

  const clearAll = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    sync();
  }, [sync]);

  return { pushUndo, undo, redo, clearAll, undoLabel, redoLabel };
}
