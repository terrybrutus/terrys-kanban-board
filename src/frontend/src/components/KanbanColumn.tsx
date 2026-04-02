import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  EyeOff,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  Tag as TagIcon,
  Trash2,
  Upload,
  UserCircle2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Card, ColumnView, Tag } from "../backend.d";
import type { User } from "../hooks/useQueries";
import KanbanCard from "./KanbanCard";

const ACCENT_CLASSES = [
  "col-accent-0",
  "col-accent-1",
  "col-accent-2",
  "col-accent-3",
  "col-accent-4",
  "col-accent-5",
];

interface KanbanColumnProps {
  column: ColumnView;
  cards: Card[];
  columnIndex: number;
  totalColumns: number;
  isFirst: boolean;
  isLast: boolean;
  onAddCard: (
    columnId: bigint,
    title: string,
    description: string | null,
  ) => Promise<bigint>;
  onDeleteCard: (cardId: bigint) => Promise<void>;
  onMoveCard: (
    cardId: bigint,
    targetColumnId: bigint,
    newPosition: bigint,
  ) => Promise<void>;
  onRenameColumn: (columnId: bigint, newName: string) => Promise<void>;
  onDeleteColumn: (
    columnId: bigint,
    destinationColumnId?: bigint,
  ) => Promise<void>;
  onAssignCard: (cardId: bigint, userId: bigint | null) => Promise<void>;
  onUpdateCardTags: (cardId: bigint, tagIds: bigint[]) => Promise<void>;
  onUpdateCardDueDate: (
    cardId: bigint,
    dueDate: bigint | null,
  ) => Promise<void>;
  onArchiveCard?: (cardId: bigint) => Promise<void>;
  onMoveCards?: (cardIds: bigint[], targetColumnId: bigint) => Promise<void>;
  onBulkImport?: () => void;
  onHideColumn?: (columnId: bigint) => void;
  onSetColumnComplete?: (
    columnId: bigint,
    isComplete: boolean,
  ) => Promise<void>;
  projectTags: Tag[];
  siblingColumns: ColumnView[];
  users: User[];
  activeUser: User | null;
  animationDelay?: number;
  /** When dragging a column, disable card drag (prevents overlap) */
  isDraggingColumn?: boolean;
  /** Called when user clicks a card — lifted to App level to keep modal alive across column changes */
  onOpenModal: (cardId: bigint) => void;
}

function KanbanColumnInner({
  column,
  cards,
  columnIndex,
  isFirst,
  isLast,
  onAddCard,
  onDeleteCard,
  onMoveCard,
  onRenameColumn,
  onDeleteColumn,
  onAssignCard,
  onUpdateCardTags,
  onUpdateCardDueDate,
  onArchiveCard,
  onMoveCards,
  onBulkImport,
  onHideColumn,
  onSetColumnComplete,
  projectTags,
  siblingColumns,
  users,
  activeUser,
  animationDelay = 0,
  isDraggingColumn = false,
  onOpenModal,
}: KanbanColumnProps) {
  const accentClass = ACCENT_CLASSES[columnIndex % ACCENT_CLASSES.length];

  // ── Column-level sortable (for column reorder) ──────────────────────────────
  const columnSortableId = `col-header-${column.id.toString()}`;
  const {
    attributes: colAttributes,
    listeners: colListeners,
    setNodeRef: setColNodeRef,
    transform: colTransform,
    transition: colTransition,
    isDragging: isColDragging,
  } = useSortable({
    id: columnSortableId,
    data: { type: "column", columnId: column.id },
  });

  const colStyle = {
    transform: CSS.Transform.toString(colTransform),
    transition: colTransition,
  };

  // ── dnd-kit droppable (for cards) ────────────────────────────────────────────
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-${column.id.toString()}`,
    data: { columnId: column.id, type: "column" },
    disabled: isDraggingColumn,
  });

  // ── Rename state ────────────────────────────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  function startRename() {
    setRenameValue(column.name);
    setRenaming(true);
  }

  async function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== column.name) {
      await onRenameColumn(column.id, trimmed);
    }
    setRenaming(false);
  }

  function cancelRename() {
    setRenaming(false);
  }

  // ── Add card state ──────────────────────────────────────────────────────────
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDesc, setNewCardDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingCard) addInputRef.current?.focus();
  }, [addingCard]);

  function openAddCard() {
    setNewCardTitle("");
    setNewCardDesc("");
    setAddingCard(true);
  }

  function cancelAddCard() {
    setAddingCard(false);
  }

  async function submitAddCard() {
    const trimTitle = newCardTitle.trim();
    if (!trimTitle) return;
    setIsAdding(true);
    try {
      await onAddCard(column.id, trimTitle, newCardDesc.trim() || null);
      setNewCardTitle("");
      setNewCardDesc("");
      setAddingCard(false);
    } finally {
      setIsAdding(false);
    }
  }

  // ── Moving card state ───────────────────────────────────────────────────────
  const [movingCardId, setMovingCardId] = useState<bigint | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<bigint | null>(null);

  async function handleMoveCard(card: Card, direction: "left" | "right") {
    const currentIdx = siblingColumns.findIndex((c) => c.id === column.id);
    const targetIdx = direction === "left" ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= siblingColumns.length) return;
    const targetColumn = siblingColumns[targetIdx];
    const newPosition = BigInt(targetColumn.cardIds.length);
    setMovingCardId(card.id);
    try {
      await onMoveCard(card.id, targetColumn.id, newPosition);
    } finally {
      setMovingCardId(null);
    }
  }

  async function handleDeleteCard(cardId: bigint) {
    setDeletingCardId(cardId);
    try {
      await onDeleteCard(cardId);
    } finally {
      setDeletingCardId(null);
    }
  }

  // ── Delete column dialog (Feature 24) ───────────────────────────────────────
  const [showDeleteColumnDialog, setShowDeleteColumnDialog] = useState(false);
  const [deleteDestinationColumnId, setDeleteDestinationColumnId] =
    useState<string>("none");
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);

  // Sibling columns excluding this one (for destination picker)
  const targetColumns = siblingColumns.filter(
    (c) => c.id.toString() !== column.id.toString(),
  );

  function openDeleteColumnDialog() {
    setDeleteDestinationColumnId("none");
    setShowDeleteColumnDialog(true);
  }

  async function confirmDeleteColumn() {
    setIsDeletingColumn(true);
    try {
      // Pass destination column ID to parent — parent handles card migration + deletion atomically
      const destId =
        cards.length > 0 &&
        targetColumns.length > 0 &&
        deleteDestinationColumnId !== "none"
          ? BigInt(deleteDestinationColumnId)
          : undefined;

      await onDeleteColumn(column.id, destId);
      setShowDeleteColumnDialog(false);
    } catch {
      toast.error("Failed to delete column");
    } finally {
      setIsDeletingColumn(false);
    }
  }

  // Delete button disabled when: cards exist AND sibling columns exist AND no destination picked
  const deleteButtonDisabled =
    isDeletingColumn ||
    (cards.length > 0 &&
      targetColumns.length > 0 &&
      deleteDestinationColumnId === "none");

  // ── Multi-select state ──────────────────────────────────────────────────────
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [isMovingMultiple, setIsMovingMultiple] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const isSelectionMode = selectedCardIds.size > 0;

  function clearSelection() {
    setSelectedCardIds(new Set());
    setLastClickedIdx(null);
  }

  function handleToggleSelect(card: Card, idx: number, e: React.MouseEvent) {
    const cardIdStr = card.id.toString();

    if (e.shiftKey && lastClickedIdx !== null) {
      // Range select
      const minIdx = Math.min(idx, lastClickedIdx);
      const maxIdx = Math.max(idx, lastClickedIdx);
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        for (let i = minIdx; i <= maxIdx; i++) {
          if (cards[i]) next.add(cards[i].id.toString());
        }
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle individual
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardIdStr)) {
          next.delete(cardIdStr);
        } else {
          next.add(cardIdStr);
        }
        return next;
      });
      setLastClickedIdx(idx);
    } else {
      // Simple toggle
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardIdStr)) {
          next.delete(cardIdStr);
        } else {
          next.add(cardIdStr);
        }
        return next;
      });
      setLastClickedIdx(idx);
    }
  }

  // Shift+A keyboard shortcut to select all cards in this column
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!columnRef.current?.contains(document.activeElement)) return;
      if (e.shiftKey && e.key === "A") {
        e.preventDefault();
        if (cards.length > 0) {
          setSelectedCardIds(new Set(cards.map((c) => c.id.toString())));
          setLastClickedIdx(cards.length - 1);
        }
      }
      if (e.key === "Escape") {
        setSelectedCardIds(new Set());
        setLastClickedIdx(null);
      }
    },
    [cards],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleMultiMove(targetColumnId: bigint) {
    if (!onMoveCards || selectedCardIds.size === 0) return;
    const cardIds = cards
      .filter((c) => selectedCardIds.has(c.id.toString()))
      .map((c) => c.id);
    setIsMovingMultiple(true);
    try {
      await onMoveCards(cardIds, targetColumnId);
      clearSelection();
    } finally {
      setIsMovingMultiple(false);
    }
  }

  const cardIds = cards.map((c) => c.id.toString());

  return (
    <>
      {/* Delete column confirmation dialog */}
      <Dialog
        open={showDeleteColumnDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteColumnDialog(false);
            setDeleteDestinationColumnId("none");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-display">
              Delete column
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {cards.length > 0 && targetColumns.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This column has{" "}
                  <span className="font-semibold text-foreground">
                    {cards.length} card{cards.length !== 1 ? "s" : ""}
                  </span>
                  . Choose where to move them before deleting.
                </p>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground block">
                    Move cards to
                  </span>
                  <Select
                    value={deleteDestinationColumnId}
                    onValueChange={setDeleteDestinationColumnId}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select a column…" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetColumns.map((col) => (
                        <SelectItem
                          key={col.id.toString()}
                          value={col.id.toString()}
                        >
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : cards.length > 0 && targetColumns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Delete{" "}
                <span className="font-semibold text-foreground">
                  "{column.name}"
                </span>
                ? This column has{" "}
                <span className="font-semibold text-destructive">
                  {cards.length} card{cards.length !== 1 ? "s" : ""}
                </span>{" "}
                that will be permanently deleted. This cannot be undone.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Delete{" "}
                <span className="font-semibold text-foreground">
                  "{column.name}"
                </span>
                ? This cannot be undone.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowDeleteColumnDialog(false);
                setDeleteDestinationColumnId("none");
              }}
              disabled={isDeletingColumn}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeleteColumn}
              disabled={deleteButtonDisabled}
            >
              {isDeletingColumn ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        ref={(node) => {
          setColNodeRef(node);
          (columnRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
        }}
        style={{ animationDelay: `${animationDelay}ms`, ...colStyle }}
        className={`column-enter flex flex-col w-72 shrink-0 rounded-xl bg-card shadow-column overflow-hidden ${accentClass} ${
          isColDragging ? "opacity-50 scale-95" : ""
        }`}
      >
        {/* Column accent bar */}
        <div className="col-accent-bar h-1 w-full shrink-0" />

        {/* Column header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          {renaming ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Input
                ref={renameInputRef}
                className="h-7 text-sm font-display font-semibold px-2 py-0"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") cancelRename();
                }}
              />
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                onClick={commitRename}
                aria-label="Confirm rename"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                onClick={cancelRename}
                aria-label="Cancel rename"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              {/* Column drag handle */}
              <button
                type="button"
                {...colAttributes}
                {...colListeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors touch-none shrink-0 -ml-1 h-6 w-5 flex items-center justify-center rounded"
                title="Drag to reorder column"
                aria-label="Drag to reorder column"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex-1 text-left font-display font-semibold text-sm text-foreground hover:col-accent-text truncate transition-colors"
                onClick={startRename}
                title="Click to rename"
                aria-label={`Rename column: ${column.name}`}
              >
                {column.name}
              </button>
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 h-5 font-body shrink-0"
              >
                {cards.length}
              </Badge>
              {column.isComplete && (
                <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shrink-0">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Done
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                    aria-label="Column options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={startRename}>
                    Rename column
                  </DropdownMenuItem>
                  {onSetColumnComplete && (
                    <DropdownMenuItem
                      onClick={() =>
                        onSetColumnComplete(column.id, !column.isComplete)
                      }
                      className={
                        column.isComplete
                          ? "text-muted-foreground"
                          : "text-emerald-600 focus:text-emerald-600"
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                      {column.isComplete
                        ? "Unmark as complete"
                        : "Mark as complete"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onBulkImport}>
                    <Upload className="h-3.5 w-3.5 mr-2" />
                    Bulk import cards
                  </DropdownMenuItem>
                  {onHideColumn && (
                    <DropdownMenuItem
                      onClick={() => onHideColumn(column.id)}
                      className="text-muted-foreground focus:text-foreground"
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-2" />
                      Hide column
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={openDeleteColumnDialog}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete column
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Cards drop zone */}
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setDropRef}
            className={`flex-1 overflow-y-auto px-3 pb-2 min-h-[80px] max-h-[calc(100vh-300px)] transition-colors rounded-b-md ${
              isOver && !isDraggingColumn ? "column-drag-over" : ""
            } ${accentClass}`}
          >
            {cards.length === 0 && !addingCard && (
              <div
                className={`flex flex-col items-center justify-center py-8 col-accent-bg-soft rounded-lg border border-dashed border-border transition-colors ${isOver && !isDraggingColumn ? "border-solid" : ""}`}
              >
                <p className="text-xs text-muted-foreground text-center">
                  {isOver && !isDraggingColumn
                    ? "Drop card here"
                    : "No cards yet"}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {cards.map((card, idx) => (
                <KanbanCard
                  key={card.id.toString()}
                  card={card}
                  accentClass={`col-accent-border ${accentClass}`}
                  canMoveLeft={!isFirst}
                  canMoveRight={!isLast}
                  onMoveLeft={() => handleMoveCard(card, "left")}
                  onMoveRight={() => handleMoveCard(card, "right")}
                  onDelete={() => handleDeleteCard(card.id)}
                  onArchive={onArchiveCard}
                  availableTags={projectTags}
                  users={users}
                  activeUser={activeUser}
                  isMoving={movingCardId === card.id}
                  isDeleting={deletingCardId === card.id}
                  disableDrag={isDraggingColumn || isSelectionMode}
                  onOpenModal={onOpenModal}
                  isSelected={selectedCardIds.has(card.id.toString())}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={(e) => handleToggleSelect(card, idx, e)}
                />
              ))}
            </div>

            {/* Inline add card form */}
            {addingCard && (
              <div className="rounded-lg bg-card border border-border p-3 shadow-xs mt-2">
                <Input
                  ref={addInputRef}
                  className="mb-2 text-sm"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelAddCard();
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitAddCard();
                    }
                  }}
                  placeholder="Card title"
                  disabled={isAdding}
                />
                <Textarea
                  className="mb-2 text-sm resize-none"
                  value={newCardDesc}
                  onChange={(e) => setNewCardDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelAddCard();
                  }}
                  placeholder="Description (optional)"
                  rows={2}
                  disabled={isAdding}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={submitAddCard}
                    disabled={!newCardTitle.trim() || isAdding}
                  >
                    {isAdding ? "Adding…" : "Add card"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-3"
                    onClick={cancelAddCard}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SortableContext>

        {/* Multi-select toolbar */}
        {isSelectionMode && (
          <div className="mx-3 mb-2 mt-1 rounded-lg bg-primary/10 border border-primary/25 px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-primary shrink-0">
              {selectedCardIds.size} selected
            </span>
            <div className="flex-1" />

            {/* Move to column */}
            {targetColumns.length > 0 && onMoveCards && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={isMovingMultiple}
                  >
                    {isMovingMultiple ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3 w-3" />
                    )}
                    Move to…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {targetColumns.map((col) => (
                    <DropdownMenuItem
                      key={col.id.toString()}
                      onClick={() => handleMultiMove(col.id)}
                    >
                      {col.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Change Assignee */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  disabled={isMovingMultiple}
                >
                  <UserCircle2 className="h-3 w-3" />
                  Assignee
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={async () => {
                    setIsMovingMultiple(true);
                    try {
                      for (const cardId of cards
                        .filter((c) => selectedCardIds.has(c.id.toString()))
                        .map((c) => c.id)) {
                        await onAssignCard(cardId, null);
                      }
                      clearSelection();
                      toast.success("Assignee cleared");
                    } catch {
                      toast.error("Failed to update assignees");
                    } finally {
                      setIsMovingMultiple(false);
                    }
                  }}
                >
                  Unassigned
                </DropdownMenuItem>
                {users.map((user) => (
                  <DropdownMenuItem
                    key={user.id.toString()}
                    onClick={async () => {
                      setIsMovingMultiple(true);
                      try {
                        for (const cardId of cards
                          .filter((c) => selectedCardIds.has(c.id.toString()))
                          .map((c) => c.id)) {
                          await onAssignCard(cardId, user.id);
                        }
                        clearSelection();
                        toast.success(`Assigned to ${user.name}`);
                      } catch {
                        toast.error("Failed to assign cards");
                      } finally {
                        setIsMovingMultiple(false);
                      }
                    }}
                  >
                    {user.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add Tag */}
            {projectTags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={isMovingMultiple}
                  >
                    <TagIcon className="h-3 w-3" />
                    Add Tag
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {projectTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id.toString()}
                      onClick={async () => {
                        setIsMovingMultiple(true);
                        try {
                          const selectedCards = cards.filter((c) =>
                            selectedCardIds.has(c.id.toString()),
                          );
                          for (const card of selectedCards) {
                            const existing = card.tags ?? [];
                            const alreadyHas = existing.some(
                              (t) => t.toString() === tag.id.toString(),
                            );
                            if (!alreadyHas) {
                              await onUpdateCardTags(card.id, [
                                ...existing,
                                tag.id,
                              ]);
                            }
                          }
                          clearSelection();
                          toast.success(`Tag "${tag.name}" added`);
                        } catch {
                          toast.error("Failed to add tag");
                        } finally {
                          setIsMovingMultiple(false);
                        }
                      }}
                    >
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Remove Tag */}
            {projectTags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={isMovingMultiple}
                  >
                    <X className="h-3 w-3" />
                    Remove Tag
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {projectTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id.toString()}
                      onClick={async () => {
                        setIsMovingMultiple(true);
                        try {
                          const selectedCards = cards.filter((c) =>
                            selectedCardIds.has(c.id.toString()),
                          );
                          for (const card of selectedCards) {
                            const existing = card.tags ?? [];
                            const updated = existing.filter(
                              (t) => t.toString() !== tag.id.toString(),
                            );
                            if (updated.length !== existing.length) {
                              await onUpdateCardTags(card.id, updated);
                            }
                          }
                          clearSelection();
                          toast.success(`Tag "${tag.name}" removed`);
                        } catch {
                          toast.error("Failed to remove tag");
                        } finally {
                          setIsMovingMultiple(false);
                        }
                      }}
                    >
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Set Due Date */}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              <input
                type="date"
                className="h-7 text-xs px-1.5 rounded border border-primary/30 bg-transparent text-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                disabled={isMovingMultiple}
                title="Set due date for selected cards"
                onChange={async (e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setIsMovingMultiple(true);
                  try {
                    const dueDateBigInt =
                      BigInt(new Date(val).getTime()) * 1_000_000n;
                    for (const cardId of cards
                      .filter((c) => selectedCardIds.has(c.id.toString()))
                      .map((c) => c.id)) {
                      await onUpdateCardDueDate(cardId, dueDateBigInt);
                    }
                    clearSelection();
                    toast.success("Due date set");
                  } catch {
                    toast.error("Failed to set due date");
                  } finally {
                    setIsMovingMultiple(false);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* Archive */}
            {onArchiveCard && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                disabled={isMovingMultiple}
                onClick={async () => {
                  setIsMovingMultiple(true);
                  try {
                    for (const cardId of cards
                      .filter((c) => selectedCardIds.has(c.id.toString()))
                      .map((c) => c.id)) {
                      await onArchiveCard(cardId);
                    }
                    clearSelection();
                    toast.success("Cards archived");
                  } catch {
                    toast.error("Failed to archive cards");
                  } finally {
                    setIsMovingMultiple(false);
                  }
                }}
              >
                <Archive className="h-3 w-3" />
                Archive
              </Button>
            )}

            <button
              type="button"
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
              onClick={clearSelection}
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Add card button */}
        {!addingCard && !isSelectionMode && (
          <div className="px-3 pb-3 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground hover:col-accent-bg-soft justify-start gap-2"
              onClick={openAddCard}
            >
              <Plus className="h-3.5 w-3.5" />
              Add card
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

const KanbanColumn = memo(KanbanColumnInner);
export default KanbanColumn;
