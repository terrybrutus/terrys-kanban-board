# Kanban Board

## Current State
App is at v37. The filter bar previously had a 'Show Archived' toggle that was removed. Archived cards exist on-chain but are invisible. Export/import does not include checklist items. Snapshot restore works structurally but misses checklists (since snapshots use the same export function). The restore UI shows an infinite spinner with no progress indication. Most mutations use `invalidateQueries` on success which forces a full refetch, causing 1-2s perceived lag on all edits.

## Requested Changes (Diff)

### Add
- Show Archived toggle back in FilterBar UI (was removed, field still exists in filter state as `showArchived`)
- Unarchive button in card modal when viewing an archived card (calls `actor.unarchiveCard` or sets `isArchived: false`)
- Checklist items in export JSON: per card, call `actor.getChecklistItems(card.id)` and include as `checklists` array on `ExportedCard`
- Checklist import: after creating each card on import, create its checklist items via `actor.addChecklistItem`
- Progress bar (0-100%) in SnapshotsPanel during restore, replacing the current indeterminate state
- Optimistic updates on key mutations: useUpdateCard, useCreateCard, useArchiveCard, useUpdateCardTags, useUpdateCardDueDate — update React Query cache immediately on `onMutate`, rollback on `onError`

### Modify
- FilterBar: re-expose `showArchived` toggle in the filter panel UI; include it in `hasActiveFilters` check; add an active filter chip for it
- exportProjectToString in exportImport.ts: fetch checklist items per card in the parallel `Promise.all`, attach to each ExportedCard
- importProject in exportImport.ts: after creating each card, create its checklist items sequentially
- SnapshotsPanel: add `restoreProgress` state (0-100), pass a progress callback into `restoreFromSnapshotJson`, display a Progress bar component during restore
- restoreFromSnapshotJson / restoreFromSnapshot: accept optional `onProgress: (pct: number) => void` callback, call it at key milestones (wipe complete=20%, tags done=35%, columns done=50%, cards done=85%, checklist/comments done=100%)
- KanbanCard modal: show an 'Unarchive' button (with ArchiveRestore icon) when `card.isArchived === true`; calls existing unarchive backend method or archiveCard toggle

### Remove
- Nothing removed

## Implementation Plan
1. **FilterBar.tsx**: Add showArchived checkbox/toggle in filter panel. Add chip in active filters row. Include in hasActiveFilters.
2. **useQueries.ts**: Add `onMutate` + `cancelQueries` + `setQueryData` optimistic update to useUpdateCard, useCreateCard, useArchiveCard, useUpdateCardTags, useUpdateCardDueDate. Add `onError` rollback. Keep `onSuccess` invalidation for eventual consistency.
3. **exportImport.ts - exportProjectToString**: In the per-card Promise.all, also fetch `actor.getChecklistItems(card.id)`. Add checklist items to ExportedCard as `checklists: { id, text, checked, order }[]`.
4. **exportImport.ts - importProject**: After card creation, loop checklist items and call `actor.addChecklistItem`. Also handle `updateChecklistItem` for checked state.
5. **exportImport.ts - restoreFromSnapshot**: Accept `onProgress` callback. Call at milestones through the restore flow.
6. **SnapshotsPanel.tsx**: Add `restoreProgress` state. Show `<Progress value={restoreProgress} />` during restore instead of just a spinner. Pass progress callback to restore function.
7. **KanbanCard.tsx**: When `card.isArchived`, show Unarchive button that calls backend to unarchive. Wire via `onArchive` prop toggle or a new `onUnarchive` prop.
