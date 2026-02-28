# Kanban Board

## Current State

Single-board Kanban app with:
- Columns (create, rename, delete, reorder via drag)
- Cards (create, update, delete, drag between columns, assign to user)
- Users (global, with PIN auth, admin PIN for resets)
- Activity log (revision/audit trail, board-wide and per-card)
- Drag-and-drop for cards and columns
- Active user session (local state)
- Three tabs: Board, Users, Activity

Backend functions (all project-unscoped):
- `getColumns()`, `createColumn()`, `renameColumn()`, `deleteColumn()`, `reorderColumns()`
- `getCards()`, `createCard()`, `updateCard()`, `deleteCard()`, `moveCard()`, `assignCard()`
- `getUsers()`, `createUser()`, `deleteUser()`, `verifyPin()`, `changeUserPin()`, `resetUserPin()`, `setAdminPin()`
- `getRevisions()`, `getCardRevisions()`, `clearRevisions()`
- `initBoard()` — seeds default columns if none exist

All state persisted automatically via Enhanced Orthogonal Persistence (--default-persistent-actors).

## Requested Changes (Diff)

### Add

**Backend:**
- `Project` type: `{ id: Nat; name: Text }`
- `projects` map: `Map<Nat, Project>`
- `nextProjectId` counter
- `createProject(name: Text, actorUserId: Nat) : async Nat`
- `renameProject(projectId: Nat, newName: Text, actorUserId: Nat) : async ()`
- `deleteProject(projectId: Nat, actorUserId: Nat) : async ()` — deletes all columns and cards belonging to that project
- `getProjects() : async [Project]`
- `initDefaultProject() : async Nat` — creates a default "My Board" project if no projects exist; returns its id
- All column and card functions gain a `projectId: Nat` parameter to scope to a project
- `getColumns(projectId: Nat)`, `createColumn(name, actorUserId, projectId)`, `renameColumn(columnId, newName, actorUserId)`, `deleteColumn(columnId, actorUserId)`, `reorderColumns(newOrder, actorUserId)` — columns are already project-scoped via their id; getColumns filters by projectId
- `getCards(projectId: Nat)` — filters cards by projectId (cards carry projectId)
- `getRevisions(projectId: Nat)` — filters revisions by projectId
- `getCardRevisions(cardId: Nat)` — unchanged
- Column type gains `projectId: Nat` field
- Card type gains `projectId: Nat` field  
- Revision type gains `projectId: Nat` field
- `initBoard()` remains but is deprecated; `initDefaultProject()` replaces it for project-aware init

**Frontend:**
- `ProjectSwitcher` dropdown component in the header (between the Kanban logo and the Board/Users/Activity tabs)
- `useProjects()`, `useCreateProject()`, `useRenameProject()`, `useDeleteProject()`, `useInitDefaultProject()` hooks
- `activeProjectId` state in App — all board queries scoped to it
- Project creation dialog (admin-only)
- Project rename inline (admin-only)
- Project delete with confirmation dialog (admin-only) — warns that all columns and cards will be deleted

### Modify

**Backend:**
- `Column` type: add `projectId: Nat`
- `Card` type: add `projectId: Nat`
- `Revision` type: add `projectId: Nat`
- `getColumns()` → `getColumns(projectId: Nat)` 
- `getCards()` → `getCards(projectId: Nat)`
- `getRevisions()` → `getRevisions(projectId: Nat)`
- `createColumn` gains `projectId: Nat` param
- `createCard` gains `projectId: Nat` param
- `logRevision` gains `projectId: Nat` param
- `initBoard()` — updated to call `initDefaultProject()` logic (backward-compat shim)

**Frontend:**
- All `useColumns`, `useCards`, `useRevisions` query keys include `activeProjectId`
- All mutation calls pass `projectId` where needed
- `useInitBoard` replaced by `useInitDefaultProject` for project-aware init
- `ActivityTab` receives `projectId` prop and passes it to `getRevisions`
- Header updated to include project switcher dropdown

### Remove

Nothing removed. All existing functionality preserved.

## Implementation Plan

1. **Backend**: Add `Project` type and map; add `projectId` field to `Column`, `Card`, `Revision`; add `getProjects`, `createProject`, `renameProject`, `deleteProject`, `initDefaultProject`; update `getColumns(projectId)`, `getCards(projectId)`, `getRevisions(projectId)` to filter by project; update `createColumn`, `createCard`, `logRevision` to accept and store `projectId`; `deleteProject` cascades to delete all matching columns and cards.

2. **Frontend hooks**: Add project query/mutation hooks to `useQueries.ts`; update `useColumns`, `useCards`, `useRevisions` to accept and include `projectId` in query keys and function calls; update all mutation hooks that create columns/cards to pass `projectId`.

3. **App.tsx**: Add `activeProjectId` state; on actor ready, call `initDefaultProject()` to ensure at least one project exists and get its id; scope all board queries to `activeProjectId`; add `ProjectSwitcher` to header.

4. **ProjectSwitcher component**: Dropdown showing all project names; "New project" option (admin-only); rename/delete actions (admin-only) in a context menu or settings popover; delete shows confirmation dialog with warning text.

5. **ActivityTab**: Accept `projectId` prop, pass to `getRevisions`.

---

## Phase Plan (full roadmap — do not build ahead)

### Phase 0: Stable Storage — COMPLETE (handled by platform EOP)

### Phase 1: Foundation — IN PROGRESS
- [x] Stable storage (automatic via EOP)
- [ ] Multi-project support (this build)
- [ ] Admin role system
- [ ] Tags on cards
- [ ] Card due dates
- [ ] Card count badge per column
- [ ] Quick active-user switcher in header

### Phase 2: Card Power Features
- [ ] Card comments/notes thread
- [ ] Per-card status history
- [ ] Multi-select within a single column
- [ ] Multi-move selected cards to target column

### Phase 3: Import/Export and Filtering
- [ ] Versioned JSON export/import
- [ ] Bulk card import with column mapping UI
- [ ] Filter bar (assignee, tag, date range, unassigned, text search)
- [ ] Saved filter presets
- [ ] Swimlanes (optional, off by default)

---

## Domain Context

This is a pipeline-tracking board for processing lesson files through stages.
- Columns = pipeline stages (e.g. 10-To Do, 20-In Review, 30-Done)
- Cards = individual priority items (e.g. "Priority 22")
- Projects = top-level subjects or workstreams (e.g. "GFI Lessons", "Math", "History")
- Users = team members (Terry, Rob, etc.) — global across all projects

## To Resume in a New Session

Say: "Read spec.md, then build the next incomplete item in Phase 1."
