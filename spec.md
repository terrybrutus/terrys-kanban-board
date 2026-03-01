# Kanban Board

## Current State

Full-featured Kanban board with:
- Multi-project support with dropdown switcher
- Users + PIN auth (master admin, admins, regular users) with security question reset
- Drag-and-drop cards between columns; drag-and-drop column reordering
- Tags (admin-configurable, per-project), due dates, card creation timestamps
- Swimlanes (optional, off by default) per project
- Card archiving/restore, delete confirmation
- Card comments, per-card history (revisions), checklist items
- Multi-select within a column (checkbox, shift+click, ctrl+click, shift+A) + bulk move
- Filter bar (assignee, tags, date range, unassigned, text search) + saved presets
- Quick Add shorthand in column (one line per card, `#Tag`, `@User`, `due:` shortcuts)
- Bulk card import (JSON or plain text) triggered from column menu
- JSON export/import (replace/merge) with schema version
- Undo/Redo (Ctrl+Z/Ctrl+Shift+Z already wired for both Mac metaKey and Windows ctrlKey)
- Dashboard tab with project health summary
- Activity tab per project

Backend APIs available (see backend.d.ts):
- `updateCardSwimlane(cardId, swimlaneId | null, actorUserId)`
- `createCard(title, description|null, columnId, actorUserId, projectId)`
- `moveCard(cardId, targetColumnId, newPosition, actorUserId)`
- `deleteColumn(columnId, actorUserId)`

## Requested Changes (Diff)

### Add

**Feature 23 — Swimlane selection on create + drag between swimlanes**
- When swimlanes are enabled for the current project, card creation (normal "Add card" form + Quick Add) must offer a swimlane picker (dropdown of available swimlanes)
- Drag-and-drop: cards must be droppable from one swimlane row into another within the board. Moving a card to a different swimlane calls `updateCardSwimlane` and logs to activity + card history.

**Swimlane visual distinction**
- Use a slightly thicker divider line (border) between swimlane sections — the cleanest approach. No alternating background colors.

**Feature 24 — Column delete: immediate confirmation modal (Option B)**
- Clicking "Delete column" in the column dropdown opens a confirmation dialog immediately (no double-click workaround).
- If the column has cards, the dialog must also show a destination-column picker. User selects where to move the cards, then confirms. The bulk `moveCards` call runs first, then `deleteColumn`.
- If the column is empty, just confirm "Delete" with no destination picker.

**Feature 25 — macOS keyboard shortcuts (Cmd key)**
- Already implemented: `App.tsx` keyboard handler already checks `navigator.platform` and uses `metaKey` for Mac.
- No additional changes needed here — this is already done.

**Feature 26 — Quick Add: quoted multi-word @User and #Tag (Approach A)**
- Update `parseQuickAddLine` in `KanbanColumn.tsx` to support:
  - `@"Terry Brutus"` → assigns to user with name "Terry Brutus"
  - `#"Waiting for Client"` → applies tag with name "Waiting for Client"
- Quoted values (`"..."`) are matched first before falling back to single-word matching.
- Help tooltip in Quick Add panel updated to show quoted examples.

### Modify

- `KanbanColumn.tsx` — `handleDeleteColumn`: replace current "double-click with confirmDelete state" pattern with proper dialog-based confirmation. Add destination column picker when cards exist.
- `KanbanColumn.tsx` — `parseQuickAddLine`: add quoted-value regex before single-word regex for `@` and `#` shortcuts.
- `KanbanColumn.tsx` — Quick Add popover help content: add quoted syntax examples.
- `KanbanColumn.tsx` — "Add card" inline form: when swimlanesEnabled and swimlanes.length > 0, add a swimlane selector dropdown. On submit, call `createCard` then `updateCardSwimlane` with the selected swimlane.
- `KanbanColumn.tsx` — Quick Add handler: when swimlanesEnabled, add a swimlane selector before submitting (or a simple per-session default lane picker in the Quick Add panel).
- `KanbanColumn.tsx` / `App.tsx` — Swimlane drag-and-drop: enable dropping cards into different swimlane rows. Each swimlane section should act as a separate droppable zone. On drop between swimlanes, call `updateCardSwimlane`.
- `KanbanColumn.tsx` — Swimlane divider: replace the current thin `h-px bg-border/60` divider with a slightly thicker `h-[2px] bg-border` divider for clearer visual separation.

### Remove

- `KanbanColumn.tsx` — `confirmDelete` state and the "re-click to confirm" pattern in `handleDeleteColumn`.

## Implementation Plan

1. **Feature 26 parser fix** — Update `parseQuickAddLine` to extract quoted `@"..."` and `#"..."` before the single-word regex. Update help tooltip with examples like `@"Terry Brutus"` and `#"Waiting for Client"`.

2. **Swimlane visual** — In `KanbanColumn.tsx` swimlane header rendering, change the divider `div` from `h-px bg-border/60` to `h-[2px] bg-border` for a thicker, cleaner separator.

3. **Feature 24 — Column delete dialog** — Replace `confirmDelete` boolean state with a proper `Dialog` component. When the column has cards:
   - Show a destination column picker (`Select` component with sibling columns).
   - "Move & Delete" button: calls `onMoveCards(allCardIds, destinationColumnId)` then `onDeleteColumn(column.id)`.
   When empty: just show "Delete" confirmation with no picker.

4. **Feature 23 — Swimlane picker on card create** — In the "Add card" inline form, when `swimlanesEnabled && swimlanes.length > 0`, render a swimlane `Select` dropdown below the description textarea. After `onAddCard` returns the new card ID, call `onUpdateCardSwimlane(newCardId, selectedSwimlaneId)`. The `handleAddCard` in `App.tsx` returns the card ID already from `createCard`, so pass it through.
   - Note: `handleAddCard` currently returns `void`. Change it to return `bigint` (the new card ID) so the column can chain the swimlane call.

5. **Feature 23 — Quick Add swimlane picker** — In the Quick Add panel, when `swimlanesEnabled && swimlanes.length > 0`, add a "Lane:" select dropdown above the textarea. All cards created in that Quick Add batch go into the selected swimlane. After `onQuickAdd` returns the card ID, call `updateCardSwimlane`. Update `handleQuickAdd` in `App.tsx` to return the card ID and accept an optional `swimlaneId`.

6. **Feature 23 — Swimlane drag-and-drop** — Each swimlane group rendered in the column should have its own droppable zone ID (e.g., `swimlane-{swimlaneId}-col-{columnId}`). When a card is dropped into a different swimlane zone (same or different column), call `updateCardSwimlane` in addition to any column move. Update `handleDragEnd` in `App.tsx` to detect swimlane-zone drops and fire `handleUpdateCardSwimlane`.

7. **Validate and build** — Run typecheck, lint, and build to confirm no type errors.
