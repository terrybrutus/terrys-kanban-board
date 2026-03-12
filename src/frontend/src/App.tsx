import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { buildSnapshotJson } from "@/utils/exportImport";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart2,
  ChevronDown,
  Clock,
  Crown,
  Database,
  Eye,
  EyeOff,
  Kanban,
  Layers,
  LayoutDashboard,
  Loader2,
  Plus,
  Redo2,
  RefreshCw,
  Shield,
  Tag,
  Undo2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Card, ColumnView } from "./backend.d";
import AccessKeyGate from "./components/AccessKeyGate";
import ActivityTab from "./components/ActivityTab";
import BulkCardImport from "./components/BulkCardImport";
import DashboardTab from "./components/DashboardTab";
import FilterBar, {
  EMPTY_FILTER,
  isFilterActive,
  type FilterState,
} from "./components/FilterBar";
import KanbanCard from "./components/KanbanCard";
import KanbanColumn from "./components/KanbanColumn";
import ProjectExportImport from "./components/ProjectExportImport";
import ProjectSwitcher from "./components/ProjectSwitcher";
import SnapshotsPanel from "./components/SnapshotsPanel";
import SwimlanesModal from "./components/SwimlanesModal";
import TagsModal from "./components/TagsModal";
import TutorialApp from "./components/TutorialApp";
import { hashPin } from "./components/UsersTab";
import { MasterAdminSetup } from "./components/UsersTab";
import UsersTab from "./components/UsersTab";
import { useActor } from "./hooks/useActor";
import {
  useArchiveCard,
  useArchivedCards,
  useAssignCard,
  useCards,
  useColumns,
  useCreateCard,
  useCreateColumn,
  useDeleteCard,
  useDeleteColumn,
  useDeleteFilterPreset,
  useDisableSwimlanes,
  useEnableSwimlanes,
  useFilterPresets,
  useInitDefaultProject,
  useIsAdminSetup,
  useMoveCard,
  useProjectTags,
  useProjects,
  useRenameColumn,
  useRenameUser,
  useReorderColumns,
  useRestoreCard,
  useSaveFilterPreset,
  useSetColumnComplete,
  useSwimlanes,
  useUpdateCard,
  useUpdateCardDueDate,
  useUpdateCardSwimlane,
  useUpdateCardTags,
  useUsers,
  useVerifyPin,
} from "./hooks/useQueries";
import type { User } from "./hooks/useQueries";
import { useUndoRedo } from "./hooks/useUndoRedo";

type TabId = "board" | "users" | "activity" | "dashboard" | "snapshots";

// Detect tutorial route at module level (safe — no hooks needed)
const IS_TUTORIAL =
  window.location.pathname === "/tutorial" ||
  window.location.pathname.startsWith("/tutorial/");

export default function App() {
  // Render the tutorial app immediately — no backend calls
  if (IS_TUTORIAL) {
    return <TutorialApp />;
  }

  return <AppInner />;
}

function AppInner() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Access key gate ─────────────────────────────────────────────────────────
  const [gateUnlocked, setGateUnlocked] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setIsRefreshing(false);
    }
  }

  // ── Admin setup check ───────────────────────────────────────────────────────
  const { data: isAdminSetupDone, isLoading: isAdminSetupLoading } =
    useIsAdminSetup();
  const [adminSetupComplete, setAdminSetupComplete] = useState(false);

  // Show setup overlay if master admin not yet created
  const showSetupOverlay =
    !isAdminSetupLoading && isAdminSetupDone === false && !adminSetupComplete;

  // ── Active project state ────────────────────────────────────────────────────
  const [activeProjectId, setActiveProjectId] = useState<bigint | null>(null);

  const { data: projects = [] } = useProjects();
  const { data: columns = [], isLoading: columnsLoading } =
    useColumns(activeProjectId);
  const { data: cards = [], isLoading: cardsLoading } =
    useCards(activeProjectId);
  const { data: users = [] } = useUsers();
  const { data: projectTags = [] } = useProjectTags(activeProjectId);
  const { data: filterPresets = [] } = useFilterPresets(activeProjectId);
  const { mutateAsync: saveFilterPreset } = useSaveFilterPreset();
  const { mutateAsync: deleteFilterPreset } = useDeleteFilterPreset();
  const { data: swimlanes = [] } = useSwimlanes(activeProjectId);

  // ── Init default project on first actor availability ────────────────────────
  const { mutateAsync: initDefaultProject } = useInitDefaultProject();
  const [projectInitialized, setProjectInitialized] = useState(false);

  useEffect(() => {
    if (actor && !actorFetching && !projectInitialized) {
      setProjectInitialized(true);
      initDefaultProject()
        .then((projectId) => {
          setActiveProjectId(projectId);
        })
        .catch(() => {
          // Silently ignore
        });
    }
  }, [actor, actorFetching, projectInitialized, initDefaultProject]);

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("board");

  // ── Active user (local session) ─────────────────────────────────────────────
  const [activeUser, setActiveUser] = useState<User | null>(null);

  // When users list refreshes (e.g. after promote/demote), re-sync active user
  useEffect(() => {
    if (activeUser && users.length > 0) {
      const updated = users.find((u) => u.id === activeUser.id);
      if (
        updated &&
        (updated.isAdmin !== activeUser.isAdmin ||
          updated.isMasterAdmin !== activeUser.isMasterAdmin)
      ) {
        setActiveUser(updated);
      }
    }
  }, [users, activeUser]);

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  const { pushSnapshot, undo, redo, clearAll, canUndo, canRedo } =
    useUndoRedo();

  // ── Auto-snapshot helper ─────────────────────────────────────────────────────
  // Awaits the backend snapshot before allowing the destructive action to proceed.
  // This ensures the snapshot captures state BEFORE the destruction, not after.
  const autoSnapshot = useCallback(
    async (label: string): Promise<void> => {
      if (!actor || !activeUser || !activeProjectId) return;
      try {
        const projectName =
          projects.find((p) => p.id === activeProjectId)?.name ?? "Project";
        const jsonStr = await buildSnapshotJson(
          actor,
          activeProjectId,
          projectName,
        );
        await actor.storeSnapshot(label, jsonStr, activeUser.id);
      } catch {
        // Silent — auto-snapshots are best-effort; never block the user action
      }
    },
    [actor, activeUser, activeProjectId, projects],
  );

  // ── Undo/Redo keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (activeTab !== "board") return;
      // Don't fire when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlOrCmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const snap = undo();
        if (snap) {
          queryClient.setQueryData(
            ["cards", activeProjectId?.toString() ?? "none"],
            snap.cards,
          );
          queryClient.setQueryData(
            ["columns", activeProjectId?.toString() ?? "none"],
            snap.columns,
          );
          toast.success(
            "Undone (session only — do not refresh or the undo will be lost)",
          );
        }
      }
      if (ctrlOrCmd && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        const snap = redo();
        if (snap) {
          queryClient.setQueryData(
            ["cards", activeProjectId?.toString() ?? "none"],
            snap.cards,
          );
          queryClient.setQueryData(
            ["columns", activeProjectId?.toString() ?? "none"],
            snap.columns,
          );
          toast.success(
            "Redone (session only — do not refresh or the redo will be lost)",
          );
        }
      }
      if (ctrlOrCmd && e.key === "y") {
        e.preventDefault();
        const snap = redo();
        if (snap) {
          queryClient.setQueryData(
            ["cards", activeProjectId?.toString() ?? "none"],
            snap.cards,
          );
          queryClient.setQueryData(
            ["columns", activeProjectId?.toString() ?? "none"],
            snap.columns,
          );
          toast.success(
            "Redone (session only — do not refresh or the redo will be lost)",
          );
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, undo, redo, queryClient, activeProjectId]);

  // ── Tags modal ──────────────────────────────────────────────────────────────
  const [showTagsModal, setShowTagsModal] = useState(false);

  // ── Project settings (export/import) modal ──────────────────────────────────
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  // ── Bulk card import modal ──────────────────────────────────────────────────
  const [bulkImportColumn, setBulkImportColumn] = useState<ColumnView | null>(
    null,
  );

  // ── Auth gate helper ────────────────────────────────────────────────────────
  function requireActiveUser(): boolean {
    if (!activeUser) {
      toast.error("Please set yourself as active in the Users tab first");
      return false;
    }
    return true;
  }

  // ── Column mutations ────────────────────────────────────────────────────────
  const { mutateAsync: createColumn } = useCreateColumn();
  const { mutateAsync: renameColumn } = useRenameColumn();
  const { mutateAsync: deleteColumn } = useDeleteColumn();
  const { mutateAsync: reorderColumns } = useReorderColumns();
  const { mutateAsync: setColumnComplete } = useSetColumnComplete();

  // ── Card mutations ──────────────────────────────────────────────────────────
  const { mutateAsync: createCard } = useCreateCard();
  const { mutateAsync: updateCard } = useUpdateCard();
  const { mutateAsync: deleteCard } = useDeleteCard();
  const { mutateAsync: moveCard } = useMoveCard();
  const { mutateAsync: assignCard } = useAssignCard();
  const { mutateAsync: updateCardTags } = useUpdateCardTags();
  const { mutateAsync: updateCardDueDate } = useUpdateCardDueDate();
  const { mutateAsync: archiveCard } = useArchiveCard();
  const { mutateAsync: restoreCard } = useRestoreCard();
  const { mutateAsync: updateCardSwimlane } = useUpdateCardSwimlane();
  const { mutateAsync: renameUser } = useRenameUser();
  const { mutateAsync: enableSwimlanes } = useEnableSwimlanes();
  const { mutateAsync: disableSwimlanes } = useDisableSwimlanes();

  // ── Swimlanes modal ─────────────────────────────────────────────────────────
  const [showSwimlanesModal, setShowSwimlanesModal] = useState(false);

  // Derive swimlanesEnabled from current project
  const swimlanesEnabled =
    projects.find((p) => p.id === activeProjectId)?.swimlanesEnabled ?? false;

  // ── Column sort (visual-only, per project, localStorage) ────────────────────
  type ColumnSortDir = "asc" | "desc" | null;
  const colSortKey = `col_sort_${activeProjectId?.toString() ?? "none"}`;
  const [columnSortDir, setColumnSortDir] = useState<ColumnSortDir>(() => {
    try {
      const saved = localStorage.getItem(colSortKey);
      if (saved === "asc" || saved === "desc") return saved;
    } catch {}
    return null;
  });

  function cycleColumnSort() {
    setColumnSortDir((prev) => {
      let next: ColumnSortDir;
      if (prev === null) next = "asc";
      else if (prev === "asc") next = "desc";
      else next = null;
      try {
        if (next === null) localStorage.removeItem(colSortKey);
        else localStorage.setItem(colSortKey, next);
      } catch {}
      return next;
    });
  }

  // Reset sort when project changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(colSortKey);
      if (saved === "asc" || saved === "desc") setColumnSortDir(saved);
      else setColumnSortDir(null);
    } catch {
      setColumnSortDir(null);
    }
  }, [colSortKey]);

  // ── Hidden columns (per user per project, localStorage) ─────────────────────
  const hiddenColsKey = `hidden_cols_${activeProjectId?.toString() ?? "none"}_${activeUser?.id?.toString() ?? "anon"}`;

  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(hiddenColsKey);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    return new Set();
  });

  // Reset hidden cols when project or user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(hiddenColsKey);
      if (saved) setHiddenColumnIds(new Set(JSON.parse(saved) as string[]));
      else setHiddenColumnIds(new Set());
    } catch {
      setHiddenColumnIds(new Set());
    }
  }, [hiddenColsKey]);

  function hideColumn(columnId: bigint) {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev);
      next.add(columnId.toString());
      try {
        localStorage.setItem(hiddenColsKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  function unhideColumn(columnId: string) {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev);
      next.delete(columnId);
      try {
        localStorage.setItem(hiddenColsKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  const [showHiddenColsPopover, setShowHiddenColsPopover] = useState(false);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);

  // Only fetch archived cards when the user has explicitly toggled "show archived".
  // Fetching them on every project load wastes a canister call on initial board render.
  const { data: archivedCards = [] } = useArchivedCards(
    filters.showArchived ? activeProjectId : null,
  );

  // ── Quick user switcher state ────────────────────────────────────────────────
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherTarget, setSwitcherTarget] = useState<User | null>(null);
  const [switcherPin, setSwitcherPin] = useState("");
  const [switcherError, setSwitcherError] = useState("");
  const [switcherVerifying, setSwitcherVerifying] = useState(false);
  const { mutateAsync: verifyPin } = useVerifyPin();

  // ── Add column state ────────────────────────────────────────────────────────
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  async function submitAddColumn() {
    if (!requireActiveUser()) return;
    if (!activeProjectId) {
      toast.error("No active project selected");
      return;
    }
    const trimmed = newColumnName.trim();
    if (!trimmed) return;
    setIsAddingColumn(true);
    try {
      await createColumn({
        name: trimmed,
        actorUserId: activeUser!.id,
        projectId: activeProjectId,
      });
      setNewColumnName("");
      setAddingColumn(false);
      toast.success(`Column "${trimmed}" created`);
    } catch {
      toast.error("Failed to create column");
    } finally {
      setIsAddingColumn(false);
    }
  }

  function handleOpenAddColumn() {
    if (!requireActiveUser()) return;
    setAddingColumn(true);
  }

  // ── Column handler callbacks ────────────────────────────────────────────────
  const handleAddCard = useCallback(
    async (
      columnId: bigint,
      title: string,
      description: string | null,
    ): Promise<bigint> => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      if (!activeProjectId) {
        toast.error("No active project selected");
        throw new Error("No active project");
      }
      try {
        return await createCard({
          title,
          description,
          columnId,
          actorUserId: activeUser.id,
          projectId: activeProjectId,
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === "No active user" ||
            err.message === "No active project")
        )
          throw err;
        toast.error("Failed to add card");
        throw new Error("Failed to add card");
      }
    },
    [createCard, activeUser, activeProjectId],
  );

  const handleBulkCreateCard = useCallback(
    async (
      columnId: bigint,
      title: string,
      description: string | null,
    ): Promise<bigint> => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      if (!activeProjectId) {
        toast.error("No active project selected");
        throw new Error("No active project");
      }
      return createCard({
        title,
        description,
        columnId,
        actorUserId: activeUser.id,
        projectId: activeProjectId,
      });
    },
    [createCard, activeUser, activeProjectId],
  );

  const handleUpdateCard = useCallback(
    async (cardId: bigint, title: string, description: string | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }

      // Capture state before the action for undo
      pushSnapshot({ cards, columns, swimlanes });

      try {
        await updateCard({
          cardId,
          title,
          description,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to update card");
        throw new Error("Failed to update card");
      }
    },
    [
      updateCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
    ],
  );

  const handleDeleteCard = useCallback(
    async (cardId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      // In-memory snapshot for session undo + backend auto-snapshot for failsafe
      pushSnapshot({ cards, columns, swimlanes });
      const deletedCard = cards.find((c) => c.id === cardId);
      await autoSnapshot(
        `Before deleting card '${deletedCard?.title ?? String(cardId)}'`,
      );
      try {
        await deleteCard({
          cardId,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to delete card");
        throw new Error("Failed to delete card");
      }
    },
    [
      deleteCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
      autoSnapshot,
    ],
  );

  const handleMoveCard = useCallback(
    async (cardId: bigint, targetColumnId: bigint, newPosition: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }

      // Snapshot before the move
      pushSnapshot({ cards, columns, swimlanes });

      try {
        await moveCard({
          cardId,
          targetColumnId,
          newPosition,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to move card");
        throw new Error("Failed to move card");
      }
    },
    [
      moveCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
    ],
  );

  const handleRenameColumn = useCallback(
    async (columnId: bigint, newName: string) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await renameColumn({
          columnId,
          newName,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to rename column");
        throw new Error("Failed to rename column");
      }
    },
    [renameColumn, activeUser, activeProjectId],
  );

  const handleSetColumnComplete = useCallback(
    async (columnId: bigint, isComplete: boolean) => {
      if (!activeUser) {
        toast.error("Please set yourself as active first");
        return;
      }
      try {
        await setColumnComplete({
          columnId,
          isComplete,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
        toast.success(
          isComplete ? "Column marked as complete" : "Column unmarked",
        );
      } catch {
        toast.error("Failed to update column");
      }
    },
    [setColumnComplete, activeUser, activeProjectId],
  );

  const handleDeleteColumn = useCallback(
    async (columnId: bigint, destinationColumnId?: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }

      const capturedColumn = columns.find((c) => c.id === columnId);
      const capturedCardIds = capturedColumn?.cardIds ?? [];
      const capturedUserId = activeUser.id;
      const capturedProjectId = activeProjectId;

      // In-memory snapshot for session undo + backend auto-snapshot for failsafe
      pushSnapshot({ cards, columns, swimlanes });
      const deletedColName =
        columns.find((c) => c.id === columnId)?.name ?? String(columnId);
      const deletedColCardCount =
        columns.find((c) => c.id === columnId)?.cardIds.length ?? 0;
      await autoSnapshot(
        `Before deleting column '${deletedColName}' · ${deletedColCardCount} card${deletedColCardCount !== 1 ? "s" : ""} moved`,
      );

      try {
        // STEP 1: Move all cards one-by-one to destination (avoids backend moveCards stale-reference bug)
        if (destinationColumnId != null && capturedCardIds.length > 0) {
          const targetCol = columns.find((c) => c.id === destinationColumnId);
          let position = BigInt(targetCol?.cardIds.length ?? 0);
          for (const cardId of capturedCardIds) {
            await moveCard({
              cardId,
              targetColumnId: destinationColumnId,
              newPosition: position,
              actorUserId: capturedUserId,
              projectId: capturedProjectId ?? undefined,
            });
            position += 1n;
          }
          // Wait for state to settle before deleting the now-empty column
          await new Promise((r) => setTimeout(r, 300));
        }

        // STEP 2: Delete the column (now empty)
        await deleteColumn({
          columnId,
          actorUserId: capturedUserId,
          projectId: capturedProjectId ?? undefined,
        });
        toast.success("Column deleted");
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to delete column");
        throw new Error("Failed to delete column");
      }
    },
    [
      deleteColumn,
      moveCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
      autoSnapshot,
    ],
  );

  const handleAssignCard = useCallback(
    async (cardId: bigint, userId: bigint | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }

      pushSnapshot({ cards, columns, swimlanes });

      try {
        await assignCard({
          cardId,
          userId,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to assign card");
        throw new Error("Failed to assign card");
      }
    },
    [
      assignCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
    ],
  );

  const handleUpdateCardTags = useCallback(
    async (cardId: bigint, tagIds: bigint[]) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      if (!activeProjectId) throw new Error("No active project");

      pushSnapshot({ cards, columns, swimlanes });

      try {
        await updateCardTags({
          cardId,
          tagIds,
          actorUserId: activeUser.id,
          projectId: activeProjectId,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to update tags");
        throw new Error("Failed to update tags");
      }
    },
    [
      updateCardTags,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
    ],
  );

  const handleUpdateCardDueDate = useCallback(
    async (cardId: bigint, dueDate: bigint | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      if (!activeProjectId) throw new Error("No active project");

      pushSnapshot({ cards, columns, swimlanes });

      try {
        await updateCardDueDate({
          cardId,
          dueDate,
          actorUserId: activeUser.id,
          projectId: activeProjectId,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to update due date");
        throw new Error("Failed to update due date");
      }
    },
    [
      updateCardDueDate,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
    ],
  );

  // ── Archive / Restore handlers ──────────────────────────────────────────────
  const handleArchiveCard = useCallback(
    async (cardId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      pushSnapshot({ cards, columns, swimlanes });
      const archivedCardTitle =
        cards.find((c) => c.id === cardId)?.title ?? String(cardId);
      await autoSnapshot(`Before archiving card '${archivedCardTitle}'`);
      try {
        await archiveCard({
          cardId,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to archive card");
        throw new Error("Failed to archive card");
      }
    },
    [
      archiveCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
      autoSnapshot,
    ],
  );

  const handleRestoreCard = useCallback(
    async (cardId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      pushSnapshot({ cards, columns, swimlanes });
      try {
        await restoreCard({
          cardId,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to restore card");
        throw new Error("Failed to restore card");
      }
    },
    [
      restoreCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
    ],
  );

  const handleUpdateCardSwimlane = useCallback(
    async (cardId: bigint, swimlaneId: bigint | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await updateCardSwimlane({
          cardId,
          swimlaneId,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to update swimlane");
        throw new Error("Failed to update swimlane");
      }
    },
    [updateCardSwimlane, activeUser, activeProjectId],
  );

  const handleQuickAdd = useCallback(
    async (
      columnId: bigint,
      title: string,
      tagIds: bigint[],
      assigneeId: bigint | null,
      dueDate: bigint | null,
      swimlaneId: bigint | null,
    ) => {
      if (!activeUser) {
        toast.error("Please set yourself as active first");
        throw new Error("No active user");
      }
      if (!activeProjectId) throw new Error("No active project");
      const cardId = await createCard({
        title,
        description: null,
        columnId,
        actorUserId: activeUser.id,
        projectId: activeProjectId,
      });
      if (tagIds.length > 0) {
        await updateCardTags({
          cardId,
          tagIds,
          actorUserId: activeUser.id,
          projectId: activeProjectId,
        });
      }
      if (assigneeId !== null) {
        await assignCard({
          cardId,
          userId: assigneeId,
          actorUserId: activeUser.id,
          projectId: activeProjectId,
        });
      }
      if (dueDate !== null) {
        await updateCardDueDate({
          cardId,
          dueDate,
          actorUserId: activeUser.id,
          projectId: activeProjectId,
        });
      }
      if (swimlaneId !== null) {
        await updateCardSwimlane({
          cardId,
          swimlaneId,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        });
      }
    },
    [
      createCard,
      updateCardTags,
      assignCard,
      updateCardDueDate,
      updateCardSwimlane,
      activeUser,
      activeProjectId,
    ],
  );

  const handleRenameUser = useCallback(
    async (userId: bigint, newName: string) => {
      if (!activeUser) return;
      try {
        await renameUser({ userId, newName, actorUserId: activeUser.id });
        // Re-sync active user if it's the renamed user
        if (activeUser.id === userId) {
          setActiveUser((prev) => (prev ? { ...prev, name: newName } : prev));
        }
      } catch {
        toast.error("Failed to rename user");
      }
    },
    [renameUser, activeUser],
  );

  // enableSwimlanes and disableSwimlanes are used by SwimlanesModal internally via hooks
  // but we keep them here in case they're needed for future direct calls
  void enableSwimlanes;
  void disableSwimlanes;

  // ── Filter preset handlers ──────────────────────────────────────────────────
  const handleSavePreset = useCallback(
    async (name: string) => {
      if (!activeUser || !activeProjectId) {
        toast.error("Please set yourself as active first");
        throw new Error("No active user or project");
      }
      try {
        await saveFilterPreset({
          projectId: activeProjectId,
          createdByUserId: activeUser.id,
          name,
          assigneeId: filters.assigneeId,
          tagIds: filters.tagIds.map((id) => BigInt(id)),
          unassignedOnly: filters.unassignedOnly,
          textSearch: filters.textSearch,
          dateField: filters.dateField,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        });
        toast.success(`Preset "${name}" saved`);
      } catch {
        toast.error("Failed to save preset");
        throw new Error("Failed to save preset");
      }
    },
    [saveFilterPreset, activeUser, activeProjectId, filters],
  );

  const handleDeletePreset = useCallback(
    async (presetId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active first");
        throw new Error("No active user");
      }
      try {
        await deleteFilterPreset({ presetId, actorUserId: activeUser.id });
        toast.success("Preset deleted");
      } catch {
        toast.error("Failed to delete preset");
        throw new Error("Failed to delete preset");
      }
    },
    [deleteFilterPreset, activeUser],
  );

  const handleApplyPreset = useCallback(
    (preset: import("./backend.d").FilterPreset) => {
      setFilters({
        assigneeId: preset.assigneeId ?? null,
        tagIds: preset.tagIds.map((id) => id.toString()),
        unassignedOnly: preset.unassignedOnly,
        textSearch: preset.textSearch,
        dateField:
          (preset.dateField as "createdAt" | "dueDate" | undefined) ?? null,
        dateFrom: preset.dateFrom,
        dateTo: preset.dateTo,
        showArchived: false,
      });
      toast.success(`Applied preset "${preset.name}"`);
    },
    [],
  );

  // ── Multi-move handler ──────────────────────────────────────────────────────
  const handleMoveCards = useCallback(
    async (cardIds: bigint[], targetColumnId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }

      // In-memory snapshot for session undo + backend auto-snapshot for failsafe
      pushSnapshot({ cards, columns, swimlanes });
      const targetColName =
        columns.find((c) => c.id === targetColumnId)?.name ??
        String(targetColumnId);
      await autoSnapshot(
        `Before moving ${cardIds.length} card${cardIds.length !== 1 ? "s" : ""} to '${targetColName}'`,
      );

      try {
        // Use sequential moveCard calls to work around backend moveCards stale-reference bug
        const targetCol = columns.find((c) => c.id === targetColumnId);
        let position = BigInt(targetCol?.cardIds.length ?? 0);
        for (const cardId of cardIds) {
          await moveCard({
            cardId,
            targetColumnId,
            newPosition: position,
            actorUserId: activeUser.id,
            projectId: activeProjectId ?? undefined,
          });
          position += 1n;
        }
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to move cards");
        throw new Error("Failed to move cards");
      }
    },
    [
      moveCard,
      activeUser,
      activeProjectId,
      cards,
      columns,
      swimlanes,
      pushSnapshot,
      autoSnapshot,
    ],
  );

  // ── Quick switcher: confirm PIN ─────────────────────────────────────────────
  async function handleSwitcherConfirm() {
    if (!switcherTarget || switcherPin.length !== 4) return;
    setSwitcherVerifying(true);
    setSwitcherError("");
    try {
      const pinHash = await hashPin(switcherPin);
      const valid = await verifyPin({ userId: switcherTarget.id, pinHash });
      if (!valid) {
        setSwitcherError("Incorrect PIN");
        return;
      }
      setActiveUser(switcherTarget);
      toast.success(`Now active as "${switcherTarget.name}"`);
      setSwitcherOpen(false);
      setSwitcherPin("");
      setSwitcherTarget(null);
    } catch {
      setSwitcherError("Verification failed");
    } finally {
      setSwitcherVerifying(false);
    }
  }

  // ── Filtering logic ─────────────────────────────────────────────────────────
  function applyFilters(columnCards: Card[]): Card[] {
    return columnCards.filter((card) => {
      // Archived filter — by default hide archived cards; if showArchived, show only archived
      if (filters.showArchived) {
        if (!card.isArchived) return false;
      } else {
        if (card.isArchived) return false;
      }
      // Text search
      if (filters.textSearch) {
        const q = filters.textSearch.toLowerCase();
        const titleMatch = card.title.toLowerCase().includes(q);
        const descMatch = card.description?.toLowerCase().includes(q) ?? false;
        if (!titleMatch && !descMatch) return false;
      }
      // Unassigned only
      if (filters.unassignedOnly) {
        if (card.assignedUserId != null) return false;
      }
      // Assignee filter
      if (filters.assigneeId !== null) {
        if (card.assignedUserId?.toString() !== filters.assigneeId.toString())
          return false;
      }
      // Tag filter (card must have ANY of the selected tags — OR logic)
      if (filters.tagIds.length > 0) {
        const cardTagStrs = (card.tags ?? []).map((t) => t.toString());
        const hasAny = filters.tagIds.some((tid) => cardTagStrs.includes(tid));
        if (!hasAny) return false;
      }
      // Date range filter
      if (filters.dateField && (filters.dateFrom || filters.dateTo)) {
        let tsMs: number | null = null;
        if (filters.dateField === "createdAt") {
          tsMs = Number(card.createdAt) / 1_000_000;
        } else if (filters.dateField === "dueDate" && card.dueDate != null) {
          tsMs = Number(card.dueDate) / 1_000_000;
        }
        if (tsMs === null) return false;
        if (filters.dateFrom) {
          const fromMs = new Date(filters.dateFrom).getTime();
          if (tsMs < fromMs) return false;
        }
        if (filters.dateTo) {
          // Include the full end date day
          const toMs = new Date(filters.dateTo).getTime() + 86_400_000;
          if (tsMs > toMs) return false;
        }
      }
      return true;
    });
  }

  // ── Compute filter result count for the filter bar summary ─────────────────
  const filterResultCount: number | null = (() => {
    if (!isFilterActive(filters)) return null;
    const baseCards = filters.showArchived
      ? [...cards.filter((c) => !c.isArchived), ...archivedCards]
      : cards;
    return applyFilters(baseCards).length;
  })();
  const totalCardCount = cards.filter((c) => !c.isArchived).length;

  // ── Compute cards per column ────────────────────────────────────────────────
  function getCardsForColumn(column: ColumnView): Card[] {
    const cardMap = new Map(cards.map((c) => [c.id.toString(), c]));
    return column.cardIds
      .map((id) => cardMap.get(id.toString()))
      .filter((c): c is Card => c !== undefined);
  }

  // ── Drag and Drop ───────────────────────────────────────────────────────────
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  // Optimistic local column → cards map for smooth card drag UI
  const [localColumnsOverride, setLocalColumnsOverride] = useState<Map<
    string,
    string[]
  > | null>(null);
  // Optimistic local column order for column drag
  const [localColumnOrder, setLocalColumnOrder] = useState<ColumnView[] | null>(
    null,
  );
  // Track whether a backend call is in progress so we don't double-fire
  const dndPendingRef = useRef(false);

  // ── Horizontal scroll on board background ───────────────────────────────────
  const boardScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (!el) return;
      const target = e.target as HTMLElement;

      // Don't intercept if inside a Radix scroll area (card modal, etc.)
      if (target.closest("[data-radix-scroll-area-viewport]")) return;

      // Don't intercept vertical scroll within a column's card list
      const columnScrollBody = target.closest(".overflow-y-auto");
      if (columnScrollBody && columnScrollBody !== el) return;

      // Always intercept: scroll horizontally on shift+wheel, or when board overflows
      if (e.shiftKey || el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.2;
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Column sortable IDs (for SortableContext)
  const columnSortableIds = (localColumnOrder ?? columns).map(
    (col) => `col-header-${col.id.toString()}`,
  );

  function buildLocalMap(cols: ColumnView[]): Map<string, string[]> {
    return new Map(
      cols.map((col) => [
        col.id.toString(),
        col.cardIds.map((id) => id.toString()),
      ]),
    );
  }

  function findColumnForCard(
    cardIdStr: string,
    colMap: Map<string, string[]>,
  ): string | null {
    for (const [colId, cardIds] of colMap.entries()) {
      if (cardIds.includes(cardIdStr)) return colId;
    }
    return null;
  }

  function handleDragStart({ active }: DragStartEvent) {
    const activeId = active.id as string;
    if (activeId.startsWith("col-header-")) {
      // Column drag
      setDraggingColumnId(activeId);
      setLocalColumnOrder(columns);
    } else {
      // Card drag
      setDraggingCardId(activeId);
      setLocalColumnsOverride(buildLocalMap(columns));
    }
  }

  /** Parse a swimlane droppable id like "swimlane-123-col-456" → { swimlaneId: "123", colId: "456" }
   *  or "swimlane-default-col-456" → { swimlaneId: null, colId: "456" }
   */
  function parseSwimlaneDropId(
    id: string,
  ): { swimlaneId: string | null; colId: string } | null {
    const m = id.match(/^swimlane-(.+)-col-(\d+)$/);
    if (!m) return null;
    return {
      swimlaneId: m[1] === "default" ? null : m[1],
      colId: m[2],
    };
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const activeId = active.id as string;

    // Column drag — reorder columns optimistically
    if (activeId.startsWith("col-header-")) {
      if (!over || !localColumnOrder) return;
      const overId = over.id as string;
      if (!overId.startsWith("col-header-")) return;

      const activeIndex = localColumnOrder.findIndex(
        (c) => `col-header-${c.id.toString()}` === activeId,
      );
      const overIndex = localColumnOrder.findIndex(
        (c) => `col-header-${c.id.toString()}` === overId,
      );
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex)
        return;

      setLocalColumnOrder((prev) => {
        if (!prev) return prev;
        return arrayMove(prev, activeIndex, overIndex);
      });
      return;
    }

    // Card drag
    if (!over || !localColumnsOverride) return;
    const overId = over.id as string;

    // Determine the target column
    let targetColId: string | null = null;
    if (overId.startsWith("swimlane-")) {
      const parsed = parseSwimlaneDropId(overId);
      if (parsed) targetColId = parsed.colId;
    } else if (overId.startsWith("col-")) {
      targetColId = overId.replace("col-", "");
    } else if (!overId.startsWith("col-header-")) {
      targetColId = findColumnForCard(overId, localColumnsOverride);
    }
    if (!targetColId) return;

    const sourceColId = findColumnForCard(activeId, localColumnsOverride);
    if (!sourceColId || sourceColId === targetColId) return;

    // Move the card between columns optimistically
    setLocalColumnsOverride((prev) => {
      if (!prev) return prev;
      const next = new Map(prev);
      const src = [...(next.get(sourceColId) ?? [])].filter(
        (id) => id !== activeId,
      );
      const dst = [...(next.get(targetColId!) ?? [])];
      dst.push(activeId);
      next.set(sourceColId, src);
      next.set(targetColId!, dst);
      return next;
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeId = active.id as string;

    // ── Column drag end ────────────────────────────────────────────────────────
    if (activeId.startsWith("col-header-")) {
      setDraggingColumnId(null);

      if (!localColumnOrder) {
        setLocalColumnOrder(null);
        return;
      }

      // Auth check
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        setLocalColumnOrder(null);
        return;
      }

      // Compare new order vs original
      const originalIds = columns.map((c) => c.id.toString());
      const newIds = localColumnOrder.map((c) => c.id.toString());
      const changed = originalIds.some((id, i) => id !== newIds[i]);

      if (!changed) {
        setLocalColumnOrder(null);
        return;
      }

      const newOrderBigInt = localColumnOrder.map((c) => c.id);
      const optimisticOrder = localColumnOrder;

      // Persist
      reorderColumns({
        newOrder: newOrderBigInt,
        actorUserId: activeUser.id,
        projectId: activeProjectId ?? undefined,
      })
        .catch(() => {
          toast.error("Failed to reorder columns");
          setLocalColumnOrder(null);
        })
        .finally(() => {
          setLocalColumnOrder(null);
        });

      // Keep optimistic order visible during the network call
      setLocalColumnOrder(optimisticOrder);
      return;
    }

    // ── Card drag end ──────────────────────────────────────────────────────────
    setDraggingCardId(null);

    if (!over || !localColumnsOverride || dndPendingRef.current) {
      setLocalColumnsOverride(null);
      return;
    }

    const overId = over.id as string;

    // Auth check for card move
    if (!activeUser) {
      toast.error("Please set yourself as active in the Users tab first");
      setLocalColumnsOverride(null);
      return;
    }

    // Determine target column + position + swimlane (if applicable)
    let targetColId: string | null = null;
    let targetCardId: string | null = null;
    let targetSwimlaneId: string | null | undefined = undefined; // undefined = no change

    if (overId.startsWith("swimlane-")) {
      const parsed = parseSwimlaneDropId(overId);
      if (parsed) {
        targetColId = parsed.colId;
        targetSwimlaneId = parsed.swimlaneId; // null = default lane, string = specific lane
      }
    } else if (overId.startsWith("col-")) {
      targetColId = overId.replace("col-", "");
    } else if (!overId.startsWith("col-header-")) {
      targetColId = findColumnForCard(overId, localColumnsOverride);
      targetCardId = overId;
    }

    if (!targetColId) {
      setLocalColumnsOverride(null);
      return;
    }

    // Determine position within target column
    const targetCards = localColumnsOverride.get(targetColId) ?? [];
    let newPosition: number;

    if (targetCardId && targetCardId !== activeId) {
      // Reorder within column or insert before target card
      const withoutActive = targetCards.filter((id) => id !== activeId);
      const overIndex = withoutActive.indexOf(targetCardId);
      const activeIndex = targetCards.indexOf(activeId);
      if (activeIndex !== -1 && overIndex !== -1) {
        // Same column reorder
        arrayMove(withoutActive, activeIndex, overIndex);
        newPosition = overIndex;
      } else {
        newPosition = overIndex >= 0 ? overIndex : withoutActive.length;
      }
    } else if (targetSwimlaneId !== undefined) {
      // Dropping onto a swimlane zone — scope position to cards in that swimlane only
      const targetSwimlaneIdBigInt =
        targetSwimlaneId !== null ? targetSwimlaneId : null;
      const swimlaneScopedCards = targetCards.filter((cardIdStr) => {
        if (cardIdStr === activeId) return false;
        const c = cards.find((card) => card.id.toString() === cardIdStr);
        if (!c) return false;
        const cardSwimlaneStr = c.swimlaneId?.toString() ?? null;
        return cardSwimlaneStr === targetSwimlaneIdBigInt;
      });
      newPosition = swimlaneScopedCards.length;
    } else {
      const withoutActive = targetCards.filter((id) => id !== activeId);
      newPosition = withoutActive.length;
    }

    // Find the original column for comparison
    const originalColId = findColumnForCard(activeId, buildLocalMap(columns));
    const originalCards =
      columns
        .find((c) => c.id.toString() === originalColId)
        ?.cardIds.map((id) => id.toString()) ?? [];
    const originalPosition = originalCards.indexOf(activeId);

    // Find the card to determine current swimlane
    const cardBigInt = cards.find((c) => c.id.toString() === activeId)?.id;
    const cardObj = cards.find((c) => c.id.toString() === activeId);

    // Check if swimlane changed
    const currentSwimlaneId = cardObj?.swimlaneId?.toString() ?? null;
    const swimlaneChanged =
      targetSwimlaneId !== undefined && targetSwimlaneId !== currentSwimlaneId;

    // Skip if nothing changed (column, position, AND swimlane are all same)
    if (
      targetColId === originalColId &&
      newPosition === originalPosition &&
      !swimlaneChanged
    ) {
      setLocalColumnsOverride(null);
      return;
    }

    // Convert IDs to bigint
    const targetColBigInt = columns.find(
      (c) => c.id.toString() === targetColId,
    )?.id;

    if (!targetColBigInt || !cardBigInt) {
      setLocalColumnsOverride(null);
      return;
    }

    // Persist to backend
    dndPendingRef.current = true;

    const ops: Promise<unknown>[] = [];

    // Column move (if column or position changed)
    if (targetColId !== originalColId || newPosition !== originalPosition) {
      ops.push(
        moveCard({
          cardId: cardBigInt,
          targetColumnId: targetColBigInt,
          newPosition: BigInt(newPosition),
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        }),
      );
    }

    // Swimlane move (if swimlane changed)
    if (swimlaneChanged && targetSwimlaneId !== undefined) {
      const newSwimlaneIdBigInt =
        targetSwimlaneId !== null ? BigInt(targetSwimlaneId) : null;
      ops.push(
        updateCardSwimlane({
          cardId: cardBigInt,
          swimlaneId: newSwimlaneIdBigInt,
          actorUserId: activeUser.id,
          projectId: activeProjectId ?? undefined,
        }),
      );
    }

    Promise.all(ops)
      .catch(() => {
        toast.error("Failed to move card");
      })
      .finally(() => {
        dndPendingRef.current = false;
        setLocalColumnsOverride(null);
      });
  }

  // ── Effective columns (uses optimistic order when column-dragging) ───────────
  // Apply column sort if active, then filter hidden columns
  const effectiveColumns = (() => {
    let cols = localColumnOrder ?? columns;
    // Apply alphabetical sort (visual-only — does not persist to backend)
    if (columnSortDir === "asc") {
      cols = [...cols].sort((a, b) => a.name.localeCompare(b.name));
    } else if (columnSortDir === "desc") {
      cols = [...cols].sort((a, b) => b.name.localeCompare(a.name));
    }
    // Filter hidden columns
    if (hiddenColumnIds.size > 0) {
      cols = cols.filter((c) => !hiddenColumnIds.has(c.id.toString()));
    }
    return cols;
  })();

  // Build effective columns/cards for rendering (uses optimistic override when dragging)
  function getEffectiveCardsForColumn(column: ColumnView): Card[] {
    // When showing archived, also include archived cards that belonged to this column
    const allCardsForColumn = filters.showArchived
      ? [
          ...cards,
          ...archivedCards.filter(
            (ac) =>
              !cards.some((c) => c.id === ac.id) &&
              ac.columnId?.toString() === column.id.toString(),
          ),
        ]
      : cards;
    const cardMap = new Map(allCardsForColumn.map((c) => [c.id.toString(), c]));
    const cardIds =
      localColumnsOverride?.get(column.id.toString()) ??
      column.cardIds.map((id) => id.toString());

    const result = cardIds
      .map((id) => cardMap.get(id))
      .filter((c): c is Card => c !== undefined);

    // Also append archived cards for this column that aren't in cardIds
    if (filters.showArchived) {
      const archivedForCol = archivedCards.filter(
        (ac) =>
          ac.columnId?.toString() === column.id.toString() &&
          !cardIds.includes(ac.id.toString()),
      );
      result.push(...archivedForCol);
    }

    return result;
  }

  const draggingCard = draggingCardId
    ? cards.find((c) => c.id.toString() === draggingCardId)
    : null;
  const draggingCardColumnIndex = draggingCard
    ? effectiveColumns.findIndex((col) =>
        (
          localColumnsOverride?.get(col.id.toString()) ??
          col.cardIds.map((id) => id.toString())
        ).includes(draggingCardId!),
      )
    : 0;
  const draggingAccentClass = `col-accent-border col-accent-${draggingCardColumnIndex % 6}`;

  const isLoading =
    actorFetching || columnsLoading || cardsLoading || activeProjectId === null;

  // suppress unused warning — getCardsForColumn used in previous version
  void getCardsForColumn;

  const isAdminUser =
    activeUser?.isAdmin === true || activeUser?.isMasterAdmin === true;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Toaster position="bottom-right" />

      {/* Access key gate — shown until unlocked */}
      {!gateUnlocked && (
        <AccessKeyGate onUnlocked={() => setGateUnlocked(true)} />
      )}

      {/* Master Admin Setup overlay */}
      {gateUnlocked && showSetupOverlay && (
        <MasterAdminSetup
          onComplete={(user) => {
            setActiveUser(user);
            setAdminSetupComplete(true);
          }}
        />
      )}

      {/* Tags modal */}
      {activeProjectId && (
        <TagsModal
          open={showTagsModal}
          onOpenChange={setShowTagsModal}
          projectId={activeProjectId}
          activeUser={activeUser}
        />
      )}

      {/* Swimlanes modal */}
      {activeProjectId && (
        <SwimlanesModal
          open={showSwimlanesModal}
          onOpenChange={setShowSwimlanesModal}
          projectId={activeProjectId}
          activeUser={activeUser}
          swimlanesEnabled={swimlanesEnabled}
          swimlanes={swimlanes}
        />
      )}

      {/* Bulk card import modal */}
      <BulkCardImport
        open={bulkImportColumn !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setBulkImportColumn(null);
        }}
        targetColumn={bulkImportColumn}
        columns={columns}
        projectTags={projectTags}
        users={users}
        activeUser={activeUser}
        onCreateCardWithId={handleBulkCreateCard}
        onUpdateCardTags={handleUpdateCardTags}
        onAssignCard={handleAssignCard}
      />

      {/* Project settings dialog (export/import) */}
      {activeProjectId && actor && (
        <Dialog
          open={showProjectSettings}
          onOpenChange={setShowProjectSettings}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-display">
                Import / Export
              </DialogTitle>
            </DialogHeader>
            <div className="pt-1">
              <ProjectExportImport
                actor={actor}
                projectId={activeProjectId}
                projectName={
                  projects.find((p) => p.id === activeProjectId)?.name ??
                  "Project"
                }
                activeUser={activeUser}
                onImportComplete={() => {
                  setShowProjectSettings(false);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick user switcher PIN dialog */}
      <Dialog
        open={switcherOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSwitcherOpen(false);
            setSwitcherPin("");
            setSwitcherError("");
            setSwitcherTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-display">
              Switch to {switcherTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Enter{" "}
              <span className="font-semibold text-foreground">
                {switcherTarget?.name}
              </span>
              's PIN to set them as active.
            </p>
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]*"
                placeholder="4-digit PIN"
                value={switcherPin}
                onChange={(e) => {
                  setSwitcherPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setSwitcherError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSwitcherConfirm();
                  if (e.key === "Escape") setSwitcherOpen(false);
                }}
                className="text-center tracking-widest font-mono text-lg h-12"
                autoFocus
                disabled={switcherVerifying}
              />
              {switcherError && (
                <p className="text-xs text-destructive">{switcherError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSwitcherConfirm}
                disabled={switcherPin.length !== 4 || switcherVerifying}
              >
                {switcherVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Switch user"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSwitcherOpen(false)}
                disabled={switcherVerifying}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-6 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        {/* Logo + Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-7 w-7 rounded-lg col-accent-0 col-accent-bar flex items-center justify-center">
            <Kanban className="h-4 w-4 text-card" />
          </div>
          <h1 className="font-display font-bold text-lg text-foreground tracking-tight">
            Kanban
          </h1>
        </div>

        {/* Project switcher */}
        <div className="shrink-0">
          <ProjectSwitcher
            activeProjectId={activeProjectId}
            onSelectProject={(id) => {
              setActiveProjectId(id);
              // Reset local drag state when switching projects
              setLocalColumnsOverride(null);
              setLocalColumnOrder(null);
              setAddingColumn(false);
              clearAll();
            }}
            activeUser={activeUser}
          />
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border shrink-0" />

        {/* Tab bar */}
        <nav className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("board")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "board"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "users"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Users
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Dashboard
          </button>
          {/* Snapshots tab — only visible to admins */}
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveTab("snapshots")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "snapshots"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
              data-ocid="nav.snapshots.tab"
            >
              <Database className="h-3.5 w-3.5" />
              Snapshots
            </button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Undo/Redo buttons — shown on board tab */}
          {activeTab === "board" && (
            <>
              <button
                type="button"
                onClick={() => {
                  const snap = undo();
                  if (snap) {
                    queryClient.setQueryData(
                      ["cards", activeProjectId?.toString() ?? "none"],
                      snap.cards,
                    );
                    queryClient.setQueryData(
                      ["columns", activeProjectId?.toString() ?? "none"],
                      snap.columns,
                    );
                    toast.success(
                      "Undone (session only — do not refresh or the undo will be lost)",
                    );
                  }
                }}
                disabled={!canUndo}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title={canUndo ? "Undo last action" : "Nothing to undo"}
                data-ocid="board.undo_button"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const snap = redo();
                  if (snap) {
                    queryClient.setQueryData(
                      ["cards", activeProjectId?.toString() ?? "none"],
                      snap.cards,
                    );
                    queryClient.setQueryData(
                      ["columns", activeProjectId?.toString() ?? "none"],
                      snap.columns,
                    );
                    toast.success(
                      "Redone (session only — do not refresh or the redo will be lost)",
                    );
                  }
                }}
                disabled={!canRedo}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title={canRedo ? "Redo last undone action" : "Nothing to redo"}
                data-ocid="board.redo_button"
              >
                <Redo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Redo</span>
              </button>
            </>
          )}

          {/* Manual refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            title="Refresh board"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>

          {/* Tags button — admin only, shown on board tab */}
          {isAdminUser && activeTab === "board" && activeProjectId && (
            <button
              type="button"
              onClick={() => setShowTagsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title="Manage tags for this project"
            >
              <Tag className="h-3.5 w-3.5" />
              Tags
            </button>
          )}

          {/* Swimlanes button — visible to all users on board tab */}
          {activeTab === "board" && activeProjectId && (
            <button
              type="button"
              onClick={() => setShowSwimlanesModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                swimlanesEnabled
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
              title={
                swimlanesEnabled
                  ? "Swimlanes enabled — click to manage"
                  : "Manage swimlanes"
              }
            >
              <Layers className="h-3.5 w-3.5" />
              Swimlanes
            </button>
          )}

          {/* Column sort button — shown on board tab */}
          {activeTab === "board" && activeProjectId && (
            <button
              type="button"
              onClick={cycleColumnSort}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                columnSortDir !== null
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
              title={
                columnSortDir === null
                  ? "Sort columns A→Z"
                  : columnSortDir === "asc"
                    ? "Sort columns Z→A"
                    : "Clear column sort"
              }
              data-ocid="board.sort.toggle"
            >
              {columnSortDir === "desc" ? (
                <ArrowUpAZ className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownAZ className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {columnSortDir === null
                  ? "Sort"
                  : columnSortDir === "asc"
                    ? "A→Z"
                    : "Z→A"}
              </span>
            </button>
          )}

          {/* Hidden columns badge — shown on board tab when columns are hidden */}
          {activeTab === "board" &&
            activeProjectId &&
            hiddenColumnIds.size > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowHiddenColsPopover((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-amber-600 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
                  title="Show hidden columns"
                  data-ocid="board.hidden_cols.toggle"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {hiddenColumnIds.size} hidden
                  </span>
                  <span className="sm:hidden">{hiddenColumnIds.size}</span>
                </button>
                {showHiddenColsPopover && (
                  <>
                    {/* Backdrop to close */}
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowHiddenColsPopover(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setShowHiddenColsPopover(false);
                      }}
                      role="button"
                      tabIndex={-1}
                      aria-label="Close hidden columns panel"
                    />
                    <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-border bg-card shadow-lg py-1">
                      <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
                        Hidden columns
                      </p>
                      {columns
                        .filter((c) => hiddenColumnIds.has(c.id.toString()))
                        .map((col) => (
                          <button
                            key={col.id.toString()}
                            type="button"
                            onClick={() => {
                              unhideColumn(col.id.toString());
                              if (hiddenColumnIds.size <= 1)
                                setShowHiddenColsPopover(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/60 transition-colors text-left"
                            data-ocid="board.unhide_col.button"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{col.name}</span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}

          {/* Import/Export — shown when a project is active */}
          {activeProjectId && (
            <button
              type="button"
              onClick={() => setShowProjectSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title="Export or import project data"
              data-ocid="board.import_export.button"
            >
              Import/Export
            </button>
          )}

          {/* Quick user switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {activeUser ? (
                <button
                  type="button"
                  className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium hover:bg-primary/15 transition-colors"
                  title="Switch active user"
                >
                  <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold">
                    {activeUser.name.slice(0, 1).toUpperCase()}
                  </div>
                  {activeUser.name}
                  {activeUser.isMasterAdmin && (
                    <Crown className="h-2.5 w-2.5 text-amber-500" />
                  )}
                  {activeUser.isAdmin && !activeUser.isMasterAdmin && (
                    <Shield className="h-2.5 w-2.5 text-blue-500" />
                  )}
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1.5 bg-secondary/80 text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  title="Set active user"
                >
                  <Users className="h-3 w-3" />
                  Set active user
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {users.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No users yet — go to the Users tab
                </div>
              ) : (
                <>
                  {users.map((user) => (
                    <DropdownMenuItem
                      key={user.id.toString()}
                      onClick={() => {
                        if (activeUser?.id === user.id) return; // already active
                        setSwitcherTarget(user);
                        setSwitcherPin("");
                        setSwitcherError("");
                        setSwitcherOpen(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {user.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate">{user.name}</span>
                      {user.isMasterAdmin && (
                        <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      {user.isAdmin && !user.isMasterAdmin && (
                        <Shield className="h-3 w-3 text-blue-500 shrink-0" />
                      )}
                      {activeUser?.id === user.id && (
                        <span className="text-[9px] text-primary font-semibold shrink-0">
                          Active
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  {activeUser && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setActiveUser(null)}
                        className="text-muted-foreground"
                      >
                        Sign out
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {(actorFetching || activeProjectId === null) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading…</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "board" ? (
          <>
            {/* Filter bar */}
            {!isLoading && (
              <FilterBar
                filters={filters}
                onChange={setFilters}
                users={users}
                tags={projectTags}
                presets={filterPresets}
                activeUser={activeUser}
                onSavePreset={handleSavePreset}
                onDeletePreset={handleDeletePreset}
                onApplyPreset={handleApplyPreset}
                filteredCount={filterResultCount}
                totalCount={totalCardCount}
              />
            )}

            {isLoading && columns.length === 0 ? (
              // Loading skeleton
              <div className="flex gap-5 p-6 overflow-x-auto kanban-board">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col w-72 shrink-0 rounded-xl bg-card shadow-column overflow-hidden"
                  >
                    <div className="h-1 w-full shimmer" />
                    <div className="px-4 pt-3 pb-2">
                      <div className="h-4 w-24 rounded shimmer" />
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          className="h-16 rounded-lg shimmer border-l-4 border-transparent"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={columnSortableIds}
                  strategy={horizontalListSortingStrategy}
                >
                  <div
                    ref={boardScrollRef}
                    className="flex gap-5 p-6 overflow-x-scroll kanban-board flex-1 items-start"
                  >
                    {/* Columns */}
                    {effectiveColumns.map((column, idx) => (
                      <KanbanColumn
                        key={column.id.toString()}
                        column={column}
                        cards={applyFilters(getEffectiveCardsForColumn(column))}
                        columnIndex={idx}
                        totalColumns={effectiveColumns.length}
                        isFirst={idx === 0}
                        isLast={idx === effectiveColumns.length - 1}
                        onAddCard={handleAddCard}
                        onUpdateCard={handleUpdateCard}
                        onDeleteCard={handleDeleteCard}
                        onMoveCard={handleMoveCard}
                        onRenameColumn={handleRenameColumn}
                        onDeleteColumn={handleDeleteColumn}
                        onSetColumnComplete={handleSetColumnComplete}
                        onAssignCard={handleAssignCard}
                        onUpdateCardTags={handleUpdateCardTags}
                        onUpdateCardDueDate={handleUpdateCardDueDate}
                        onArchiveCard={handleArchiveCard}
                        onRestoreCard={handleRestoreCard}
                        onUpdateCardSwimlane={handleUpdateCardSwimlane}
                        onQuickAdd={handleQuickAdd}
                        onMoveCards={handleMoveCards}
                        onBulkImport={() => {
                          if (!requireActiveUser()) return;
                          setBulkImportColumn(column);
                        }}
                        onHideColumn={hideColumn}
                        projectTags={projectTags}
                        siblingColumns={effectiveColumns}
                        users={users}
                        activeUser={activeUser}
                        swimlanes={swimlanes}
                        swimlanesEnabled={swimlanesEnabled}
                        animationDelay={idx * 60}
                        isDraggingColumn={draggingColumnId !== null}
                      />
                    ))}

                    {/* Add column area */}
                    <div className="shrink-0 w-72">
                      {addingColumn ? (
                        <div className="rounded-xl bg-card shadow-column p-4 space-y-3">
                          <p className="text-sm font-display font-semibold text-foreground">
                            New Column
                          </p>
                          <Input
                            autoFocus
                            value={newColumnName}
                            onChange={(e) => setNewColumnName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitAddColumn();
                              if (e.key === "Escape") {
                                setAddingColumn(false);
                                setNewColumnName("");
                              }
                            }}
                            placeholder="Column name"
                            disabled={isAddingColumn}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 text-xs px-4"
                              onClick={submitAddColumn}
                              disabled={!newColumnName.trim() || isAddingColumn}
                            >
                              {isAddingColumn ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Adding…
                                </>
                              ) : (
                                "Add column"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs px-3"
                              onClick={() => {
                                setAddingColumn(false);
                                setNewColumnName("");
                              }}
                              disabled={isAddingColumn}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full h-12 text-sm text-muted-foreground border-dashed border-2 hover:border-solid hover:text-foreground hover:bg-secondary gap-2 transition-all"
                          onClick={handleOpenAddColumn}
                        >
                          <Plus className="h-4 w-4" />
                          Add column
                        </Button>
                      )}
                    </div>
                  </div>
                </SortableContext>

                {/* Drag overlay — ghost that follows cursor */}
                <DragOverlay dropAnimation={null}>
                  {draggingCard ? (
                    <KanbanCard
                      card={draggingCard}
                      accentClass={draggingAccentClass}
                      canMoveLeft={false}
                      canMoveRight={false}
                      onMoveLeft={() => {}}
                      onMoveRight={() => {}}
                      onDelete={() => {}}
                      onUpdate={() => {}}
                      users={users}
                      activeUser={activeUser}
                      availableTags={projectTags}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* Empty state */}
            {!isLoading && columns.length === 0 && !addingColumn && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 -mt-16">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                    <Kanban className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h2 className="font-display font-bold text-xl text-foreground">
                    Your board is empty
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Add your first column to start organizing tasks across
                    stages.
                  </p>
                </div>
                <Button onClick={handleOpenAddColumn} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add first column
                </Button>
              </div>
            )}
          </>
        ) : activeTab === "users" ? (
          <UsersTab
            activeUser={activeUser}
            onSetActiveUser={(user) => setActiveUser(user)}
            onRenameUser={handleRenameUser}
          />
        ) : activeTab === "activity" ? (
          <ActivityTab projectId={activeProjectId} />
        ) : activeTab === "snapshots" ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-2xl mx-auto">
              <SnapshotsPanel
                activeUser={activeUser}
                actor={actor}
                activeProjectId={activeProjectId}
              />
            </div>
          </div>
        ) : (
          <DashboardTab
            projectId={activeProjectId}
            projectTags={projectTags}
            columns={columns}
            onApplyFilter={(partial) => {
              setFilters((prev) => ({ ...prev, ...partial }));
              setActiveTab("board");
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground border-t border-border">
        <span>© {new Date().getFullYear()}. Created by Terry Brutus</span>
      </footer>
    </div>
  );
}
