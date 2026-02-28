import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Loader2, Kanban, Heart, Users, LayoutDashboard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanColumn from "./components/KanbanColumn";
import KanbanCard from "./components/KanbanCard";
import UsersTab from "./components/UsersTab";
import ActivityTab from "./components/ActivityTab";
import {
  useColumns,
  useCards,
  useUsers,
  useInitBoard,
  useCreateColumn,
  useRenameColumn,
  useDeleteColumn,
  useCreateCard,
  useUpdateCard,
  useDeleteCard,
  useMoveCard,
  useAssignCard,
  useReorderColumns,
} from "./hooks/useQueries";
import type { User } from "./hooks/useQueries";
import { useActor } from "./hooks/useActor";
import type { Card, ColumnView } from "./backend.d";

type TabId = "board" | "users" | "activity";

export default function App() {
  const { actor, isFetching: actorFetching } = useActor();
  const { data: columns = [], isLoading: columnsLoading } = useColumns();
  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const { data: users = [] } = useUsers();

  // ── Init board on first actor availability ──────────────────────────────────
  const { mutateAsync: initBoard } = useInitBoard();
  const [boardInitialized, setBoardInitialized] = useState(false);

  useEffect(() => {
    if (actor && !actorFetching && !boardInitialized) {
      setBoardInitialized(true);
      initBoard().catch(() => {
        // Silently ignore — board may already be initialized
      });
    }
  }, [actor, actorFetching, boardInitialized, initBoard]);

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("board");

  // ── Active user (local session) ─────────────────────────────────────────────
  const [activeUser, setActiveUser] = useState<User | null>(null);

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

  // ── Card mutations ──────────────────────────────────────────────────────────
  const { mutateAsync: createCard } = useCreateCard();
  const { mutateAsync: updateCard } = useUpdateCard();
  const { mutateAsync: deleteCard } = useDeleteCard();
  const { mutateAsync: moveCard } = useMoveCard();
  const { mutateAsync: assignCard } = useAssignCard();

  // ── Add column state ────────────────────────────────────────────────────────
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  async function submitAddColumn() {
    if (!requireActiveUser()) return;
    const trimmed = newColumnName.trim();
    if (!trimmed) return;
    setIsAddingColumn(true);
    try {
      await createColumn({ name: trimmed, actorUserId: activeUser!.id });
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
    async (columnId: bigint, title: string, description: string | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await createCard({ title, description, columnId, actorUserId: activeUser.id });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to add card");
        throw new Error("Failed to add card");
      }
    },
    [createCard, activeUser]
  );

  const handleUpdateCard = useCallback(
    async (cardId: bigint, title: string, description: string | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await updateCard({ cardId, title, description, actorUserId: activeUser.id });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to update card");
        throw new Error("Failed to update card");
      }
    },
    [updateCard, activeUser]
  );

  const handleDeleteCard = useCallback(
    async (cardId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await deleteCard({ cardId, actorUserId: activeUser.id });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to delete card");
        throw new Error("Failed to delete card");
      }
    },
    [deleteCard, activeUser]
  );

  const handleMoveCard = useCallback(
    async (cardId: bigint, targetColumnId: bigint, newPosition: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await moveCard({ cardId, targetColumnId, newPosition, actorUserId: activeUser.id });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to move card");
        throw new Error("Failed to move card");
      }
    },
    [moveCard, activeUser]
  );

  const handleRenameColumn = useCallback(
    async (columnId: bigint, newName: string) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await renameColumn({ columnId, newName, actorUserId: activeUser.id });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to rename column");
        throw new Error("Failed to rename column");
      }
    },
    [renameColumn, activeUser]
  );

  const handleDeleteColumn = useCallback(
    async (columnId: bigint) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await deleteColumn({ columnId, actorUserId: activeUser.id });
        toast.success("Column deleted");
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to delete column");
        throw new Error("Failed to delete column");
      }
    },
    [deleteColumn, activeUser]
  );

  const handleAssignCard = useCallback(
    async (cardId: bigint, userId: bigint | null) => {
      if (!activeUser) {
        toast.error("Please set yourself as active in the Users tab first");
        throw new Error("No active user");
      }
      try {
        await assignCard({ cardId, userId, actorUserId: activeUser.id });
      } catch (err) {
        if (err instanceof Error && err.message === "No active user") throw err;
        toast.error("Failed to assign card");
        throw new Error("Failed to assign card");
      }
    },
    [assignCard, activeUser]
  );

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
  const [localColumnsOverride, setLocalColumnsOverride] = useState<Map<string, string[]> | null>(null);
  // Optimistic local column order for column drag
  const [localColumnOrder, setLocalColumnOrder] = useState<ColumnView[] | null>(null);
  // Track whether a backend call is in progress so we don't double-fire
  const dndPendingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Column sortable IDs (for SortableContext)
  const columnSortableIds = (localColumnOrder ?? columns).map(
    (col) => `col-header-${col.id.toString()}`
  );

  function buildLocalMap(cols: ColumnView[]): Map<string, string[]> {
    return new Map(
      cols.map((col) => [col.id.toString(), col.cardIds.map((id) => id.toString())])
    );
  }

  function findColumnForCard(cardIdStr: string, colMap: Map<string, string[]>): string | null {
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

  function handleDragOver({ active, over }: DragOverEvent) {
    const activeId = active.id as string;

    // Column drag — reorder columns optimistically
    if (activeId.startsWith("col-header-")) {
      if (!over || !localColumnOrder) return;
      const overId = over.id as string;
      if (!overId.startsWith("col-header-")) return;

      const activeIndex = localColumnOrder.findIndex(
        (c) => `col-header-${c.id.toString()}` === activeId
      );
      const overIndex = localColumnOrder.findIndex(
        (c) => `col-header-${c.id.toString()}` === overId
      );
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

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
    if (overId.startsWith("col-")) {
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
      const src = [...(next.get(sourceColId) ?? [])].filter((id) => id !== activeId);
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
      reorderColumns({ newOrder: newOrderBigInt, actorUserId: activeUser.id })
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

    // Determine target column + position
    let targetColId: string | null = null;
    let targetCardId: string | null = null;

    if (overId.startsWith("col-")) {
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
    } else {
      const withoutActive = targetCards.filter((id) => id !== activeId);
      newPosition = withoutActive.length;
    }

    // Find the original column for comparison
    const originalColId = findColumnForCard(activeId, buildLocalMap(columns));
    const originalCards = columns
      .find((c) => c.id.toString() === originalColId)
      ?.cardIds.map((id) => id.toString()) ?? [];
    const originalPosition = originalCards.indexOf(activeId);

    // Skip if nothing changed
    if (targetColId === originalColId && newPosition === originalPosition) {
      setLocalColumnsOverride(null);
      return;
    }

    // Convert IDs to bigint
    const targetColBigInt = columns.find((c) => c.id.toString() === targetColId)?.id;
    const cardBigInt = cards.find((c) => c.id.toString() === activeId)?.id;

    if (!targetColBigInt || !cardBigInt) {
      setLocalColumnsOverride(null);
      return;
    }

    // Persist to backend
    dndPendingRef.current = true;
    moveCard({
      cardId: cardBigInt,
      targetColumnId: targetColBigInt,
      newPosition: BigInt(newPosition),
      actorUserId: activeUser.id,
    })
      .catch(() => {
        toast.error("Failed to move card");
      })
      .finally(() => {
        dndPendingRef.current = false;
        setLocalColumnsOverride(null);
      });
  }

  // ── Effective columns (uses optimistic order when column-dragging) ───────────
  const effectiveColumns = localColumnOrder ?? columns;

  // Build effective columns/cards for rendering (uses optimistic override when dragging)
  function getEffectiveCardsForColumn(column: ColumnView): Card[] {
    const cardMap = new Map(cards.map((c) => [c.id.toString(), c]));
    const cardIds = localColumnsOverride?.get(column.id.toString()) ?? column.cardIds.map((id) => id.toString());
    return cardIds.map((id) => cardMap.get(id)).filter((c): c is Card => c !== undefined);
  }

  const draggingCard = draggingCardId ? cards.find((c) => c.id.toString() === draggingCardId) : null;
  const draggingCardColumnIndex = draggingCard
    ? effectiveColumns.findIndex((col) =>
        (localColumnsOverride?.get(col.id.toString()) ?? col.cardIds.map((id) => id.toString())).includes(draggingCardId!)
      )
    : 0;
  const draggingAccentClass =
    `col-accent-border col-accent-${draggingCardColumnIndex % 6}`;

  const isLoading = actorFetching || columnsLoading || cardsLoading;

  // suppress unused warning — getCardsForColumn used in previous version
  void getCardsForColumn;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Toaster position="bottom-right" />

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-6 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg col-accent-0 col-accent-bar flex items-center justify-center">
            <Kanban className="h-4 w-4 text-card" />
          </div>
          <h1 className="font-display font-bold text-lg text-foreground tracking-tight">
            Kanban
          </h1>
        </div>

        {/* Tab bar */}
        <nav className="flex items-center gap-1 ml-6">
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
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Active user chip */}
          {activeUser ? (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
              <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold">
                {activeUser.name.slice(0, 1).toUpperCase()}
              </div>
              {activeUser.name}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className="flex items-center gap-1.5 bg-secondary/80 text-muted-foreground hover:text-foreground rounded-full px-3 py-1 text-xs font-medium transition-colors"
              title="No active user — click to set one"
            >
              <Users className="h-3 w-3" />
              Set active user
            </button>
          )}
          {isLoading && (
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
            {isLoading && columns.length === 0 ? (
              // Loading skeleton
              <div className="flex gap-5 p-6 overflow-x-auto kanban-board">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col w-72 shrink-0 rounded-xl bg-card shadow-column overflow-hidden"
                  >
                    <div className={`h-1 w-full shimmer`} />
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
                <SortableContext items={columnSortableIds} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-5 p-6 overflow-x-auto kanban-board flex-1 items-start">
                    {/* Columns */}
                    {effectiveColumns.map((column, idx) => (
                      <KanbanColumn
                        key={column.id.toString()}
                        column={column}
                        cards={getEffectiveCardsForColumn(column)}
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
                        onAssignCard={handleAssignCard}
                        siblingColumns={effectiveColumns}
                        users={users}
                        activeUser={activeUser}
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
                    Add your first column to start organizing tasks across stages.
                  </p>
                </div>
                <Button
                  onClick={handleOpenAddColumn}
                  className="gap-2"
                >
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
          />
        ) : (
          <ActivityTab />
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground border-t border-border">
        <span>© 2026. Built with</span>
        <Heart className="h-3 w-3 fill-current text-destructive" />
        <span>using</span>
        <a
          href="https://caffeine.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
