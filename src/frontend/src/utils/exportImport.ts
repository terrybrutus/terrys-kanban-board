import type { backendInterface } from "../backend.d";

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function bigintNsToIso(ns: bigint): string {
  return new Date(Number(ns) / 1_000_000).toISOString();
}

function isoToBigintNs(iso: string): bigint {
  return BigInt(new Date(iso).getTime()) * 1_000_000n;
}

// ─── Snapshot Restore ─────────────────────────────────────────────────────────
// The backend snapshot is in a raw flat format (different from the export/import JSON).
// This function handles that format directly.

export interface SnapshotRestoreResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    columnsRestored: number;
    cardsRestored: number;
    tagsRestored: number;
    swimlanesRestored: number;
  };
}

// Raw types from backend snapshot (numeric IDs as strings in JSON)
interface RawSnapshotProject {
  id: string | number;
  name: string;
  swimlanesEnabled?: boolean;
}

interface RawSnapshotColumn {
  id: string | number;
  name: string;
  projectId: string | number;
  cardIds: (string | number)[];
  isComplete?: boolean;
}

interface RawSnapshotCard {
  id: string | number;
  title: string;
  description?: string | null;
  columnId: string | number;
  projectId: string | number;
  assignedUserId?: string | number | null;
  tags?: (string | number)[];
  dueDate?: string | number | null;
  createdAt?: string | number;
  swimlaneId?: string | number | null;
  isArchived?: boolean;
}

interface RawSnapshotTag {
  id: string | number;
  name: string;
  color: string;
  projectId: string | number;
}

interface RawSnapshotSwimlane {
  id: string | number;
  name: string;
  projectId: string | number;
  order?: string | number;
}

interface RawSnapshotUser {
  id: string | number;
  name: string;
  isAdmin?: boolean;
  isMasterAdmin?: boolean;
}

interface RawSnapshot {
  projects?: RawSnapshotProject[];
  users?: RawSnapshotUser[];
  columns?: RawSnapshotColumn[];
  cards?: RawSnapshotCard[];
  tags?: RawSnapshotTag[];
  swimlanes?: RawSnapshotSwimlane[];
}

export async function restoreFromSnapshot(
  actor: backendInterface,
  snapshotJson: string,
  targetProjectId: bigint,
  activeUserId: bigint,
): Promise<SnapshotRestoreResult> {
  const result: SnapshotRestoreResult = {
    success: false,
    errors: [],
    warnings: [],
    counts: {
      columnsRestored: 0,
      cardsRestored: 0,
      tagsRestored: 0,
      swimlanesRestored: 0,
    },
  };

  let raw: RawSnapshot;
  try {
    raw = JSON.parse(snapshotJson) as RawSnapshot;
  } catch {
    result.errors.push("Snapshot data is corrupted — could not parse JSON.");
    return result;
  }

  const targetProjectIdStr = targetProjectId.toString();
  const snapProjects = raw.projects ?? [];

  // noProjectFilter: snapshot has 0 project records (serialization bug) — restore all data regardless of projectId
  const noProjectFilter = snapProjects.length === 0;

  let snapProject: RawSnapshotProject | undefined = snapProjects.find(
    (p) => String(p.id) === targetProjectIdStr,
  );

  if (!snapProject && !noProjectFilter) {
    // Fallback 1: match by current project name
    try {
      const liveProjects = await actor.getProjects();
      const liveProject = liveProjects.find((p) => p.id === targetProjectId);
      if (liveProject) {
        const liveNameLower = liveProject.name.toLowerCase();
        snapProject = snapProjects.find(
          (p) => (p.name ?? "").toLowerCase() === liveNameLower,
        );
      }
    } catch {
      // getProjects failed — continue to next fallback
    }
  }

  if (!snapProject && !noProjectFilter && snapProjects.length === 1) {
    snapProject = snapProjects[0];
  }

  if (!snapProject && !noProjectFilter) {
    result.errors.push(
      `Could not find a matching project in this snapshot. The snapshot contains ${snapProjects.length} project(s) but none matched the active project by ID or name.`,
    );
    return result;
  }

  if (noProjectFilter) {
    result.warnings.push(
      "Snapshot has no project records — restoring all columns and cards from snapshot directly.",
    );
  }

  // When noProjectFilter is true, snapProjectIdStr is unused (filtering is skipped)
  let snapProjectIdStr = snapProject ? String(snapProject.id) : "";
  const swimlanesEnabled = snapProject?.swimlanesEnabled ?? false;

  // ── PRE-CHECK: Verify snapshot has data BEFORE wiping anything ─────────────
  // If the snapshot has 0 columns, abort immediately to protect existing board.
  // Fallback 1: filter by matching project ID
  let effectiveNoProjectFilter = noProjectFilter;
  let colsToRestore = noProjectFilter
    ? (raw.columns ?? [])
    : (raw.columns ?? []).filter(
        (c) => String(c.projectId) === snapProjectIdStr,
      );

  // Fallback 2: project ID mismatch — snapshot has columns but none match the
  // active project ID (e.g. project was recreated with a new ID). Use ALL columns.
  if (colsToRestore.length === 0 && (raw.columns ?? []).length > 0) {
    colsToRestore = raw.columns ?? [];
    effectiveNoProjectFilter = true;
    snapProjectIdStr = "";
    result.warnings.push(
      "Project ID mismatch — restoring all columns from snapshot regardless of project ID.",
    );
  }

  if (colsToRestore.length === 0) {
    result.errors.push(
      "This snapshot contains 0 columns — restore aborted. " +
        "Your board data has NOT been changed. " +
        "The snapshot may have been captured after the board was already empty. " +
        "Try restoring an earlier snapshot.",
    );
    return result;
  }

  try {
    // ── STEP 1: Wipe existing project data ─────────────────────────────────
    const [existingColumns, existingTags, existingPresets, existingSwimlanes] =
      await Promise.all([
        actor.getColumns(targetProjectId).catch(() => []),
        actor.getProjectTags(targetProjectId).catch(() => []),
        actor.getFilterPresets(targetProjectId).catch(() => []),
        actor.getSwimlanes(targetProjectId).catch(() => []),
      ]);

    // Delete columns (cascades cards on backend)
    await Promise.all(
      existingColumns.map((col) =>
        actor.deleteColumn(col.id, activeUserId).catch((e: unknown) => {
          result.warnings.push(
            `Could not delete column "${col.name}": ${String(e)}`,
          );
        }),
      ),
    );

    // Delete tags
    await Promise.all(
      existingTags.map((tag) =>
        actor.deleteTag(tag.id, activeUserId).catch((e: unknown) => {
          result.warnings.push(
            `Could not delete tag "${tag.name}": ${String(e)}`,
          );
        }),
      ),
    );

    // Delete filter presets
    await Promise.all(
      existingPresets.map((preset) =>
        actor
          .deleteFilterPreset(preset.id, activeUserId)
          .catch((e: unknown) => {
            result.warnings.push(
              `Could not delete preset "${preset.name}": ${String(e)}`,
            );
          }),
      ),
    );

    // Delete swimlanes
    await Promise.all(
      existingSwimlanes.map((sl) =>
        actor.deleteSwimlane(sl.id, activeUserId).catch((e: unknown) => {
          result.warnings.push(
            `Could not delete swimlane "${sl.name}": ${String(e)}`,
          );
        }),
      ),
    );

    // ── STEP 2: Restore tags ────────────────────────────────────────────────
    // Maps old snapshot tag ID → new backend tag ID
    const tagIdMap = new Map<string, bigint>();

    const snapTags = effectiveNoProjectFilter
      ? (raw.tags ?? [])
      : (raw.tags ?? []).filter(
          (t) => String(t.projectId) === snapProjectIdStr,
        );

    for (const tag of snapTags) {
      try {
        const newTagId = await actor.createTag(
          targetProjectId,
          tag.name ?? "Tag",
          tag.color ?? "#94a3b8",
          activeUserId,
        );
        tagIdMap.set(String(tag.id), newTagId);
        result.counts.tagsRestored++;
      } catch (e) {
        result.warnings.push(
          `Could not restore tag "${tag.name}": ${String(e)}`,
        );
      }
    }

    // ── STEP 3: Restore swimlanes ───────────────────────────────────────────
    const swimlaneIdMap = new Map<string, bigint>();

    const snapSwimlanes = effectiveNoProjectFilter
      ? (raw.swimlanes ?? [])
      : (raw.swimlanes ?? []).filter(
          (sl) => String(sl.projectId) === snapProjectIdStr,
        );

    for (const sl of snapSwimlanes) {
      try {
        const newSlId = await actor.createSwimlane(
          targetProjectId,
          sl.name ?? "Lane",
          activeUserId,
        );
        swimlaneIdMap.set(String(sl.id), newSlId);
        result.counts.swimlanesRestored++;
      } catch (e) {
        result.warnings.push(
          `Could not restore swimlane "${sl.name}": ${String(e)}`,
        );
      }
    }

    // Restore swimlanes enabled state
    if (swimlanesEnabled && swimlaneIdMap.size > 0) {
      await actor
        .enableSwimlanes(targetProjectId, activeUserId)
        .catch(() => {});
    }

    // ── STEP 4: Restore users (ensure they exist; match by name) ───────────
    // Build a name → ID map for existing users
    const existingUsers = await actor.getUsers().catch(() => []);
    const userIdMap = new Map<string, bigint>(); // old snap ID → backend ID

    const snapUsers = raw.users ?? [];
    for (const su of snapUsers) {
      const existing = existingUsers.find(
        (u) => u.name.toLowerCase() === (su.name ?? "").toLowerCase(),
      );
      if (existing) {
        userIdMap.set(String(su.id), existing.id);
      }
      // Note: we don't create users from snapshots — they already exist in the system
    }

    // ── STEP 5: Restore columns (maintaining order from cardIds order) ──────
    const columnIdMap = new Map<string, bigint>(); // old snap col ID → new backend col ID

    // snapColumns already computed in pre-check above (same derivation)
    const snapColumns = colsToRestore;

    for (const col of snapColumns) {
      try {
        const newColId = await actor.createColumn(
          col.name ?? "Column",
          activeUserId,
          targetProjectId,
        );
        columnIdMap.set(String(col.id), newColId);
        result.counts.columnsRestored++;

        // Set complete flag if applicable
        if (col.isComplete) {
          await actor
            .setColumnComplete(newColId, true, activeUserId)
            .catch(() => {});
        }
      } catch (e) {
        result.errors.push(
          `Failed to restore column "${col.name}": ${String(e)}`,
        );
      }
    }

    // ── STEP 6: Restore cards in column order ───────────────────────────────
    // Process each column in snapshot order, placing cards by their cardIds order
    for (const col of snapColumns) {
      const newColId = columnIdMap.get(String(col.id));
      if (!newColId) continue;

      // Get cards for this column in order (using the cardIds array from the column)
      const orderedCardIds = (col.cardIds ?? []).map(String);

      // Build a map of snapshot card data
      const cardDataMap = new Map<string, RawSnapshotCard>();
      for (const card of raw.cards ?? []) {
        cardDataMap.set(String(card.id), card);
      }

      for (const snapCardId of orderedCardIds) {
        const card = cardDataMap.get(snapCardId);
        if (!card) continue;
        if (
          !effectiveNoProjectFilter &&
          String(card.projectId) !== snapProjectIdStr
        )
          continue;

        try {
          const newCardId = await actor.createCard(
            card.title ?? "Untitled",
            card.description ?? null,
            newColId,
            activeUserId,
            targetProjectId,
          );
          result.counts.cardsRestored++;

          // Assign user
          if (card.assignedUserId != null) {
            const newUserId = userIdMap.get(String(card.assignedUserId));
            if (newUserId) {
              await actor
                .assignCard(newCardId, newUserId, activeUserId)
                .catch(() => {});
            }
          }

          // Apply tags
          if (Array.isArray(card.tags) && card.tags.length > 0) {
            const mappedTagIds = (card.tags as (string | number)[])
              .map((tid) => tagIdMap.get(String(tid)))
              .filter((id): id is bigint => id !== undefined);
            if (mappedTagIds.length > 0) {
              await actor
                .updateCardTags(newCardId, mappedTagIds, activeUserId)
                .catch(() => {});
            }
          }

          // Apply due date
          if (card.dueDate != null) {
            const dueDateVal = Number(card.dueDate);
            if (!Number.isNaN(dueDateVal) && dueDateVal > 0) {
              await actor
                .updateCardDueDate(newCardId, BigInt(dueDateVal), activeUserId)
                .catch(() => {});
            }
          }

          // Apply swimlane
          if (card.swimlaneId != null) {
            const newSlId = swimlaneIdMap.get(String(card.swimlaneId));
            if (newSlId) {
              await actor
                .updateCardSwimlane(newCardId, newSlId, activeUserId)
                .catch(() => {});
            }
          }

          // Archive if needed
          if (card.isArchived) {
            await actor.archiveCard(newCardId, activeUserId).catch(() => {});
          }
        } catch (e) {
          result.errors.push(
            `Failed to restore card "${card.title ?? "Untitled"}": ${String(e)}`,
          );
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (e) {
    result.errors.push(`Unexpected restore error: ${String(e)}`);
    result.success = false;
  }

  return result;
}

// ─── Export types ─────────────────────────────────────────────────────────────

export interface ExportedCard {
  id: string;
  title: string;
  description: string | null;
  order: number;
  /** Assignee stored by name (not ID) for human-readable portability */
  assigneeName: string | null;
  tags: string[];
  dueDate: string | null;
  createdAt: string;
  comments: ExportedComment[];
  history: ExportedRevision[];
}

export interface ExportedComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface ExportedRevision {
  id: string;
  actorName: string;
  revisionType: string;
  description: string;
  timestamp: string;
}

export interface ExportedColumn {
  id: string;
  name: string;
  cards: ExportedCard[];
}

export interface ExportedTag {
  id: string;
  name: string;
  color: string;
}

export interface ExportedFilterPreset {
  id: string;
  name: string;
  createdByUserId: string;
  assigneeId: string | null;
  tagIds: string[];
  unassignedOnly: boolean;
  textSearch: string;
  dateField: string | null;
  dateFrom: string;
  dateTo: string;
}

export interface ExportedUser {
  id: string;
  name: string;
  isAdmin: boolean;
  isMasterAdmin: boolean;
}

export interface ExportedSwimlane {
  id: string;
  name: string;
  active: boolean;
}

export interface ExportedProject {
  id: string;
  name: string;
  columns: ExportedColumn[];
  tags: ExportedTag[];
  activity: ExportedRevision[];
  filterPresets: ExportedFilterPreset[];
  swimlanes?: ExportedSwimlane[];
}

export interface KanbanExport {
  _comment: Record<string, string>;
  schemaVersion: number;
  exportedAt: string;
  users: ExportedUser[];
  project: ExportedProject;
}

// ─── Import result types ──────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  unassignedCardCount: number;
  unassignedCardTitles: string[];
  counts: {
    usersImported: number;
    columnsImported: number;
    cardsImported: number;
    tagsImported: number;
    commentsImported: number;
    filterPresetsImported: number;
    swimlanesImported: number;
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportProjectToString(
  actor: backendInterface,
  projectId: bigint,
  projectName: string,
): Promise<string> {
  // Fetch all top-level data in parallel
  const [
    columns,
    cards,
    users,
    tags,
    revisions,
    filterPresets,
    swimlanesData,
    projects,
  ] = await Promise.all([
    actor.getColumns(projectId),
    actor.getCards(projectId),
    actor.getUsers(),
    actor.getProjectTags(projectId),
    actor.getRevisions(projectId),
    actor.getFilterPresets(projectId),
    actor.getSwimlanes(projectId),
    actor.getProjects(),
  ]);

  const currentProject = projects.find((p) => p.id === projectId);

  const userIdToName = new Map(users.map((u) => [u.id.toString(), u.name]));
  const cardMap = new Map(cards.map((c) => [c.id.toString(), c]));
  const cardDataMap = new Map<
    string,
    { comments: ExportedComment[]; history: ExportedRevision[] }
  >();

  await Promise.all(
    cards.map(async (card) => {
      const [comments, cardRevisions] = await Promise.all([
        actor.getCardComments(card.id),
        actor.getCardRevisions(card.id),
      ]);
      cardDataMap.set(card.id.toString(), {
        comments: comments.map((c) => ({
          id: c.id.toString(),
          authorId: c.authorId.toString(),
          authorName: c.authorName,
          text: c.text,
          timestamp: bigintNsToIso(c.timestamp),
        })),
        history: cardRevisions.map((r) => ({
          id: r.id.toString(),
          actorName: r.actorName,
          revisionType: r.revisionType,
          description: r.description,
          timestamp: bigintNsToIso(r.timestamp),
        })),
      });
    }),
  );

  const exportColumns: ExportedColumn[] = columns.map((col) => {
    const colCards: ExportedCard[] = col.cardIds
      .map((cardId, idx) => {
        const card = cardMap.get(cardId.toString());
        if (!card) return null;
        const cardData = cardDataMap.get(card.id.toString()) ?? {
          comments: [],
          history: [],
        };
        return {
          id: card.id.toString(),
          title: card.title,
          description: card.description ?? null,
          order: idx,
          assigneeName:
            card.assignedUserId != null
              ? (userIdToName.get(card.assignedUserId.toString()) ?? null)
              : null,
          tags: (card.tags ?? []).map((t) => t.toString()),
          dueDate: card.dueDate != null ? bigintNsToIso(card.dueDate) : null,
          createdAt: bigintNsToIso(card.createdAt),
          comments: cardData.comments,
          history: cardData.history,
        } satisfies ExportedCard;
      })
      .filter((c): c is ExportedCard => c !== null);
    return { id: col.id.toString(), name: col.name, cards: colCards };
  });

  const activityRevisions: ExportedRevision[] = revisions
    .filter((r) => r.cardId == null)
    .map((r) => ({
      id: r.id.toString(),
      actorName: r.actorName,
      revisionType: r.revisionType,
      description: r.description,
      timestamp: bigintNsToIso(r.timestamp),
    }));

  const exportedUsers: ExportedUser[] = users.map((u) => ({
    id: u.id.toString(),
    name: u.name,
    isAdmin: u.isAdmin,
    isMasterAdmin: u.isMasterAdmin,
  }));

  const exportedTags: ExportedTag[] = tags.map((t) => ({
    id: t.id.toString(),
    name: t.name,
    color: t.color,
  }));

  const exportedPresets: ExportedFilterPreset[] = filterPresets.map((p) => ({
    id: p.id.toString(),
    name: p.name,
    createdByUserId: p.createdByUserId.toString(),
    assigneeId: p.assigneeId?.toString() ?? null,
    tagIds: p.tagIds.map((id) => id.toString()),
    unassignedOnly: p.unassignedOnly,
    textSearch: p.textSearch,
    dateField: p.dateField ?? null,
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
  }));

  // The `active` field is a project-level flag: true means swimlanes are enabled.
  // All lanes get the same value so that re-importing the exported JSON restores
  // the enabled/disabled state correctly.
  const swimlanesAreEnabled = currentProject?.swimlanesEnabled ?? false;
  const exportedSwimlanes: ExportedSwimlane[] = swimlanesData.map((sl) => ({
    id: sl.id.toString(),
    name: sl.name,
    active: swimlanesAreEnabled,
  }));

  const payload: KanbanExport = {
    _comment: {
      purpose:
        "This file is a complete snapshot of a Kanban project. You can import it to restore or transfer your data.",
      schemaVersion:
        "Always required. Tells the app how to read this file. Current version is 1.",
      users:
        "Global user list (name and role only — PINs are never exported). Imported users will need to set a new PIN on first login.",
      "project.columns":
        "Columns in order. Each column contains its cards in order.",
      "project.cards.order": "0-based position of the card within its column.",
      "project.cards.assigneeName":
        "Assignee stored by name (not ID) for readability. On import, matched case-insensitively against existing users; unmatched names are auto-created.",
      "project.cards.tags":
        "Array of tag IDs referencing the project.tags array.",
      "project.swimlanes":
        "Optional. Array of swimlane names. Set active:true to enable swimlanes on import. Set active:false to import the names without enabling swimlanes.",
      omittingFields:
        "Most fields are optional on import. Missing fields get defaults (empty string, empty list, null, false).",
      unknownFields:
        "Unknown or extra fields are silently ignored — the app will never crash on unexpected input.",
      importModes:
        "'replace' wipes this project and replaces all data. 'merge' adds new items and skips existing ones (conflicts are reported).",
      pinHandling:
        "PINs are never exported. Imported users are created with default PIN 0000 — they can log in immediately.",
      badColumnRef:
        "If a card references a column that does not exist, it is placed in an Unassigned holding area. Move it manually to the correct column.",
      activity:
        "Optional. If omitted on import, the activity log for this project starts fresh.",
      filterPresets: "Optional. Saved filter configurations for this project.",
    },
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    users: exportedUsers,
    project: {
      id: projectId.toString(),
      name: projectName,
      columns: exportColumns,
      tags: exportedTags,
      activity: activityRevisions,
      filterPresets: exportedPresets,
      swimlanes: exportedSwimlanes,
    },
  };

  return JSON.stringify(payload, null, 2);
}

export async function exportProject(
  actor: backendInterface,
  projectId: bigint,
  projectName: string,
): Promise<void> {
  const jsonStr = await exportProjectToString(actor, projectId, projectName);

  // Download
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().split("T")[0];
  a.download = `${projectName.replace(/[^a-z0-9]/gi, "-")}-export-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importProject(
  actor: backendInterface,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawPayload: any,
  projectId: bigint,
  activeUserId: bigint,
  importMode: "replace" | "merge",
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: [],
    unassignedCardCount: 0,
    unassignedCardTitles: [],
    counts: {
      usersImported: 0,
      columnsImported: 0,
      cardsImported: 0,
      tagsImported: 0,
      commentsImported: 0,
      filterPresetsImported: 0,
      swimlanesImported: 0,
    },
  };

  try {
    // ── 1. Schema migration ────────────────────────────────────────────────
    const schemaVersion = rawPayload?.schemaVersion;
    if (!schemaVersion || schemaVersion < 1) {
      result.warnings.push(
        "schemaVersion is missing or older than 1; attempting import with defaults.",
      );
    } else if (schemaVersion > 1) {
      result.warnings.push(
        `schemaVersion is ${schemaVersion} (newer than expected 1); unknown fields will be ignored.`,
      );
    }

    const payload = rawPayload as Partial<KanbanExport>;
    const projectPayload = payload?.project;

    if (!projectPayload) {
      result.errors.push("Import file is missing the 'project' field.");
      return result;
    }

    // ── 2. Replace mode: wipe existing data ────────────────────────────────
    if (importMode === "replace") {
      try {
        const [existingColumns, existingTags, existingPresets] =
          await Promise.all([
            actor.getColumns(projectId),
            actor.getProjectTags(projectId),
            actor.getFilterPresets(projectId),
          ]);

        // Delete columns (which also removes their cards on the backend)
        await Promise.all(
          existingColumns.map((col) =>
            actor.deleteColumn(col.id, activeUserId).catch((e: unknown) => {
              result.warnings.push(
                `Could not delete column "${col.name}": ${String(e)}`,
              );
            }),
          ),
        );

        // Delete tags
        await Promise.all(
          existingTags.map((tag) =>
            actor.deleteTag(tag.id, activeUserId).catch((e: unknown) => {
              result.warnings.push(
                `Could not delete tag "${tag.name}": ${String(e)}`,
              );
            }),
          ),
        );

        // Delete filter presets
        await Promise.all(
          existingPresets.map((preset) =>
            actor
              .deleteFilterPreset(preset.id, activeUserId)
              .catch((e: unknown) => {
                result.warnings.push(
                  `Could not delete preset "${preset.name}": ${String(e)}`,
                );
              }),
          ),
        );
      } catch (e) {
        result.errors.push(
          `Failed to wipe existing project data: ${String(e)}`,
        );
        return result;
      }
    }

    // ── 3. Import users ────────────────────────────────────────────────────
    const userIdMap = new Map<string, bigint>(); // original id -> new backend id
    const userNameMap = new Map<string, bigint>(); // lowercase name -> backend id

    const importedUsersPayload: ExportedUser[] = Array.isArray(payload.users)
      ? (payload.users as ExportedUser[])
      : [];

    // Pre-populate userNameMap with existing users
    {
      const existingUsers = await actor.getUsers().catch(() => []);
      for (const eu of existingUsers) {
        userNameMap.set(eu.name.toLowerCase(), eu.id);
      }
    }

    if (importedUsersPayload.length > 0) {
      let currentUsers = await actor.getUsers().catch(() => []);

      for (const u of importedUsersPayload) {
        try {
          const existing = currentUsers.find(
            (cu) => cu.name.toLowerCase() === (u.name ?? "").toLowerCase(),
          );
          if (existing) {
            result.warnings.push(
              `User "${u.name}" already exists — skipped, using existing ID.`,
            );
            userIdMap.set(String(u.id), existing.id);
            userNameMap.set(u.name.toLowerCase(), existing.id);
          } else {
            // Hash "0000" as default PIN so imported users can log in immediately
            const encoder = new TextEncoder();
            const data = encoder.encode("0000");
            const buffer = await crypto.subtle.digest("SHA-256", data);
            const defaultPinHash = Array.from(new Uint8Array(buffer))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            const newId = await actor.createUser(u.name, defaultPinHash);
            userIdMap.set(String(u.id), newId);
            userNameMap.set(u.name.toLowerCase(), newId);
            result.counts.usersImported++;
            result.warnings.push(
              `User "${u.name}" imported with default PIN 0000 — they can log in immediately and should change their PIN.`,
            );
            // Refresh user list after creation
            currentUsers = await actor.getUsers().catch(() => currentUsers);
          }
        } catch (e) {
          result.errors.push(`Failed to import user "${u.name}": ${String(e)}`);
        }
      }
    }

    // ── 4. Import tags ─────────────────────────────────────────────────────
    const tagIdMap = new Map<string, bigint>(); // original id -> new backend id

    const importedTags: ExportedTag[] = Array.isArray(projectPayload.tags)
      ? (projectPayload.tags as ExportedTag[])
      : [];

    if (importedTags.length > 0) {
      const currentTags = await actor.getProjectTags(projectId).catch(() => []);

      // Check if active user has admin privileges (required for tag creation)
      const allUsersForTagCheck = await actor.getUsers().catch(() => []);
      const activeUserObj = allUsersForTagCheck.find(
        (u) => u.id.toString() === activeUserId.toString(),
      );
      const canCreateTags =
        activeUserObj?.isAdmin === true ||
        activeUserObj?.isMasterAdmin === true;

      if (!canCreateTags) {
        // Still try to match existing tags by name, but skip creation
        for (const t of importedTags) {
          const existing = currentTags.find(
            (ct) => ct.name.toLowerCase() === (t.name ?? "").toLowerCase(),
          );
          if (existing) {
            tagIdMap.set(String(t.id), existing.id);
          }
        }
        result.warnings.push(
          "Tag creation requires admin privileges — new tags were not created. Existing tags were matched by name. Re-run the import while logged in as an admin to import new tags.",
        );
      } else {
        for (const t of importedTags) {
          try {
            const existing = currentTags.find(
              (ct) => ct.name.toLowerCase() === (t.name ?? "").toLowerCase(),
            );
            if (existing && importMode === "merge") {
              result.warnings.push(
                `Tag "${t.name}" already exists — using existing.`,
              );
              tagIdMap.set(String(t.id), existing.id);
            } else {
              const newId = await actor.createTag(
                projectId,
                t.name ?? "Unnamed Tag",
                t.color ?? "#94a3b8",
                activeUserId,
              );
              tagIdMap.set(String(t.id), newId);
              result.counts.tagsImported++;
            }
          } catch (e) {
            // Tag errors are warnings (non-fatal) — cards can still import without tags
            result.warnings.push(
              `Could not import tag "${t.name}": ${String(e)}`,
            );
          }
        }
      }
    }

    // ── 5. Import swimlanes ────────────────────────────────────────────────
    const importedSwimlanes: ExportedSwimlane[] = Array.isArray(
      projectPayload.swimlanes,
    )
      ? (projectPayload.swimlanes as ExportedSwimlane[])
      : [];

    if (importedSwimlanes.length > 0) {
      try {
        const currentSwimlanes = await actor
          .getSwimlanes(projectId)
          .catch(() => []);
        let shouldEnableSwimlanes = false;

        for (const sl of importedSwimlanes) {
          try {
            const existing = currentSwimlanes.find(
              (cs) => cs.name.toLowerCase() === (sl.name ?? "").toLowerCase(),
            );
            if (existing) {
              if (importMode === "merge") {
                result.warnings.push(
                  `Swimlane "${sl.name}" already exists — skipped.`,
                );
              }
              // Still check if we need to enable
              if (sl.active) shouldEnableSwimlanes = true;
            } else {
              await actor.createSwimlane(
                projectId,
                sl.name ?? "Unnamed Swimlane",
                activeUserId,
              );
              result.counts.swimlanesImported++;
              if (sl.active) shouldEnableSwimlanes = true;
            }
          } catch (e) {
            result.warnings.push(
              `Could not import swimlane "${sl.name}": ${String(e)}`,
            );
          }
        }

        // Enable swimlanes if any imported lane had active:true
        if (shouldEnableSwimlanes) {
          await actor
            .enableSwimlanes(projectId, activeUserId)
            .catch((e: unknown) => {
              result.warnings.push(`Could not enable swimlanes: ${String(e)}`);
            });
        }

        if (result.counts.swimlanesImported > 0) {
          result.warnings.push(
            `${result.counts.swimlanesImported} swimlane(s) imported.`,
          );
        }
      } catch (e) {
        result.warnings.push(`Swimlane import failed: ${String(e)}`);
      }
    }

    // ── 6. Import columns ──────────────────────────────────────────────────
    const columnIdMap = new Map<string, bigint>(); // original id -> new backend id

    const importedColumns: ExportedColumn[] = Array.isArray(
      projectPayload.columns,
    )
      ? (projectPayload.columns as ExportedColumn[])
      : [];

    for (const col of importedColumns) {
      try {
        if (importMode === "merge") {
          const currentCols = await actor.getColumns(projectId).catch(() => []);
          const existing = currentCols.find(
            (cc) => cc.name.toLowerCase() === (col.name ?? "").toLowerCase(),
          );
          if (existing) {
            result.warnings.push(
              `Column "${col.name}" already exists — using existing.`,
            );
            columnIdMap.set(String(col.id), existing.id);
            continue;
          }
        }
        const newId = await actor.createColumn(
          col.name ?? "Unnamed Column",
          activeUserId,
          projectId,
        );
        columnIdMap.set(String(col.id), newId);
        result.counts.columnsImported++;
      } catch (e) {
        result.errors.push(
          `Failed to import column "${col.name}": ${String(e)}`,
        );
      }
    }

    // ── 6 & 7. Import cards ────────────────────────────────────────────────
    const cardIdMap = new Map<string, bigint>();

    for (const col of importedColumns) {
      const targetColumnId = columnIdMap.get(String(col.id));

      // Sort cards by order field
      const sortedCards = [...(col.cards ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );

      for (const card of sortedCards) {
        if (!targetColumnId) {
          // Column reference is bad — mark as unassigned
          result.unassignedCardCount++;
          result.unassignedCardTitles.push(card.title ?? "(untitled)");
          continue;
        }

        try {
          const newCardId = await actor.createCard(
            card.title ?? "Untitled Card",
            card.description ?? null,
            targetColumnId,
            activeUserId,
            projectId,
          );
          cardIdMap.set(String(card.id), newCardId);
          result.counts.cardsImported++;

          // Assign user by name (new format) or legacy assignedUserId fallback
          const assigneeName =
            (card as ExportedCard & { assigneeName?: string | null })
              .assigneeName ?? null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legacyAssigneeId = (card as any).assignedUserId ?? null;

          if (assigneeName) {
            // Resolve by name (case-insensitive)
            const mappedUserId = userNameMap.get(assigneeName.toLowerCase());
            if (mappedUserId) {
              await actor
                .assignCard(newCardId, mappedUserId, activeUserId)
                .catch((e: unknown) => {
                  result.warnings.push(
                    `Could not assign card "${card.title}": ${String(e)}`,
                  );
                });
            } else {
              result.warnings.push(
                `Card "${card.title}": assignee "${assigneeName}" not found — left unassigned.`,
              );
            }
          } else if (legacyAssigneeId) {
            // Legacy ID-based fallback
            const mappedUserId = userIdMap.get(String(legacyAssigneeId));
            if (mappedUserId) {
              await actor
                .assignCard(newCardId, mappedUserId, activeUserId)
                .catch((e: unknown) => {
                  result.warnings.push(
                    `Could not assign card "${card.title}": ${String(e)}`,
                  );
                });
            } else {
              result.warnings.push(
                `Card "${card.title}": assigned user ID "${legacyAssigneeId}" not found — left unassigned.`,
              );
            }
          }

          // Apply tags
          if (Array.isArray(card.tags) && card.tags.length > 0) {
            const mappedTagIds = (card.tags as string[])
              .map((tid) => tagIdMap.get(tid))
              .filter((id): id is bigint => id !== undefined);
            if (mappedTagIds.length > 0) {
              await actor
                .updateCardTags(newCardId, mappedTagIds, activeUserId)
                .catch((e: unknown) => {
                  result.warnings.push(
                    `Could not apply tags to card "${card.title}": ${String(e)}`,
                  );
                });
            }
          }

          // Apply due date
          if (card.dueDate) {
            try {
              const dueDateBigInt = isoToBigintNs(card.dueDate);
              await actor
                .updateCardDueDate(newCardId, dueDateBigInt, activeUserId)
                .catch((e: unknown) => {
                  result.warnings.push(
                    `Could not set due date on card "${card.title}": ${String(e)}`,
                  );
                });
            } catch {
              result.warnings.push(
                `Card "${card.title}": invalid dueDate "${card.dueDate}" — skipped.`,
              );
            }
          }
        } catch (e) {
          result.errors.push(
            `Failed to import card "${card.title ?? "Untitled"}": ${String(e)}`,
          );
        }
      }
    }

    // ── 8. Import comments ─────────────────────────────────────────────────
    for (const col of importedColumns) {
      for (const card of col.cards ?? []) {
        const newCardId = cardIdMap.get(String(card.id));
        if (!newCardId) continue;

        for (const comment of card.comments ?? []) {
          try {
            await actor.addComment(newCardId, comment.text ?? "", activeUserId);
            result.counts.commentsImported++;
          } catch (e) {
            result.errors.push(
              `Failed to import comment on card "${card.title}": ${String(e)}`,
            );
          }
        }
      }
    }

    if (result.counts.commentsImported > 0) {
      result.warnings.push(
        `${result.counts.commentsImported} comment(s) were imported under the current active user (original authors cannot be restored).`,
      );
    }

    // ── 9. Import filter presets ───────────────────────────────────────────
    const importedPresets: ExportedFilterPreset[] = Array.isArray(
      projectPayload.filterPresets,
    )
      ? (projectPayload.filterPresets as ExportedFilterPreset[])
      : [];

    for (const preset of importedPresets) {
      try {
        const mappedAssigneeId = preset.assigneeId
          ? (userIdMap.get(String(preset.assigneeId)) ?? null)
          : null;
        const mappedTagIds = (preset.tagIds ?? [])
          .map((tid) => tagIdMap.get(String(tid)))
          .filter((id): id is bigint => id !== undefined);

        await actor.saveFilterPreset(
          projectId,
          activeUserId,
          preset.name ?? "Imported Preset",
          mappedAssigneeId,
          mappedTagIds,
          preset.unassignedOnly ?? false,
          preset.textSearch ?? "",
          preset.dateField ?? null,
          preset.dateFrom ?? "",
          preset.dateTo ?? "",
        );
        result.counts.filterPresetsImported++;
      } catch (e) {
        result.errors.push(
          `Failed to import filter preset "${preset.name}": ${String(e)}`,
        );
      }
    }

    // ── 10. Unassigned cards warning ───────────────────────────────────────
    if (result.unassignedCardCount > 0) {
      result.warnings.push(
        `${result.unassignedCardCount} card(s) could not be placed because their column reference was not found. Fix the columnId in your JSON and re-import, or create them manually.`,
      );
    }

    result.success = result.errors.length === 0;
  } catch (e) {
    result.errors.push(`Unexpected import error: ${String(e)}`);
    result.success = false;
  }

  return result;
}
