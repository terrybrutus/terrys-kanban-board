import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  History,
  Layers,
  ListChecks,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { memo, useState } from "react";
import type { Card, Swimlane, Tag } from "../backend.d";
import {
  useAddChecklistItem,
  useAddComment,
  useCardComments,
  useCardRevisions,
  useChecklistItems,
  useDeleteChecklistItem,
  useDeleteComment,
  useUpdateChecklistItem,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDueDate(dueDate: bigint): string {
  return new Date(Number(dueDate) / 1_000_000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCreatedDate(createdAt: bigint): string {
  return new Date(Number(createdAt) / 1_000_000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCreatedDateTime(createdAt: bigint): string {
  return new Date(Number(createdAt) / 1_000_000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(dueDate: bigint): boolean {
  return Number(dueDate) / 1_000_000 < Date.now();
}

function dueDateToInputValue(dueDate: bigint): string {
  const date = new Date(Number(dueDate) / 1_000_000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inputValueToBigInt(value: string): bigint {
  return BigInt(new Date(value).getTime()) * 1_000_000n;
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const date = new Date(ms);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const diffMs = Date.now() - ms;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

function getInitialsColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  card: Card;
  accentClass: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onUpdate: (title: string, description: string | null) => void;
  onAssign?: (userId: bigint | null) => Promise<void>;
  onUpdateTags?: (tagIds: bigint[]) => Promise<void>;
  onUpdateDueDate?: (dueDate: bigint | null) => Promise<void>;
  onArchive?: (cardId: bigint) => Promise<void>;
  onRestore?: (cardId: bigint) => Promise<void>;
  onUpdateSwimlane?: (
    cardId: bigint,
    swimlaneId: bigint | null,
  ) => Promise<void>;
  users?: User[];
  activeUser?: User | null;
  availableTags?: Tag[];
  swimlanes?: Swimlane[];
  swimlanesEnabled?: boolean;
  isMoving?: boolean;
  isDeleting?: boolean;
  /** When true the card is the drag overlay ghost — no drag listeners attached */
  isOverlay?: boolean;
  /** When true, disable card drag (e.g. while a column is being dragged) */
  disableDrag?: boolean;
  /** When true the card is selected (multi-select mode) */
  isSelected?: boolean;
  /** When true, multi-select mode is active in this column */
  isSelectionMode?: boolean;
  /** Called when the card's checkbox is clicked */
  onToggleSelect?: (e: React.MouseEvent) => void;
}

function KanbanCardInner({
  card,
  accentClass,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onUpdate,
  onAssign,
  onUpdateTags,
  onUpdateDueDate,
  onArchive,
  onRestore,
  onUpdateSwimlane,
  users = [],
  activeUser = null,
  availableTags = [],
  swimlanes = [],
  swimlanesEnabled = false,
  isMoving = false,
  isDeleting = false,
  isOverlay = false,
  disableDrag = false,
  isSelected = false,
  isSelectionMode = false,
  onToggleSelect,
}: KanbanCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description ?? "");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false);
  const [isUpdatingSwimlane, setIsUpdatingSwimlane] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [editDueDate, setEditDueDate] = useState(
    card.dueDate ? dueDateToInputValue(card.dueDate) : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);

  // Hooks for comments & history — only load when modal is open
  const { data: comments = [], isLoading: commentsLoading } = useCardComments(
    modalOpen ? card.id : null,
  );
  const { data: revisions = [], isLoading: revisionsLoading } =
    useCardRevisions(modalOpen ? card.id : null);
  const { mutateAsync: addComment, isPending: isAddingComment } =
    useAddComment();
  const { mutateAsync: deleteComment, isPending: isDeletingComment } =
    useDeleteComment();

  // Checklist hooks — only load full list when modal is open
  // For the card-face progress indicator, use the cached count from props instead
  const { data: checklistItems = [], isLoading: checklistLoading } =
    useChecklistItems(modalOpen ? card.id : null);
  const { mutateAsync: addChecklistItem } = useAddChecklistItem();
  const { mutateAsync: updateChecklistItem } = useUpdateChecklistItem();
  const { mutateAsync: deleteChecklistItem } = useDeleteChecklistItem();

  async function handleSwimlaneChange(value: string) {
    if (!onUpdateSwimlane) return;
    setIsUpdatingSwimlane(true);
    try {
      const swimlaneId = value === "none" ? null : BigInt(value);
      await onUpdateSwimlane(card.id, swimlaneId);
    } finally {
      setIsUpdatingSwimlane(false);
    }
  }

  async function handleArchive() {
    if (!activeUser || !onArchive) return;
    setIsArchiving(true);
    try {
      await onArchive(card.id);
      setModalOpen(false);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestore() {
    if (!activeUser || !onRestore) return;
    setIsArchiving(true);
    try {
      await onRestore(card.id);
      setModalOpen(false);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleAddChecklistItem() {
    const trimmed = newChecklistItem.trim();
    if (!trimmed || !activeUser) return;
    setIsAddingChecklistItem(true);
    try {
      await addChecklistItem({
        cardId: card.id,
        text: trimmed,
        actorUserId: activeUser.id,
      });
      setNewChecklistItem("");
    } finally {
      setIsAddingChecklistItem(false);
    }
  }

  async function handleToggleChecklistItem(
    itemId: bigint,
    text: string,
    isDone: boolean,
  ) {
    if (!activeUser) return;
    await updateChecklistItem({
      itemId,
      text,
      isDone: !isDone,
      actorUserId: activeUser.id,
      cardId: card.id,
    });
  }

  async function handleDeleteChecklistItem(itemId: bigint) {
    if (!activeUser) return;
    await deleteChecklistItem({
      itemId,
      actorUserId: activeUser.id,
      cardId: card.id,
    });
  }

  const checklistDone = checklistItems.filter((i) => i.isDone).length;
  const checklistTotal = checklistItems.length;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id.toString(),
    disabled: isOverlay || modalOpen || disableDrag,
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  function openModal() {
    setEditTitle(card.title);
    setEditDesc(card.description ?? "");
    setEditDueDate(card.dueDate ? dueDateToInputValue(card.dueDate) : "");
    setModalOpen(true);
  }

  async function handleSave() {
    const trimTitle = editTitle.trim();
    if (!trimTitle) return;
    setIsSaving(true);
    try {
      await onUpdate(trimTitle, editDesc.trim() || null);
      setModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignChange(value: string) {
    if (!onAssign) return;
    setIsAssigning(true);
    try {
      const userId = value === "unassigned" ? null : BigInt(value);
      await onAssign(userId);
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleTagToggle(tagId: bigint) {
    if (!onUpdateTags) return;
    const currentTags = card.tags ?? [];
    const tagIdStr = tagId.toString();
    const hasTag = currentTags.some((t) => t.toString() === tagIdStr);
    const newTagIds = hasTag
      ? currentTags.filter((t) => t.toString() !== tagIdStr)
      : [...currentTags, tagId];
    setIsUpdatingTags(true);
    try {
      await onUpdateTags(newTagIds);
    } finally {
      setIsUpdatingTags(false);
    }
  }

  async function handleDueDateChange(value: string) {
    if (!onUpdateDueDate) return;
    setIsUpdatingDueDate(true);
    try {
      if (!value) {
        await onUpdateDueDate(null);
      } else {
        await onUpdateDueDate(inputValueToBigInt(value));
      }
    } finally {
      setIsUpdatingDueDate(false);
    }
  }

  async function handleAddComment() {
    if (!commentText.trim() || !activeUser) return;
    try {
      await addComment({
        cardId: card.id,
        text: commentText.trim(),
        actorUserId: activeUser.id,
      });
      setCommentText("");
    } catch {
      // silently ignore; toast is shown elsewhere
    }
  }

  async function handleDeleteComment(commentId: bigint) {
    if (!activeUser) return;
    try {
      await deleteComment({
        commentId,
        actorUserId: activeUser.id,
        cardId: card.id,
      });
    } catch {
      // silently ignore
    }
  }

  const isAdmin =
    activeUser?.isAdmin === true || activeUser?.isMasterAdmin === true;

  // Find the assigned user name
  const assignedUser =
    card.assignedUserId != null
      ? users.find((u) => u.id === card.assignedUserId)
      : null;

  // Resolved tags
  const resolvedTags = (card.tags ?? [])
    .map((id) => availableTags.find((t) => t.id.toString() === id.toString()))
    .filter((t): t is Tag => t !== undefined);

  return (
    <>
      {/* Card face */}
      <div
        ref={setNodeRef}
        style={style}
        className={`kanban-card group relative rounded-lg bg-card border-l-4 ${accentClass} p-3 shadow-card ${
          isMoving || isDeleting ? "opacity-60 pointer-events-none" : ""
        } ${isDragging && !isOverlay ? "opacity-40 scale-95" : ""} ${
          isOverlay
            ? "shadow-card-hover rotate-1 scale-105 cursor-grabbing"
            : ""
        } ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
      >
        {/* Multi-select checkbox — always faintly visible so users can discover it;
            becomes prominent when selected or in selection mode */}
        {!isOverlay && (
          <button
            type="button"
            className={`absolute left-1.5 top-1.5 h-5 w-5 rounded flex items-center justify-center transition-all z-10 ${
              isSelected
                ? "bg-primary text-primary-foreground opacity-100"
                : isSelectionMode
                  ? "bg-secondary border border-border text-transparent hover:border-primary opacity-100"
                  : "bg-secondary/60 border border-border/40 text-transparent opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:border-primary"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(e);
            }}
            aria-label={isSelected ? "Deselect card" : "Select card"}
            title={isSelected ? "Deselect" : "Select card (for bulk actions)"}
          >
            {isSelected && (
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        )}

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className={`absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors touch-none ${
            isSelectionMode ? "hidden" : ""
          }`}
          title="Drag card"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Card content — click to open modal */}
        <button
          type="button"
          className={`w-full text-left focus:outline-none ${isSelectionMode ? "pl-6" : "pl-4"}`}
          onClick={(e) => {
            if (isSelectionMode) {
              onToggleSelect?.(e);
            } else {
              openModal();
            }
          }}
          aria-label={`Edit card: ${card.title}`}
        >
          {/* Right padding accounts for: up to 4 action buttons × 24px + gaps ≈ 100px */}
          <p
            className={`text-sm font-medium text-card-foreground leading-snug ${isSelectionMode ? "" : "group-hover:pr-[100px] transition-all duration-150"}`}
          >
            {card.title}
          </p>
          {card.description && (
            <p
              className={`text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 ${isSelectionMode ? "" : "group-hover:pr-[100px] transition-all duration-150"}`}
            >
              {card.description}
            </p>
          )}
        </button>

        {/* Tag chips */}
        {resolvedTags.length > 0 && (
          <div
            className={`mt-2 flex flex-wrap gap-1 ${isSelectionMode ? "pl-6" : "pl-4"}`}
          >
            {resolvedTags.map((tag) => (
              <span
                key={tag.id.toString()}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none"
                style={{
                  backgroundColor: `${tag.color}22`,
                  color: tag.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Due date chip */}
        {card.dueDate != null && (
          <div
            className={`mt-1.5 flex items-center gap-1 ${isSelectionMode ? "pl-6" : "pl-4"}`}
          >
            <CalendarClock
              className={`h-3 w-3 shrink-0 ${
                isOverdue(card.dueDate)
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                isOverdue(card.dueDate)
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {formatDueDate(card.dueDate)}
            </span>
          </div>
        )}

        {/* Checklist progress chip */}
        {checklistTotal > 0 && !isOverlay && (
          <div
            className={`mt-1.5 flex items-center gap-1 ${isSelectionMode ? "pl-6" : "pl-4"}`}
          >
            <ListChecks className="h-3 w-3 text-muted-foreground shrink-0" />
            <span
              className={`text-[10px] font-medium ${checklistDone === checklistTotal ? "text-emerald-600" : "text-muted-foreground"}`}
            >
              {checklistDone}/{checklistTotal}
            </span>
          </div>
        )}

        {/* Created date chip */}
        {!isOverlay && (
          <div
            className={`mt-1.5 flex items-center gap-1 ${isSelectionMode ? "pl-6" : "pl-4"}`}
          >
            <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            <span className="text-[10px] text-muted-foreground/60">
              Created: {formatCreatedDate(card.createdAt)}
            </span>
          </div>
        )}

        {/* Archived badge */}
        {card.isArchived && !isOverlay && (
          <div
            className={`mt-1.5 flex items-center gap-1 ${isSelectionMode ? "pl-6" : "pl-4"}`}
          >
            <Archive className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[10px] text-muted-foreground/50 italic">
              Archived
            </span>
          </div>
        )}

        {/* Assignee chip */}
        {assignedUser && (
          <div
            className={`mt-2 flex items-center gap-1.5 ${isSelectionMode ? "pl-6" : "pl-4"}`}
          >
            <div
              className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${getInitialsColor(assignedUser.name)}`}
            >
              {assignedUser.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-[10px] text-muted-foreground truncate">
              {assignedUser.name}
            </span>
          </div>
        )}

        {/* Unassigned indicator */}
        {!assignedUser &&
          users.length > 0 &&
          !isOverlay &&
          !isSelectionMode && (
            <div className="mt-2 pl-4 flex items-center gap-1 opacity-0 group-hover:opacity-60 transition-opacity">
              <UserCircle2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Unassigned
              </span>
            </div>
          )}

        {/* Action buttons — revealed on hover, hidden in selection mode */}
        {!isSelectionMode && (
          <div className="card-actions absolute top-2 right-2 flex items-center gap-0.5">
            {canMoveLeft && (
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                onClick={onMoveLeft}
                title="Move left"
                aria-label="Move card left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {canMoveRight && (
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                onClick={onMoveRight}
                title="Move right"
                aria-label="Move card right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmOpen(true);
              }}
              title="Delete card"
              aria-label="Delete card"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              onClick={openModal}
              title="Edit card"
              aria-label="Edit card"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-display font-semibold">
              Delete this card?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will permanently delete the card and cannot be undone.
              Consider archiving it instead to keep history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
            {/* Archive is the primary/preferred action */}
            {onArchive && activeUser && (
              <Button
                className="w-full gap-1.5"
                onClick={async () => {
                  setDeleteConfirmOpen(false);
                  await onArchive(card.id);
                }}
                autoFocus
              >
                <Archive className="h-3.5 w-3.5" />
                Archive instead (recommended)
              </Button>
            )}
            {/* Delete permanently — destructive, requires explicit click */}
            <Button
              variant="destructive"
              className="w-full gap-1.5"
              onClick={(e) => {
                // Prevent form/dialog default submission on Enter
                e.preventDefault();
                setDeleteConfirmOpen(false);
                onDelete();
              }}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete permanently
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setDeleteConfirmOpen(false)}
              type="button"
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Card Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-base font-display font-semibold text-foreground">
              Card Details
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`card-title-${card.id}`}
                  className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Title
                </label>
                <Input
                  id={`card-title-${card.id}`}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") setModalOpen(false);
                  }}
                  placeholder="Card title"
                  className="text-sm"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`card-desc-${card.id}`}
                  className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Description
                </label>
                <Textarea
                  id={`card-desc-${card.id}`}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setModalOpen(false);
                  }}
                  placeholder="Add a description… (optional)"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Assign to */}
              {users.length > 0 && onAssign && (
                <div className="space-y-1.5">
                  <label
                    htmlFor={`card-assign-${card.id}`}
                    className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    Assign To
                  </label>
                  <select
                    id={`card-assign-${card.id}`}
                    className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    value={
                      card.assignedUserId != null
                        ? card.assignedUserId.toString()
                        : "unassigned"
                    }
                    onChange={(e) => handleAssignChange(e.target.value)}
                    disabled={isAssigning}
                  >
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id.toString()} value={u.id.toString()}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tags */}
              {availableTags.length > 0 && onUpdateTags && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => {
                      const isSelected = (card.tags ?? []).some(
                        (t) => t.toString() === tag.id.toString(),
                      );
                      return (
                        <button
                          key={tag.id.toString()}
                          type="button"
                          onClick={() => handleTagToggle(tag.id)}
                          disabled={isUpdatingTags}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all border ${
                            isSelected
                              ? "opacity-100 ring-1 ring-offset-1 ring-current"
                              : "opacity-50 hover:opacity-80"
                          }`}
                          style={{
                            backgroundColor: `${tag.color}22`,
                            color: tag.color,
                            borderColor: `${tag.color}44`,
                          }}
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Due date */}
              {onUpdateDueDate && (
                <div className="space-y-1.5">
                  <label
                    htmlFor={`card-duedate-${card.id}`}
                    className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    Due Date
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`card-duedate-${card.id}`}
                      type="date"
                      className="h-9 text-sm rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      onBlur={(e) => handleDueDateChange(e.target.value)}
                      disabled={isUpdatingDueDate}
                    />
                    {editDueDate && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => {
                          setEditDueDate("");
                          handleDueDateChange("");
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Created date (read-only) */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created
                </p>
                <p className="text-sm text-foreground/80">
                  {formatCreatedDateTime(card.createdAt)}
                </p>
              </div>

              {/* Swimlane selector */}
              {swimlanesEnabled && swimlanes.length > 0 && onUpdateSwimlane && (
                <div className="space-y-1.5">
                  <label
                    htmlFor={`card-swimlane-${card.id}`}
                    className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1"
                  >
                    <Layers className="h-3 w-3" />
                    Swimlane
                  </label>
                  <select
                    id={`card-swimlane-${card.id}`}
                    className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    value={
                      card.swimlaneId != null
                        ? card.swimlaneId.toString()
                        : "none"
                    }
                    onChange={(e) => handleSwimlaneChange(e.target.value)}
                    disabled={isUpdatingSwimlane}
                  >
                    <option value="none">Default (no swimlane)</option>
                    {swimlanes.map((sl) => (
                      <option key={sl.id.toString()} value={sl.id.toString()}>
                        {sl.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Save/Cancel + Archive */}
              <div className="flex gap-2 pt-1 flex-wrap">
                <Button
                  size="sm"
                  className="h-8 text-xs px-4"
                  onClick={handleSave}
                  disabled={!editTitle.trim() || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs px-3"
                  onClick={() => setModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <div className="flex-1" />
                {/* Archive / Restore */}
                {activeUser &&
                  (card.isArchived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3 gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                      onClick={handleRestore}
                      disabled={isArchiving || !onRestore}
                      title="Restore this card"
                    >
                      {isArchiving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      )}
                      Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={handleArchive}
                      disabled={isArchiving || !onArchive}
                      title="Archive this card"
                    >
                      {isArchiving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      Archive
                    </Button>
                  ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Checklist section */}
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left hover:text-foreground text-muted-foreground transition-colors group/cl"
                  onClick={() => setShowChecklist((v) => !v)}
                >
                  <ListChecks className="h-4 w-4" />
                  <span className="text-sm font-semibold text-foreground">
                    Checklist
                  </span>
                  {checklistTotal > 0 && (
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium ${checklistDone === checklistTotal ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary text-muted-foreground"}`}
                    >
                      {checklistDone}/{checklistTotal}
                    </span>
                  )}
                  <span className="ml-auto">
                    {showChecklist ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {showChecklist && (
                  <div className="space-y-1.5 pl-1">
                    {checklistLoading ? (
                      <div className="space-y-1.5">
                        {[0, 1].map((i) => (
                          <div
                            key={i}
                            className="h-8 rounded bg-secondary/50 animate-pulse"
                          />
                        ))}
                      </div>
                    ) : checklistItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">
                        No items yet.
                      </p>
                    ) : (
                      [...checklistItems]
                        .sort((a, b) => Number(a.order - b.order))
                        .map((item) => (
                          <div
                            key={item.id.toString()}
                            className="group/ci flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40 transition-colors"
                          >
                            <Checkbox
                              id={`ci-${item.id}`}
                              checked={item.isDone}
                              onCheckedChange={() =>
                                handleToggleChecklistItem(
                                  item.id,
                                  item.text,
                                  item.isDone,
                                )
                              }
                              disabled={!activeUser}
                              className="shrink-0"
                            />
                            <label
                              htmlFor={`ci-${item.id}`}
                              className={`flex-1 text-xs cursor-pointer select-none ${item.isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                            >
                              {item.text}
                            </label>
                            {activeUser && (
                              <button
                                type="button"
                                className="opacity-0 group-hover/ci:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() =>
                                  handleDeleteChecklistItem(item.id)
                                }
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))
                    )}

                    {/* Add checklist item */}
                    {activeUser && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Input
                          value={newChecklistItem}
                          onChange={(e) => setNewChecklistItem(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddChecklistItem();
                            }
                          }}
                          placeholder="Add item…"
                          className="h-7 text-xs flex-1"
                          disabled={isAddingChecklistItem}
                        />
                        <Button
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={handleAddChecklistItem}
                          disabled={
                            !newChecklistItem.trim() || isAddingChecklistItem
                          }
                          title="Add item"
                        >
                          {isAddingChecklistItem ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Comments section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Comments
                  </h3>
                  {comments.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                      {comments.length}
                    </span>
                  )}
                </div>

                {/* Comment list */}
                {commentsLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-lg bg-secondary/50 animate-pulse"
                      />
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No comments yet. Be the first to add one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...comments]
                      .sort((a, b) => Number(a.timestamp - b.timestamp))
                      .map((comment) => {
                        const canDelete =
                          activeUser !== null &&
                          (comment.authorId === activeUser.id || isAdmin);
                        return (
                          <div
                            key={comment.id.toString()}
                            className="group/comment flex gap-2.5 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors"
                          >
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${getInitialsColor(comment.authorName)}`}
                            >
                              {comment.authorName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-foreground">
                                  {comment.authorName}
                                </span>
                                <span
                                  className="text-[10px] text-muted-foreground/70 cursor-default"
                                  title={formatTimestamp(comment.timestamp)}
                                >
                                  {formatRelative(comment.timestamp)}
                                </span>
                              </div>
                              <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                {comment.text}
                              </p>
                            </div>
                            {canDelete && (
                              <button
                                type="button"
                                className="opacity-0 group-hover/comment:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={isDeletingComment}
                                title="Delete comment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Add comment input */}
                {activeUser ? (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                        placeholder="Add a comment… (Enter to send)"
                        rows={2}
                        className="text-xs resize-none"
                        disabled={isAddingComment}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || isAddingComment}
                      title="Send comment"
                    >
                      {isAddingComment ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Set yourself as active to add comments.
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Card History — collapsible */}
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left hover:text-foreground text-muted-foreground transition-colors group/hist"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <History className="h-4 w-4" />
                  <span className="text-sm font-semibold text-foreground">
                    Card History
                  </span>
                  {revisions.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                      {revisions.length}
                    </span>
                  )}
                  <span className="ml-auto">
                    {showHistory ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {showHistory && (
                  <div className="space-y-1">
                    {revisionsLoading ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="h-10 rounded-lg bg-secondary/50 animate-pulse"
                          />
                        ))}
                      </div>
                    ) : revisions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No history recorded for this card yet.
                      </p>
                    ) : (
                      [...revisions]
                        .sort((a, b) => Number(b.timestamp - a.timestamp))
                        .map((rev) => (
                          <div
                            key={rev.id.toString()}
                            className="flex gap-2.5 py-2 px-3 rounded-lg hover:bg-secondary/40 transition-colors"
                          >
                            <div
                              className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5 ${getInitialsColor(rev.actorName)}`}
                            >
                              {rev.actorName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-semibold text-foreground">
                                {rev.actorName}
                              </span>{" "}
                              <span className="text-[10px] text-muted-foreground">
                                {rev.description}
                              </span>
                            </div>
                            <span
                              className="text-[10px] text-muted-foreground/70 whitespace-nowrap shrink-0 cursor-default"
                              title={formatTimestamp(rev.timestamp)}
                            >
                              {formatRelative(rev.timestamp)}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Bottom padding */}
              <div className="h-2" />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

const KanbanCard = memo(KanbanCardInner);
export default KanbanCard;
