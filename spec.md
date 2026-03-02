# Kanban Board

## Current State
- Version 19 (in progress): Access key gate on `/`, read-only DemoApp on `/demo` with static seed data (tech course syllabus content, no CRUD, no tutorial)
- `DemoApp.tsx` exists as a separate static read-only component with fake data
- App.tsx detects `/demo` path and renders DemoApp instead of main app
- Main app uses backend queries for all state

## Requested Changes (Diff)

### Add
- `/tutorial` route: full CRUD Kanban board with ephemeral in-memory state (no backend calls, resets on refresh/leave)
- Toyota-style workflow seed data representing a real pull-system production workflow (realistic cards, tags, due dates, checklists, comments, assigned users)
- Pre-loaded users: Terry Brutus (Lead/Workflow Owner) + Alex R., Maria T., James K., Sam P.
- Tutorial overlay on first visit: appears over visible board, "Start Tutorial" and "Skip" buttons. Does NOT auto-force on every subsequent visit (sessionStorage flag).
- Persistent "Tutorial" button in header so users can re-launch walkthrough at any time if they skipped or want to revisit
- Step-by-step tutorial walkthrough (6-8 steps) highlighting: board overview, dragging cards, opening a card (details/checklist/comments/tags), creating a card, filter bar, multi-select, undo/redo
- Amber banner: "This is an interactive portfolio demo of Terry Brutus's Kanban workflow tool. All actions are fully functional -- changes reset when you leave."
- All CRUD features fully functional in tutorial: create/edit/delete cards, move cards (drag+drop), add/remove tags, assign users, set due dates, checklists, comments, activity log, filter bar, multi-select

### Modify
- `App.tsx`: change `/demo` path detection to `/tutorial`, render new `TutorialApp` component instead of `DemoApp`
- Remove "Back to App" link from tutorial header
- Remove "Read-only" and "Demo Mode" badges — tutorial is fully interactive

### Remove
- `DemoApp.tsx` — entire file deleted, replaced by `TutorialApp.tsx`
- All `/demo` route references in `App.tsx`
- All "demo" terminology in UI (badges, banners, labels)

## Implementation Plan
1. Delete `DemoApp.tsx`
2. Create `TutorialApp.tsx` — self-contained ephemeral full-CRUD Kanban board:
   - All state managed in React useState (no backend hooks)
   - Seed data: Toyota production workflow (6 columns: Backlog → In Progress → Review → Testing → Staging → Done; realistic cards with tags, due dates, checklists, comments)
   - Users: Terry Brutus (master, lead), Alex R., Maria T., James K., Sam P.
   - Tags: Active, On Hold, Waiting for Approval, Priority, Blocked
   - Full drag-and-drop (dnd-kit), card modal with checklist + comments, filter bar, multi-select toolbar, activity log tab, dashboard tab
   - Tutorial overlay component: sessionStorage key `tutorial_seen`; shows on first visit; "Start Tutorial" / "Skip" buttons
   - Tutorial steps: 6-8 steps with highlight zones and descriptive text
   - Persistent "Tutorial" button in header to re-open overlay at any time
   - Amber banner at top
3. Update `App.tsx`: replace `/demo` detection with `/tutorial`, render `TutorialApp`
