# Kanban Board

## Current State
Version 23 deployed. Full-featured Kanban board with multi-project support, cards, columns, tags, users, swimlanes, undo/redo, dashboard, tutorial overlay. Four critical bugs remain:

1. **Tutorial overlay**: target element not brought to foreground (no z-index elevation), callout line uses white on light background (not WCAG), tooltip boxes overlap the element they point to, line anchor goes to edge not center of tooltip, tooltip is not offset enough away from target.

2. **Cards disappearing on multi-move**: `moveCards` backend function reads `targetColumn` once and clones its `cardIds` once per loop iteration using the same stale reference — so each card overwrites the previous, leaving only the last card in the target.

3. **Undo/Redo broken**: `handleDeleteCard` and `handleMoveCards` (bulk move) never call `pushUndo`, so undo stack is empty after these operations. Undo button stays unclickable.

4. **Column delete broken**: Backend `deleteColumn` deletes any cards still in the column. When destination migration fails or is skipped, those cards are permanently lost. Undo re-creates the column but can't restore deleted cards. Also `moveCards` bug (issue #2) means migration itself loses cards.

## Requested Changes (Diff)

### Add
- Tutorial: cutout/highlight effect so target element visually lifts above dimmed overlay (mix-blend or z-index elevation + bright ring)
- Tutorial: WCAG-compliant callout line color (dark on light: use `hsl(var(--foreground))` or a strong blue)
- Tutorial: tooltip positioned with adequate gap from target (at least 40-60px offset), never overlapping target element
- Tutorial: callout line goes from center-edge of tooltip to center of target element
- Tutorial: pointer dot lands on edge/boundary of target, not on text content inside it
- Undo entry for `deleteCard` (undo = restore card, redo = delete again)
- Undo entry for `handleMoveCards` / bulk move (undo = move back to original columns, redo = move forward again)

### Modify
- **Backend `moveCards`**: re-fetch `targetColumn` from `columns` store inside each loop iteration (not once before the loop) so accumulated card IDs are read fresh each time
- **Backend `deleteColumn`**: before deletion, move all remaining cards to a fallback column OR preserve them in an "orphan" state; do NOT delete cards when column is deleted if `moveCards` was supposed to handle migration already
- **Frontend `handleDeleteColumn`**: await `moveCards` fully, then refresh columns/cards query before calling `deleteColumn`, with a longer settle delay (500ms); capture full card list snapshot for undo
- **Frontend `handleMoveCards`**: add `pushUndo` after success with original column IDs per card stored in snapshot
- **Frontend `handleDeleteCard`**: add `pushUndo` after success (undo = recreate card is impossible without backend support; instead, use archive/restore as a proxy — archive on delete, restore on undo, if backend supports it; otherwise skip undo for permanent delete but at minimum make the button reflect reality)
- **Tutorial `TutorialCalloutLine`**: change `stroke="white"` to `stroke="#1d4ed8"` (blue-700, WCAG contrast on beige/white backgrounds)
- **Tutorial `TutorialOverlay`**: add logic to elevate target element z-index while step is active; increase placement offset from `padding/2` to `56px`; compute `tooltipAnchor` as the side-center of tooltip (not top/bottom edge) so line meets tooltip at its wall
- **Tutorial step placements**: audit steps where tooltip currently overlaps target — especially QuickAdd (step 6), Cards, Columns steps — and switch placements to ensure tooltip is on the far side

### Remove
- Nothing removed

## Implementation Plan
1. Fix Motoko `moveCards` — re-fetch target column inside loop
2. Fix Motoko `deleteColumn` — do not delete cards; move remaining ones to first available sibling or leave with null columnId
3. Frontend: fix `handleDeleteColumn` — longer settle, invalidate queries before deleting
4. Frontend: add `pushUndo` to `handleMoveCards`
5. Frontend: add `pushUndo` to `handleDeleteCard` (using archive/restore pair)
6. Frontend: fix tutorial overlay — WCAG line color, z-index elevation for target, tooltip offset, line anchor
7. Build and validate
