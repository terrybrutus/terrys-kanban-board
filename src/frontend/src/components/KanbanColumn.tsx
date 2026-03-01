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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ArrowRight,
  Check,
  GripVertical,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Card, ColumnView, Swimlane, Tag } from "../backend.d";
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
  onUpdateCard: (
    cardId: bigint,
    title: string,
    description: string | null,
  ) => Promise<void>;
  onDeleteCard: (cardId: bigint) => Promise<void>;
  onMoveCard: (
    cardId: bigint,
    targetColumnId: bigint,
    newPosition: bigint,
  ) => Promise<void>;
  onRenameColumn: (columnId: bigint, newName: string) => Promise<void>;
  onDeleteColumn: (columnId: bigint) => Promise<void>;
  onAssignCard: (cardId: bigint, userId: bigint | null) => Promise<void>;
  onUpdateCardTags: (cardId: bigint, tagIds: bigint[]) => Promise<void>;
  onUpdateCardDueDate: (
    cardId: bigint,
    dueDate: bigint | null,
  ) => Promise<void>;
  onArchiveCard?: (cardId: bigint) => Promise<void>;
  onRestoreCard?: (cardId: bigint) => Promise<void>;
  onUpdateCardSwimlane?: (
    cardId: bigint,
    swimlaneId: bigint | null,
  ) => Promise<void>;
  onMoveCards?: (cardIds: bigint[], targetColumnId: bigint) => Promise<void>;
  onBulkImport?: () => void;
  onQuickAdd?: (
    columnId: bigint,
    title: string,
    tagIds: bigint[],
    assigneeId: bigint | null,
    dueDate: bigint | null,
    swimlaneId: bigint | null,
  ) => Promise<void>;
  projectTags: Tag[];
  siblingColumns: ColumnView[];
  users: User[];
  activeUser: User | null;
  swimlanes?: Swimlane[];
  swimlanesEnabled?: boolean;
  animationDelay?: number;
  /** When dragging a column, disable card drag (prevents overlap) */
  isDraggingColumn?: boolean;
}

export default function KanbanColumn({
  column,
  cards,
  columnIndex,
  isFirst,
  isLast,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onMoveCard,
  onRenameColumn,
  onDeleteColumn,
  onAssignCard,
  onUpdateCardTags,
  onUpdateCardDueDate,
  onArchiveCard,
  onRestoreCard,
  onUpdateCardSwimlane,
  onMoveCards,
  onBulkImport,
  onQuickAdd,
  projectTags,
  siblingColumns,
  users,
  activeUser,
  swimlanes = [],
  swimlanesEnabled = false,
  animationDelay = 0,
  isDraggingColumn = false,
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

  // ── dnd-kit droppable (for cards — used when swimlanes are disabled) ─────────
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-${column.id.toString()}`,
    data: { columnId: column.id, type: "column" },
    disabled: isDraggingColumn || (swimlanesEnabled && swimlanes.length > 0),
  });

  // ── Swimlane droppables (one per lane) ───────────────────────────────────────
  const sortedSwimlanes = [...swimlanes].sort((a, b) =>
    Number(a.order - b.order),
  );

  function SwimlaneDropZone({
    swimlaneId,
    children,
    isEmpty,
  }: {
    swimlaneId: bigint | null;
    children: React.ReactNode;
    isEmpty: boolean;
  }) {
    const dropId =
      swimlaneId != null
        ? `swimlane-${swimlaneId.toString()}-col-${column.id.toString()}`
        : `swimlane-default-col-${column.id.toString()}`;

    const { setNodeRef: setSlDropRef, isOver: isSlOver } = useDroppable({
      id: dropId,
      data: {
        columnId: column.id,
        swimlaneId: swimlaneId,
        type: "swimlane-zone",
      },
      disabled: isDraggingColumn,
    });

    return (
      <div
        ref={setSlDropRef}
        className={`min-h-[40px] rounded-md transition-colors ${
          isSlOver && !isDraggingColumn
            ? "bg-primary/5 ring-1 ring-primary/20"
            : ""
        } ${isEmpty ? "" : "space-y-2"}`}
      >
        {isEmpty && !isSlOver ? (
          <div className="py-3 text-center text-xs text-muted-foreground/50 italic">
            Empty
          </div>
        ) : (
          children
        )}
      </div>
    );
  }

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
  const [newCardSwimlaneId, setNewCardSwimlaneId] = useState<string>("none");
  const [isAdding, setIsAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingCard) addInputRef.current?.focus();
  }, [addingCard]);

  function openAddCard() {
    setNewCardTitle("");
    setNewCardDesc("");
    setNewCardSwimlaneId("none");
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
      const cardId = await onAddCard(
        column.id,
        trimTitle,
        newCardDesc.trim() || null,
      );
      // Assign swimlane if selected
      if (
        newCardSwimlaneId !== "none" &&
        onUpdateCardSwimlane &&
        cardId != null
      ) {
        try {
          await onUpdateCardSwimlane(cardId, BigInt(newCardSwimlaneId));
        } catch {
          // Non-fatal
        }
      }
      setNewCardTitle("");
      setNewCardDesc("");
      setNewCardSwimlaneId("none");
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
      // If there are cards and sibling columns exist, move cards first
      if (cards.length > 0 && targetColumns.length > 0) {
        if (deleteDestinationColumnId === "none") return; // button should be disabled
        const destId = BigInt(deleteDestinationColumnId);
        if (onMoveCards) {
          const cardIds = cards.map((c) => c.id);
          await onMoveCards(cardIds, destId);
        }
      }
      await onDeleteColumn(column.id);
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

  // ── Quick Add state ──────────────────────────────────────────────────────────
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAddSwimlaneId, setQuickAddSwimlaneId] = useState<string>("none");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const quickAddRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showQuickAdd) quickAddRef.current?.focus();
  }, [showQuickAdd]);

  function parseQuickAddLine(line: string): {
    title: string;
    tagIds: bigint[];
    assigneeId: bigint | null;
    dueDate: bigint | null;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let rest = line;

    // Extract due date
    let dueDate: bigint | null = null;
    rest = rest.replace(/due:(\S+)/gi, (_match, dateStr) => {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) {
        warnings.push(`Invalid date: "${dateStr}"`);
      } else {
        dueDate = BigInt(d.getTime()) * 1_000_000n;
      }
      return "";
    });

    // Extract tags — quoted first (#"Multi Word Tag"), then single-word (#Tag)
    const tagIds: bigint[] = [];
    rest = rest.replace(/#"([^"]+)"/g, (_match, tagName) => {
      const tag = projectTags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      );
      if (tag) {
        tagIds.push(tag.id);
      } else {
        warnings.push(`Tag not found: "#${tagName}"`);
      }
      return "";
    });
    rest = rest.replace(/#(\S+)/g, (_match, tagName) => {
      const tag = projectTags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      );
      if (tag) {
        tagIds.push(tag.id);
      } else {
        warnings.push(`Tag not found: "#${tagName}"`);
      }
      return "";
    });

    // Extract assignee — quoted first (@"Full Name"), then single-word (@Name)
    let assigneeId: bigint | null = null;
    rest = rest.replace(/@"([^"]+)"/g, (_match, userName) => {
      const user = users.find(
        (u) => u.name.toLowerCase() === userName.toLowerCase(),
      );
      if (user) {
        assigneeId = user.id;
      } else {
        warnings.push(`User not found: "@${userName}"`);
      }
      return "";
    });
    rest = rest.replace(/@(\S+)/g, (_match, userName) => {
      const user = users.find(
        (u) => u.name.toLowerCase() === userName.toLowerCase(),
      );
      if (user) {
        assigneeId = user.id;
      } else {
        warnings.push(`User not found: "@${userName}"`);
      }
      return "";
    });

    const title = rest.replace(/\s+/g, " ").trim();
    return { title, tagIds, assigneeId, dueDate, warnings };
  }

  async function handleQuickAdd() {
    const lines = quickAddText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;
    if (!activeUser) {
      toast.error("Set yourself as active first");
      return;
    }

    setIsQuickAdding(true);
    let created = 0;
    const allWarnings: string[] = [];
    const swimlaneId =
      quickAddSwimlaneId !== "none" ? BigInt(quickAddSwimlaneId) : null;

    for (const line of lines) {
      const { title, tagIds, assigneeId, dueDate, warnings } =
        parseQuickAddLine(line);
      if (!title) {
        allWarnings.push(`Skipped empty title from line: "${line}"`);
        continue;
      }
      try {
        if (onQuickAdd) {
          await onQuickAdd(
            column.id,
            title,
            tagIds,
            assigneeId,
            dueDate,
            swimlaneId,
          );
        } else {
          await onAddCard(column.id, title, null);
        }
        created++;
        allWarnings.push(...warnings.map((w) => `"${title}": ${w}`));
      } catch {
        allWarnings.push(`Failed to create card: "${title}"`);
      }
    }

    setIsQuickAdding(false);
    setQuickAddText("");
    setShowQuickAdd(false);

    if (created > 0) {
      const msg = `${created} card${created !== 1 ? "s" : ""} created`;
      if (allWarnings.length > 0) {
        toast.warning(`${msg}. Warnings: ${allWarnings.join("; ")}`);
      } else {
        toast.success(msg);
      }
    }
  }

  const cardIds = cards.map((c) => c.id.toString());

  // ── Swimlane grouping ─────────────────────────────────────────────────────────
  function groupCardsBySwimlane(): Array<{
    swimlane: Swimlane | null;
    cards: Card[];
  }> {
    if (!swimlanesEnabled || swimlanes.length === 0) {
      return [{ swimlane: null, cards }];
    }
    const groups: Array<{ swimlane: Swimlane | null; cards: Card[] }> =
      sortedSwimlanes.map((sl) => ({
        swimlane: sl,
        cards: cards.filter(
          (c) =>
            c.swimlaneId != null &&
            c.swimlaneId.toString() === sl.id.toString(),
        ),
      }));
    const defaultCards = cards.filter((c) => c.swimlaneId == null);
    if (defaultCards.length > 0 || groups.length === 0) {
      groups.push({ swimlane: null, cards: defaultCards });
    }
    return groups;
  }

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
              {/* Quick Add button */}
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                onClick={() => setShowQuickAdd((v) => !v)}
                title="Quick add cards"
                aria-label="Quick add cards"
              >
                <Zap className="h-3.5 w-3.5" />
              </button>
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
                  <DropdownMenuItem onClick={onBulkImport}>
                    <Upload className="h-3.5 w-3.5 mr-2" />
                    Bulk import cards
                  </DropdownMenuItem>
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

        {/* Quick Add panel */}
        {showQuickAdd && (
          <div className="mx-3 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">
                Quick Add
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-xs" side="right">
                  <p className="font-semibold text-foreground mb-2">
                    Quick Add shortcuts
                  </p>
                  <p className="text-muted-foreground mb-1">
                    One card per line. Shortcuts:
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      <code className="text-primary">#TagName</code> — apply a
                      tag
                    </li>
                    <li>
                      <code className="text-primary">#"Multi Word Tag"</code> —
                      tag with spaces
                    </li>
                    <li>
                      <code className="text-primary">@UserName</code> — assign
                      to user
                    </li>
                    <li>
                      <code className="text-primary">@"Full Name"</code> —
                      assign multi-word name
                    </li>
                    <li>
                      <code className="text-primary">due:YYYY-MM-DD</code> — set
                      due date
                    </li>
                  </ul>
                  <div className="mt-2 pt-2 border-t border-border space-y-1">
                    <p className="text-muted-foreground/70 font-medium">
                      Examples:
                    </p>
                    <p className="text-muted-foreground/70 font-mono text-[10px]">
                      Priority 22 #Active @Brandy due:2026-03-15
                    </p>
                    <p className="text-muted-foreground/70 font-mono text-[10px]">
                      Send to client #"Waiting for Client"
                    </p>
                    <p className="text-muted-foreground/70 font-mono text-[10px]">
                      @"Terry Brutus" Review slides due:2026-04-01
                    </p>
                    <p className="text-muted-foreground/70 font-mono text-[10px]">
                      Plain title with no shortcuts
                    </p>
                  </div>
                  {swimlanesEnabled && swimlanes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-muted-foreground/70 text-[10px]">
                        Cards can also be dragged between swimlane rows on the
                        board.
                      </p>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Swimlane picker for Quick Add */}
            {swimlanesEnabled && swimlanes.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block">
                  Lane
                </span>
                <Select
                  value={quickAddSwimlaneId}
                  onValueChange={setQuickAddSwimlaneId}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="No lane (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lane (default)</SelectItem>
                    {sortedSwimlanes.map((sl) => (
                      <SelectItem
                        key={sl.id.toString()}
                        value={sl.id.toString()}
                      >
                        {sl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Textarea
              ref={quickAddRef}
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              placeholder={
                "One card per line\nPriority 22 #Active @Terry due:2026-03-15"
              }
              rows={4}
              className="text-xs resize-none"
              disabled={isQuickAdding}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs px-3 gap-1"
                onClick={handleQuickAdd}
                disabled={!quickAddText.trim() || isQuickAdding}
              >
                {isQuickAdding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                Create cards
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-3"
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickAddText("");
                }}
                disabled={isQuickAdding}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Cards drop zone */}
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setDropRef}
            className={`flex-1 overflow-y-auto px-3 pb-2 min-h-[80px] max-h-[calc(100vh-300px)] transition-colors rounded-b-md ${
              isOver &&
              !isDraggingColumn &&
              !(swimlanesEnabled && swimlanes.length > 0)
                ? "column-drag-over"
                : ""
            } ${accentClass}`}
          >
            {cards.length === 0 &&
              !addingCard &&
              !(swimlanesEnabled && swimlanes.length > 0) && (
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

            {/* Swimlane groups or flat card list */}
            {swimlanesEnabled && swimlanes.length > 0 ? (
              groupCardsBySwimlane().map((group, groupIdx) => (
                <div
                  key={
                    group.swimlane ? group.swimlane.id.toString() : "default"
                  }
                  className={groupIdx > 0 ? "mt-3" : ""}
                >
                  {/* Swimlane header with thicker, cleaner divider */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                      {group.swimlane ? group.swimlane.name : "Default"}
                    </span>
                    <div className="flex-1 h-[2px] bg-border/70" />
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {group.cards.length}
                    </span>
                  </div>

                  {/* Swimlane drop zone */}
                  <SwimlaneDropZone
                    swimlaneId={group.swimlane ? group.swimlane.id : null}
                    isEmpty={group.cards.length === 0}
                  >
                    <div className="space-y-2">
                      {group.cards.map((card, idx) => {
                        const globalIdx = cards.findIndex(
                          (c) => c.id === card.id,
                        );
                        return (
                          <KanbanCard
                            key={card.id.toString()}
                            card={card}
                            accentClass={`col-accent-border ${accentClass}`}
                            canMoveLeft={!isFirst}
                            canMoveRight={!isLast}
                            onMoveLeft={() => handleMoveCard(card, "left")}
                            onMoveRight={() => handleMoveCard(card, "right")}
                            onDelete={() => handleDeleteCard(card.id)}
                            onUpdate={(title, description) =>
                              onUpdateCard(card.id, title, description)
                            }
                            onAssign={(userId) => onAssignCard(card.id, userId)}
                            onUpdateTags={(tagIds) =>
                              onUpdateCardTags(card.id, tagIds)
                            }
                            onUpdateDueDate={(dueDate) =>
                              onUpdateCardDueDate(card.id, dueDate)
                            }
                            onArchive={onArchiveCard}
                            onRestore={onRestoreCard}
                            onUpdateSwimlane={onUpdateCardSwimlane}
                            availableTags={projectTags}
                            swimlanes={swimlanes}
                            swimlanesEnabled={swimlanesEnabled}
                            users={users}
                            activeUser={activeUser}
                            isMoving={movingCardId === card.id}
                            isDeleting={deletingCardId === card.id}
                            disableDrag={isDraggingColumn || isSelectionMode}
                            isSelected={selectedCardIds.has(card.id.toString())}
                            isSelectionMode={isSelectionMode}
                            onToggleSelect={(e) =>
                              handleToggleSelect(
                                card,
                                globalIdx >= 0 ? globalIdx : idx,
                                e,
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </SwimlaneDropZone>
                </div>
              ))
            ) : (
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
                    onUpdate={(title, description) =>
                      onUpdateCard(card.id, title, description)
                    }
                    onAssign={(userId) => onAssignCard(card.id, userId)}
                    onUpdateTags={(tagIds) => onUpdateCardTags(card.id, tagIds)}
                    onUpdateDueDate={(dueDate) =>
                      onUpdateCardDueDate(card.id, dueDate)
                    }
                    onArchive={onArchiveCard}
                    onRestore={onRestoreCard}
                    onUpdateSwimlane={onUpdateCardSwimlane}
                    availableTags={projectTags}
                    swimlanes={swimlanes}
                    swimlanesEnabled={swimlanesEnabled}
                    users={users}
                    activeUser={activeUser}
                    isMoving={movingCardId === card.id}
                    isDeleting={deletingCardId === card.id}
                    disableDrag={isDraggingColumn || isSelectionMode}
                    isSelected={selectedCardIds.has(card.id.toString())}
                    isSelectionMode={isSelectionMode}
                    onToggleSelect={(e) => handleToggleSelect(card, idx, e)}
                  />
                ))}
              </div>
            )}

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
                {/* Swimlane picker for inline add */}
                {swimlanesEnabled && swimlanes.length > 0 && (
                  <div className="mb-2 space-y-1">
                    <span className="text-xs text-muted-foreground block">
                      Swimlane (optional)
                    </span>
                    <Select
                      value={newCardSwimlaneId}
                      onValueChange={setNewCardSwimlaneId}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sortedSwimlanes.map((sl) => (
                          <SelectItem
                            key={sl.id.toString()}
                            value={sl.id.toString()}
                          >
                            {sl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
          <div className="mx-3 mb-2 mt-1 rounded-lg bg-primary/10 border border-primary/25 px-3 py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-primary shrink-0">
              {selectedCardIds.size} selected
            </span>
            <div className="flex-1" />
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
