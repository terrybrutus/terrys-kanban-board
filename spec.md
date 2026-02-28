# Kanban Board

## Current State

Full-featured multi-project Kanban board with:
- Multi-project support with dropdown switcher
- Drag-and-drop cards and columns
- Users + PIN system (master admin, admin, regular users)
- Security question for master admin PIN recovery
- Tags (admin-configurable, per-project, visible on card face)
- Card due dates with overdue indicator
- Card comments thread
- Per-card status history (collapsible in modal)
- Checklists with progress indicator
- Card archiving + restore
- Filter bar (assignee, tag, date range, unassigned, text search, archived toggle)
- Saved filter presets
- Multi-select + multi-move within a column
- Quick-add with shortcuts (#tag, @user, due:)
- Bulk card import (per-column, option 3 placement)
- Export/import with versioned JSON schema
- Swimlanes (optional, off by default)
- Dashboard tab with clickable summary stats
- Column count badges, quick user-switcher in header

Backend: `Card` type already includes `createdAt : Int` (nanosecond timestamp, set at creation time).

## Requested Changes (Diff)

### Add

**Feature 20 — Card Creation Dates**
- Show `createdAt` timestamp in the card detail modal (read-only, below due date or in a "Created" field)
- Show a small "Created: MMM DD" label on the card face (alongside the due date chip)
- `createdAt` is already stored in the backend — no backend change needed
- `createdAt` is already filterable via the existing date-range filter (dateField = "createdAt") — no change needed
- `createdAt` is already exported/imported via the JSON schema — no change needed

**Feature 21 — Delete Confirmation**
- When the trash icon is clicked on a card, show a confirmation dialog instead of immediately deleting
- Dialog title: "Delete this card?"
- Dialog message: "This will permanently delete the card and cannot be undone."
- Primary action (preferred): "Archive" — archives the card instead of deleting
- Secondary action: "Delete permanently" — deletes the card; requires an explicit click (not Enter by default)
- Cancel button always present
- Archive action is preferred since Feature 18 (archive) is already implemented
- No backend changes needed

**Feature 22 — Undo / Redo**
- Add Undo and Redo buttons to the board header (session-only, not synced across users)
- Supported actions:
  - Move card between columns (via drag or arrow buttons)
  - Edit card title/description
  - Change assignee
  - Add/remove tags
  - Set/change due date
  - Archive/unarchive
  - Delete is NOT included in undo (too complex to reverse safely)
- Show a tooltip on hover: "Undo: Move card" / "Redo: Edit title"
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo) — optional but preferred
- Implementation: maintain an undoStack and redoStack in React state; each undoable action pushes a snapshot of the relevant card state before the change; undo re-runs the inverse operation through normal API calls
- Stack is session-only and clears on project switch
- Max stack depth: 50 items

### Modify

- `KanbanCard.tsx`: add "Created" label on card face; add createdAt display in modal; replace direct `onDelete` call with confirmation dialog that offers Archive vs. Delete permanently
- `App.tsx` or separate `useUndoRedo.ts` hook: implement undo/redo stack; wire all undoable mutations to push state before executing; add Undo/Redo buttons to the board header

### Remove

Nothing removed.

## Implementation Plan

1. **Feature 20 — Created timestamp display**
   - In `KanbanCard.tsx` card face: add a small chip showing "Created: MMM DD" using the existing `card.createdAt` bigint field (same conversion as due date: divide by 1_000_000 for ms)
   - In `KanbanCard.tsx` modal: add a read-only "Created" field displaying the full date/time

2. **Feature 21 — Delete confirmation dialog**
   - In `KanbanCard.tsx`: intercept the trash button click; instead of calling `onDelete` directly, open a local confirmation dialog
   - Dialog offers: "Archive" (primary, calls `onArchive`), "Delete permanently" (destructive secondary, calls `onDelete`), "Cancel"
   - "Delete permanently" button must NOT be the default focused element (prevent Enter-to-delete)

3. **Feature 22 — Undo/Redo**
   - Create `src/hooks/useUndoRedo.ts` with `undoStack`, `redoStack`, `pushUndo(action)`, `undo()`, `redo()` 
   - Each entry in the stack is: `{ label: string, undoFn: () => Promise<void> }`
   - Wrap the following handlers in `App.tsx` to push undo entries before executing:
     - `handleMoveCard` → undo: move card back to original column + position
     - `handleUpdateCard` → undo: restore old title/description
     - `handleAssignCard` → undo: restore old assigneeId
     - `handleUpdateCardTags` → undo: restore old tags
     - `handleUpdateCardDueDate` → undo: restore old dueDate
     - `handleArchiveCard` → undo: restore (unarchive)
     - `handleRestoreCard` → undo: archive again
   - Add Undo/Redo buttons in the board header (only visible on the "board" tab)
   - Add keyboard shortcut listeners (Ctrl+Z, Ctrl+Shift+Z)
   - Clear undo/redo stacks when active project changes

## Phase Progress

- [x] Phase 0 — Initial build (columns, cards, drag-drop, users, PIN, activity)
- [x] Phase 1 — Foundation (stable storage, multi-project, admin roles, tags, due dates, card count, quick-switcher)
- [x] Phase 2 — Card power (comments, per-card history, multi-select/multi-move)
- [x] Phase 3 — Import/Export and filtering (versioned JSON, bulk import, filter bar, presets)
- [x] Feature 15 — Swimlanes (optional, off by default)
- [x] Feature 16 — Checklists
- [x] Feature 17 — Quick Add with shortcuts
- [x] Feature 18 — Archive cards
- [x] Feature 19 — Dashboard
- [ ] Feature 20 — Card creation dates (display createdAt)
- [ ] Feature 21 — Delete confirmation (Archive preferred, Delete permanently secondary)
- [ ] Feature 22 — Undo/Redo (session-only, 7 action types)

## Resuming in a New Session

Read this spec.md first. Then check which features are checked off above and which remain. Build only the unchecked items.
