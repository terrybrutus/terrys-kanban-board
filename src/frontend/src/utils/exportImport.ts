import type { backendInterface } from "../backend.d";

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function bigintNsToIso(ns: bigint): string {
  return new Date(Number(ns) / 1_000_000).toISOString();
}

function isoToBigintNs(iso: string): bigint {
  return BigInt(new Date(iso).getTime()) * 1_000_000n;
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

export interface ExportedProject {
  id: string;
  name: string;
  columns: ExportedColumn[];
  tags: ExportedTag[];
  activity: ExportedRevision[];
  filterPresets: ExportedFilterPreset[];
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
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportProjectToString(
  actor: backendInterface,
  projectId: bigint,
  projectName: string,
): Promise<string> {
  // Fetch all top-level data in parallel
  const [columns, cards, users, tags, revisions, filterPresets] =
    await Promise.all([
      actor.getColumns(projectId),
      actor.getCards(projectId),
      actor.getUsers(),
      actor.getProjectTags(projectId),
      actor.getRevisions(projectId),
      actor.getFilterPresets(projectId),
    ]);

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

    // ── 5. Import columns ──────────────────────────────────────────────────
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
