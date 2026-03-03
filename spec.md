# Kanban Board

## Current State
Version 22 Kanban board application on ICP (Motoko + React). Full-featured board with columns, cards, users, tags, swimlanes, checklists, comments, filter presets, undo/redo, export/import, tutorial, and dashboard. Previous build failed; all 15 Version 22 fixes remain unimplemented in the current codebase.

## Requested Changes (Diff)

### Add
- **Column `isComplete` flag** (backend): add `isComplete: Bool` field to Column type and `ColumnView` type. Add `setColumnComplete(columnId, isComplete, actorUserId)` backend function so admins can flag any column as the "completion stage."
- **Dashboard completion metric**: cards in any column marked `isComplete` count as completed. Dashboard "Completion" stat card shows count + percentage of active cards in complete columns.
- **Column complete indicator**: column header shows a small green checkmark badge when `isComplete = true`. Admin sees toggle in column ellipsis menu ("Mark as complete" / "Unmark as complete").
- **Filter results count banner**: when filters are active, show a slim bar below the filter bar with "X cards match (of Y total)" message. Already partially implemented in code but needs verified.
- **Tutorial horizontal scroll step**: add a step explaining Shift+scroll (or just scroll on the board background) for horizontal navigation.

### Modify
- **Column delete card migration (BUG FIX)**: rewrite `handleDeleteColumn` to: (1) call `moveCards` with ALL card IDs from the column, (2) await with proper error handling, (3) only then call `deleteColumn`. Currently cards get deleted instead of migrated.
- **Undo/Redo full state snapshots (BUG FIX)**: rebuild undo/redo for destructive actions (column delete, bulk moves) to capture full column+card state snapshot. Undo column deletion must restore the column AND all its original cards. Currently only partial state saved.
- **Import mapping modal layout (BUG FIX)**: fix modal so it uses proper `flex flex-col` layout with `overflow-hidden` on the container, `flex-1 overflow-y-auto` on the scrollable content area, and a `shrink-0` sticky footer with the action buttons. The confirm button must always be visible without tabbing.
- **Progress bar colors (BUG FIX)**: progress bar borders should be 1px black. Fill colors must be WCAG-compliant and contrast against the beige/card background. Use a multi-color distinct palette (blues, greens, ambers, teals, purples) — NOT white or solid black fills. Apply to DashboardTab ProgressRow component.
- **Card click area (BUG FIX)**: entire card body should open modal on click. Currently only near the title works. The card div already has `onClick` but the inner content area has `pr-20` padding creating dead zones. Ensure click propagates correctly from any part of the card body.
- **Card description hover movement (BUG FIX)**: card description text should not move on hover. Remove any hover transform or layout shift on the description `<p>` tag. Likely caused by action buttons appearing on hover and shifting the layout — ensure action buttons are positioned absolutely and don't affect flow.
- **Horizontal scroll (BUG FIX)**: the board scroll handler currently fires only when `scrollWidth > clientWidth`. The issue is the `handleWheel` event isn't attached correctly or the condition fails. Fix: always allow horizontal scroll on the board container when Shift is held, OR ensure the board container always allows the scroll handler to intercept wheel events regardless of overflow condition. Also ensure the board div has `overflow-x: scroll` (not just `overflow-x: auto`).
- **Imported users PIN default (BUG FIX)**: in `exportImport.ts` `importProject` function, when creating new users, always use a hash of "0000" as the default PIN. Currently uses an unknown hash.
- **Master admin PIN reset no auto-switch (BUG FIX)**: in `UsersTab.tsx`, when master admin resets another user's PIN, do NOT call `setActiveUser` afterwards. The active user should remain whoever was active before the reset.
- **Dashboard completion metric data source**: update DashboardTab to receive `columns` data and compute completion as: cards whose `columnId` maps to a column with `isComplete = true`.
- **Tutorial pointer style**: replace flashlight/spotlight overlay with a line-and-dot callout arrow style. Each step: dim the background, draw a visible line from the tooltip to the target element, put a dot at the target end. Use SVG overlay for the connecting line. Target element gets a subtle highlight ring (no flashlight mask).
- **Card borders**: ensure all cards have `border-2 border-black/60` (dark mode: `dark:border-white/20`). Already in code but verify it's applied consistently including in tutorial.
- **Dashboard progress bars 1px border**: update ProgressRow to use `border border-black` (1px). Currently has `border-2`.

### Remove
- Nothing removed.

## Implementation Plan

1. **Backend**: Add `isComplete: Bool` to `Column` type and `ColumnView` type. Add `setColumnComplete` function. Update `getColumns` to include `isComplete` in `ColumnView.fromColumn`.

2. **backend.d.ts**: Update ColumnView type to include `isComplete: boolean`. Add `setColumnComplete` function signature.

3. **DashboardTab.tsx**: 
   - Accept `columns` prop (already fetched internally)
   - Compute completion count as cards in columns where `isComplete = true`
   - Update "Completion" StatCard to show this count and percentage
   - Fix ProgressRow border to `border border-black`
   - Fix progress bar fill colors to use distinct multi-color WCAG palette

4. **KanbanColumn.tsx**:
   - Add `isComplete` display in column header (green checkmark badge)
   - Add "Mark as complete" / "Unmark as complete" in column ellipsis menu
   - Wire `onSetColumnComplete` callback prop
   - Fix column delete: sequential move-then-delete with proper awaits

5. **App.tsx**:
   - Wire `setColumnComplete` mutation and handler
   - Pass `isComplete` columns to DashboardTab
   - Fix `handleDeleteColumn` to be truly sequential: await moveCards first, then deleteColumn
   - Fix horizontal scroll: ensure wheel handler works even when scrollWidth <= clientWidth if board has columns (use `overflow-x: scroll` CSS or always intercept Shift+wheel)

6. **KanbanCard.tsx**:
   - Fix card click area: remove any hover layout shift; ensure action buttons are `position: absolute` and don't create layout reflow on hover
   - Fix card description: remove hover transform/transition on description text

7. **UsersTab.tsx**: Fix `resetUserPin` handler — after reset, do NOT set active user.

8. **ProjectExportImport.tsx (exportImport.ts)**: Fix imported user PIN to default to hash of "0000".

9. **FilterBar / App.tsx**: Verify filter results count banner renders correctly.

10. **TutorialApp.tsx**: 
    - Replace spotlight/flashlight with line-and-dot callout arrow SVG overlay
    - Add horizontal scroll step (explaining Shift+scroll or mouse wheel on board)
    - Ensure tutorial columns also show `isComplete` concept

11. **useQueries.ts / hooks**: Add `useSetColumnComplete` mutation hook.
