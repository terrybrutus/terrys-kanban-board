# Kanban Board

## Current State
- Full Kanban board with drag-and-drop cards between columns
- Column management: create, rename, delete, reorder (backend has `reorderColumns` but no frontend drag-to-reorder for columns yet)
- User system with 4-digit PIN for identity; users can set themselves as active
- Activity/revision log tracking all actions with actor attribution
- Card assignment to users
- All actions use `actorUserId` but do NOT enforce that a user must be active — anonymous (userId=0) actions are allowed

## Requested Changes (Diff)

### Add
- **Column drag-to-reorder**: Drag columns left/right to rearrange them on the board. Uses the existing `reorderColumns` backend API. Logged in activity.
- **PIN reset flow**: An admin-style "forgot PIN" path. Since there is no admin role, the recourse is: any user can have their PIN reset by a majority of other users verifying their own PINs (or simpler: a new `resetPin` backend function that lets a user change their PIN if they know their old PIN, plus a separate admin reset using a special "admin PIN" stored on the canister). Chosen approach: add a `resetPin(userId, oldPinHash, newPinHash)` function — user must know old PIN to set new one (standard "change PIN"). For truly forgotten PIN, add an `adminResetPin(userId, adminPin, newPinHash)` function backed by a one-time canister-level admin PIN set at init. Show "Forgot PIN?" link in the SetActive and Delete confirm flows.
- **Auth gate**: All board actions (add/move/delete card, add/rename/delete/reorder column, assign card) must require an active user. If no user is active, show a modal/banner prompting them to go to the Users tab and set themselves as active. Anonymous (id=0) writes are blocked at the UI level.

### Modify
- **App.tsx**: Wire column drag-to-reorder with `useSortable` on columns, plug into `reorderColumns` mutation; enforce active-user gate before any mutating action; add `useReorderColumns` hook usage.
- **KanbanColumn.tsx**: Wrap with `useSortable` to allow column-level drag. Accept `onReorderColumns` or let parent handle via `DndContext`.
- **UsersTab.tsx**: Add "Change PIN" flow per user row (requires old PIN + new PIN). Add "Forgot PIN / Admin Reset" option using the admin PIN.
- **Backend**: Add `resetPin`, `adminResetPin`, and `setAdminPin` functions; log PIN reset in revisions; enforce that `reorderColumns` logs the action with actorUserId.

### Remove
- Nothing removed

## Implementation Plan
1. Update backend: add `resetPin(userId, oldPinHash, newPinHash)`, `adminResetPin(userId, adminPinHash, newPinHash)`, `setAdminPin(pinHash)`, update `reorderColumns` to accept `actorUserId` and log the action.
2. Regenerate `backend.d.ts` via `generate_motoko_code`.
3. Frontend - column drag-to-reorder: make columns sortable in `DndContext`, differentiate card drag vs column drag by drag type, call `reorderColumns` on drop.
4. Frontend - auth gate: add `requireActiveUser` helper; wrap all mutation handlers in App.tsx to check `activeUser` first and show a toast/modal if none is set.
5. Frontend - PIN reset: add "Change PIN" inline form in UsersTab UserRow; add "Forgot PIN?" sub-flow that prompts for admin PIN then new PIN.
6. Frontend - `reorderColumns` hook: already exists in `useQueries.ts`, just wire it up.

## UX Notes
- Column drag should be visually distinct from card drag (grab handle on column header, or dragging by the header area).
- Auth gate should be a non-blocking toast + redirect suggestion, not a hard modal, so users understand what to do.
- "Change PIN" is initiated by the user themselves (requires current PIN). "Admin Reset" uses the canister admin PIN, which is set once and shown/copied at first setup.
- The admin PIN is a fallback for forgotten user PINs; it should be set in the Users tab during first use.
