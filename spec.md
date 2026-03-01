# Kanban Board

## Current State

Full-featured Kanban board with:
- Multi-project support with dropdown switcher
- Columns, cards, drag-and-drop (card and column reorder)
- Swimlanes (optional per project, off by default) — rendered as horizontal bands within columns
- Users, admin/master-admin roles, PIN auth, quick user switcher in header
- Tags (per project, admin-configurable), due dates, assignees
- Card comments, per-card history (revisions), checklists
- Multi-select within a column (checkbox, shift+click, ctrl+click, Shift+A)
- Multi-move toolbar: only "Move to column…" currently in the toolbar
- Bulk card import (per column, inline panel)
- Filter bar + saved filter presets
- Export/import JSON (versioned schema)
- Dashboard tab, Activity tab
- Undo/Redo (session-only, Ctrl/Cmd+Z)
- Manual refresh button in header
- Archive/restore cards

## Requested Changes (Diff)

### Add

1. **Swimlane visual distinction** — make swimlane rows clearly distinguishable. Apply alternating subtle background tints on even/odd swimlane rows (e.g. `bg-muted/30` on even, transparent on odd), PLUS keep the existing thicker divider line. Also give the swimlane header row a slightly more prominent background so the label band is clearly visible as a section header.

2. **Bulk edit toolbar expansion** — when cards are selected (multi-select mode active), extend the existing toolbar from only "Move to…" to include:
   - Change Assignee (dropdown of all users + Unassigned)
   - Add Tag (dropdown of project tags — adds to each selected card without replacing existing)
   - Remove Tag (dropdown of project tags — removes from each selected card)
   - Set Due Date (date input)
   - Archive (archives all selected cards)
   All bulk actions call the existing per-card mutation for each selected card, clear the selection on success, and log in activity/card history via the normal mutation path.

3. **Manual refresh button** — a small refresh icon button in the header (near the project dropdown or Undo/Redo area) that invalidates all active queries and refetches board data. Uses `queryClient.invalidateQueries()`.

### Modify

4. **Swimlane card order scoping fix** — when a card is dropped into a swimlane zone, the position recalculation must be scoped only to cards sharing the same `swimlaneId` in the target column, not all cards in the column. This fixes the "third card kicks out existing cards" bug.
   - In `App.tsx` `handleDragEnd`, when processing a `swimlane-zone` drop: filter the column's cards to only those with the matching `swimlaneId`, compute the new position as the length of that scoped list (or the correct insertion index), then call `moveCard` with that scoped position.
   - The swimlane assignment (`updateCardSwimlane`) is called first if the card is changing swimlanes, then `moveCard` with the corrected position.

### Remove

Nothing removed.

## Implementation Plan

1. **KanbanColumn.tsx — swimlane visual distinction**
   - In `groupCardsBySwimlane` render loop, apply alternating `bg-muted/20` (even index) vs transparent (odd index) background to each swimlane section wrapper `<div>`
   - Give the swimlane header band (`flex items-center gap-2 mb-1.5 px-1`) a `bg-muted/30 rounded-md px-2 py-1` so it reads as a label bar
   - Keep the existing `h-[2px] bg-border/70` divider

2. **KanbanColumn.tsx — bulk edit toolbar**
   - Add state: `bulkAssigneeId`, `bulkTagId`, `bulkDueDate`, `isBulkActing`
   - In the existing `isSelectionMode` toolbar div, add four new action controls after "Move to…": Assignee dropdown, Add Tag dropdown, Remove Tag dropdown, Due Date input, Archive button
   - Each action iterates `selectedCardIds`, calls the appropriate prop callback per card, then calls `clearSelection()` and shows a toast

3. **App.tsx — manual refresh button**
   - Import `useQueryClient` from `@tanstack/react-query`
   - Add a `RefreshCw` icon button in the header toolbar area
   - `onClick`: call `queryClient.invalidateQueries()` with no arguments to refetch all active queries
   - Show a brief loading spinner on the button while refetching, then restore

4. **App.tsx — swimlane drag order fix**
   - In `handleDragEnd`, find the `swimlane-zone` drop case
   - Extract `swimlaneId` from the drop target's `data.swimlaneId`
   - Scope the card list: `const scopedCards = cards.filter(c => c.columnId === targetColId && (swimlaneId === null ? c.swimlaneId == null : c.swimlaneId?.toString() === swimlaneId?.toString()))`
   - Use `scopedCards.length` (or computed insertion index within scopedCards) as `newPosition`
   - If the card's swimlane is changing, call `updateCardSwimlane` first, then `moveCard`

---

## Phase Tracker (do not delete)

- [x] Phase 0 — Base board (columns, cards, drag-drop, users, PIN, activity)
- [x] Phase 1 — Stable storage, multi-project, admin roles, tags, due dates, card count, quick user switcher
- [x] Phase 2 — Comments, per-card history, multi-select/multi-move, filter bar
- [x] Phase 3 — Export/import JSON, bulk card import, saved filter presets, swimlanes
- [x] Features 16-19 — Checklists, Quick Add, Archive, Dashboard
- [x] Features 20-22 — Created dates, delete confirmation, undo/redo
- [x] Features 23-26 — Swimlane drag, column delete UX, macOS shortcuts, Quick Add multi-word
- [x] Performance pass — query storm eliminated, lazy loading for revisions/checklists/archived
- [x] Performance pass 2 — load time fixes, stale time, removed polling
- [ ] Current — Swimlane visual distinction, swimlane order bug fix, bulk edit toolbar, manual refresh
