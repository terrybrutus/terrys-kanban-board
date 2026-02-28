# Kanban Board

## Current State

Full-featured Kanban board with:
- Multi-project support (project dropdown in header)
- Columns, cards with drag-and-drop reordering
- Users with PIN authentication, master admin + admin roles
- Tags per project (admin-configurable, colored chips on cards)
- Card due dates with overdue visual indicator
- Card count badges per column
- Quick active-user switcher in header
- Card comments/notes thread
- Per-card status history (via Revision log filtered by cardId)
- Multi-select within a column (checkbox, shift+click, ctrl+click, shift+A)
- Multi-move selected cards to a target column
- Filter bar with: text search, assignee, tags, date range, unassigned toggle
- Active filters shown as removable chips with "Clear all"
- Activity log per project

Backend state: projects, users, columns, cards, tags, revisions, comments — all in Map/List structures (EOP-persistent).

## Requested Changes (Diff)

### Add
- **Filter presets**: Named saved filter states, stored per project, associated with the creating user.
- Backend: `FilterPreset` type with id, projectId, createdByUserId, name, and serialized filter fields (assigneeId?, tagIds[], unassignedOnly, textSearch, dateField?, dateFrom, dateTo).
- Backend CRUD: `saveFilterPreset`, `getFilterPresets`, `deleteFilterPreset`.
- Frontend: "Save preset" button in the FilterBar when filters are active.
- Frontend: Preset dropdown near the FilterBar; clicking a preset applies all its filters.
- Frontend: Presets list shown with delete button (only creator or admin can delete).

### Modify
- `FilterBar` component: add preset dropdown and "Save as preset" affordance.
- `App.tsx`: pass `activeUser`, `activeProjectId`, and preset-related handlers down to FilterBar.

### Remove
- Nothing removed.

## Implementation Plan

1. Add `FilterPreset` type and state to `main.mo`.
2. Add `saveFilterPreset`, `getFilterPresets`, `deleteFilterPreset` functions to backend.
3. Regenerate `backend.d.ts` bindings.
4. Add `useFilterPresets`, `useSaveFilterPreset`, `useDeleteFilterPreset` hooks.
5. Update `FilterBar` to accept presets, activeUser, onSavePreset, onDeletePreset, onApplyPreset props.
6. Render preset dropdown near the filter toggle button.
7. Render "Save as preset" button when filters are active.
8. Wire everything in `App.tsx`.

---

## Phase Completion Tracker
- [x] Phase 0 — Base board (columns, cards, drag-drop, users, PIN auth)
- [x] Phase 1 — Foundation (stable storage confirmation, multi-project, admin roles, tags, due dates, card count badges, quick user switcher)
- [x] Phase 2 — Card power features (comments, per-card history, multi-select, multi-move, filter bar)
- [ ] Phase 3 (in progress) — Feature 12: Saved filter presets
- [ ] Phase 3 remaining — Feature 13: Versioned JSON export/import, Feature 14: Bulk card import, Feature 15: Swimlanes

---

## Full Feature List (for reference)
1. ✅ Stable Storage
2. ✅ Multi-Project Support
3. ✅ Admin Role System
4. ✅ Tags on Cards
5. ✅ Card Due Dates
6. ✅ Card Count Badge Per Column
7. ✅ Quick Active-User Switcher in Header
8. ✅ Card Comments / Notes Thread
9. ✅ Per-Card Status History
10. ✅ Multi-Select and Multi-Move Within a Column
11. ✅ Filter Bar
12. 🔄 Saved Filter Presets (this build)
13. ⬜ Versioned JSON Export/Import
14. ⬜ Bulk Card Import
15. ⬜ Swimlanes (optional, off by default)

---

## Export/Import JSON Format (for Feature 13 reference)

```json
{
  "_comment": {
    "schemaVersion": "Always required. Tells the app how to read this file.",
    "omittingFields": "Most fields are optional. Omitting applies defaults. Never crashes.",
    "activity": "Optional. If omitted, activity log starts empty for this project.",
    "users": "Optional. If omitted, existing users are not modified.",
    "pinHandling": "PINs never exported. Imported users flagged as PIN-not-set.",
    "importModes": "'replace' wipes and replaces. 'merge' adds and reports conflicts.",
    "ids": "Preserve original IDs. Unknown columnId -> card goes to Unassigned area."
  },
  "schemaVersion": 1,
  "exportedAt": "2026-02-27T14:00:00Z",
  "users": [
    { "id": "u1", "name": "Terry", "isAdmin": true, "isMasterAdmin": true },
    { "id": "u2", "name": "Alex", "isAdmin": false, "isMasterAdmin": false }
  ],
  "projects": [
    {
      "id": "proj1",
      "name": "GFI Lessons",
      "columns": [
        {
          "id": "col1",
          "title": "To Do",
          "order": 0,
          "cards": [
            {
              "id": "card1",
              "title": "Priority 22",
              "description": "Ready for delivery",
              "order": 0,
              "assigneeIds": ["u2"],
              "tags": ["Active"],
              "dueDate": "2026-03-01T00:00:00Z",
              "createdAt": "2026-02-20T10:00:00Z",
              "createdBy": "u1",
              "comments": [],
              "history": []
            }
          ]
        }
      ],
      "tags": [
        { "id": "tag1", "name": "Active", "color": "#22c55e" }
      ],
      "filterPresets": [
        {
          "id": "preset1",
          "name": "Terry's On Hold Items",
          "createdByUserId": "u1",
          "assigneeId": "u1",
          "tagIds": ["tag1"],
          "unassignedOnly": false,
          "textSearch": "",
          "dateField": null,
          "dateFrom": "",
          "dateTo": ""
        }
      ],
      "activity": []
    }
  ]
}
```

## Resume Instructions
To continue in a new session: read this spec.md, check the phase completion tracker, and implement the next unchecked item. Each feature is self-contained and should be built one at a time.
