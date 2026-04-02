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
import {
  Archive,
  ArchiveRestore,
  Calendar,
  ChevronDown,
  ChevronUp,
  GripVertical,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ColumnView, Tag } from "../backend.d";
import {
  useAddChecklistItem,
  useAddComment,
  useCardComments,
  useCardRevisions,
  useCards,
  useChecklistItems,
  useDeleteChecklistItem,
  useDeleteComment,
  useReorderChecklistItems,
  useUpdateChecklistItem,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

// ── Date helpers ───────────────────────────────────────────────────────────────

function formatCreatedDateTime(createdAt: bigint): string {
  return new Date(Number(createdAt) / 1_000_000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

// ── Props ──────────────────────────────────────────────────────────────────────

export interface CardDetailModalProps {
  cardId: bigint;
  projectId: bigint;
  onClose: () => void;
  onUpdate: (
    cardId: bigint,
    title: string,
    description: string | null,
  ) => Promise<void>;
  onAssign?: (cardId: bigint, userId: bigint | null) => Promise<void>;
  onUpdateTags?: (cardId: bigint, tagIds: bigint[]) => Promise<void>;
  onUpdateDueDate?: (cardId: bigint, dueDate: bigint | null) => Promise<void>;
  onArchive?: (cardId: bigint) => Promise<void>;
  onRestore?: (cardId: bigint) => Promise<void>;
  onMoveToColumn?: (cardId: bigint, columnId: bigint) => Promise<void>;
  columns?: ColumnView[];
  users?: User[];
  activeUser?: User | null;
  availableTags?: Tag[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CardDetailModal({
  cardId,
  projectId,
  onClose,
  onUpdate,
  onAssign,
  onUpdateTags,
  onUpdateDueDate,
  onArchive,
  onRestore,
  onMoveToColumn,
  columns = [],
  users = [],
  activeUser = null,
  availableTags = [],
}: CardDetailModalProps) {
  // ── Live card data from React Query cache ──────────────────────────────────
  const { data: allCards = [] } = useCards(projectId);
  const card = allCards.find((c) => c.id === cardId);

  // ── Edit state (initialized from card on first render) ────────────────────
  const [editTitle, setEditTitle] = useState(card?.title ?? "");
  const [editDesc, setEditDesc] = useState(card?.description ?? "");
  const [editDueDate, setEditDueDate] = useState(
    card?.dueDate ? dueDateToInputValue(card.dueDate) : "",
  );
  const hasInit = useRef(card != null);

  // Fallback init if card wasn't in cache on first render
  useEffect(() => {
    if (card && !hasInit.current) {
      hasInit.current = true;
      setEditTitle(card.title);
      setEditDesc(card.description ?? "");
      setEditDueDate(card.dueDate ? dueDateToInputValue(card.dueDate) : "");
    }
  }, [card]);

  // Close if card no longer exists (e.g. was deleted)
  useEffect(() => {
    if (allCards.length > 0 && !card) {
      onClose();
    }
  }, [card, allCards.length, onClose]);

  // ── Async state ────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isMovingColumn, setIsMovingColumn] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [commentText, setCommentText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // ── Data hooks (always loaded since modal is always mounted) ───────────────
  const { data: comments = [], isLoading: commentsLoading } =
    useCardComments(cardId);
  const { data: revisions = [], isLoading: revisionsLoading } =
    useCardRevisions(cardId);
  const { mutateAsync: addComment, isPending: isAddingComment } =
    useAddComment();
  const { mutateAsync: deleteComment, isPending: isDeletingComment } =
    useDeleteComment();

  const { data: checklistItems = [], isLoading: checklistLoading } =
    useChecklistItems(cardId);
  const { mutateAsync: addChecklistItem } = useAddChecklistItem();
  const { mutateAsync: updateChecklistItem } = useUpdateChecklistItem();
  const { mutateAsync: reorderChecklistItems } = useReorderChecklistItems();
  const { mutateAsync: deleteChecklistItem } = useDeleteChecklistItem();

  // ── Return null AFTER all hooks ────────────────────────────────────────────
  if (!card) return null;

  // ── Derived values ─────────────────────────────────────────────────────────
  const isDirty =
    editTitle.trim() !== card.title ||
    editDesc.trim() !== (card.description ?? "");

  const isAdmin =
    activeUser?.isAdmin === true || activeUser?.isMasterAdmin === true;

  const checklistDone = checklistItems.filter((i) => i.isDone).length;
  const checklistTotal = checklistItems.length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleClose() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  }

  async function handleSaveAndClose() {
    const trimTitle = editTitle.trim();
    if (!trimTitle) return;
    setIsSaving(true);
    try {
      await onUpdate(cardId, trimTitle, editDesc.trim() || null);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  // Auto-save title on blur
  async function handleTitleBlur() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === card!.title) return;
    setIsSaving(true);
    try {
      await onUpdate(cardId, trimmed, editDesc.trim() || null);
    } finally {
      setIsSaving(false);
    }
  }

  // Auto-save description on blur
  async function handleDescBlur() {
    const trimTitle = editTitle.trim() || card!.title;
    const trimDesc = editDesc.trim();
    if (trimDesc === (card!.description ?? "")) return;
    setIsSaving(true);
    try {
      await onUpdate(cardId, trimTitle, trimDesc || null);
    } finally {
      setIsSaving(false);
    }
  }

  // Auto-save column change — modal stays open
  async function handleColumnChange(value: string) {
    if (!onMoveToColumn) return;
    const targetId = BigInt(value);
    if (targetId === card!.columnId) return;
    setIsMovingColumn(true);
    try {
      await onMoveToColumn(cardId, targetId);
      // Modal stays open — card data updates reactively
    } finally {
      setIsMovingColumn(false);
    }
  }

  // Auto-save assignee change
  async function handleAssignChange(value: string) {
    if (!onAssign) return;
    setIsAssigning(true);
    try {
      const userId = value === "unassigned" ? null : BigInt(value);
      await onAssign(cardId, userId);
    } finally {
      setIsAssigning(false);
    }
  }

  // Auto-save tag toggle
  async function handleTagToggle(tagId: bigint) {
    if (!onUpdateTags) return;
    const currentTags = card!.tags ?? [];
    const tagIdStr = tagId.toString();
    const hasTag = currentTags.some((t) => t.toString() === tagIdStr);
    const newTagIds = hasTag
      ? currentTags.filter((t) => t.toString() !== tagIdStr)
      : [...currentTags, tagId];
    setIsUpdatingTags(true);
    try {
      await onUpdateTags(cardId, newTagIds);
    } finally {
      setIsUpdatingTags(false);
    }
  }

  // Auto-save due date on blur
  async function handleDueDateChange(value: string) {
    if (!onUpdateDueDate) return;
    setIsUpdatingDueDate(true);
    try {
      if (!value) {
        await onUpdateDueDate(cardId, null);
      } else {
        await onUpdateDueDate(cardId, inputValueToBigInt(value));
      }
    } finally {
      setIsUpdatingDueDate(false);
    }
  }

  async function handleArchive() {
    if (!activeUser || !onArchive) return;
    setIsArchiving(true);
    try {
      await onArchive(cardId);
      onClose();
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestore() {
    if (!activeUser || !onRestore) return;
    setIsArchiving(true);
    try {
      await onRestore(cardId);
      onClose();
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
        cardId,
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
      cardId,
    });
  }

  async function handleDeleteChecklistItem(itemId: bigint) {
    if (!activeUser) return;
    await deleteChecklistItem({
      itemId,
      actorUserId: activeUser.id,
      cardId,
    });
  }

  async function handleAddComment() {
    if (!commentText.trim() || !activeUser) return;
    try {
      await addComment({
        cardId,
        text: commentText.trim(),
        actorUserId: activeUser.id,
      });
      setCommentText("");
    } catch {
      // silently ignore
    }
  }

  async function handleDeleteComment(commentId: bigint) {
    if (!activeUser) return;
    try {
      await deleteComment({
        commentId,
        actorUserId: activeUser.id,
        cardId,
      });
    } catch {
      // silently ignore
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Unsaved changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              You have unsaved changes to the title or description. Save them
              before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowUnsavedDialog(false);
                setEditTitle(card.title);
                setEditDesc(card.description ?? "");
                onClose();
              }}
              data-ocid="card.modal.cancel_button"
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowUnsavedDialog(false);
                handleSaveAndClose();
              }}
              disabled={!editTitle.trim() || isSaving}
              data-ocid="card.modal.save_button"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Card Detail Dialog */}
      <Dialog
        open={true}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent
          className="max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0"
          data-ocid="card.modal"
        >
          {/* Modal header — editable title */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="sr-only">Card Details</DialogTitle>
            <Input
              id={`card-title-${cardId}`}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") handleClose();
              }}
              placeholder="Card title"
              className="text-lg font-semibold border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent h-auto py-1.5"
              autoFocus
              data-ocid="card.input"
            />
            {isSaving && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              {/* ── Two-panel layout ── */}
              <div className="flex flex-col md:flex-row gap-5">
                {/* Left — Description */}
                <div className="flex-1 space-y-2">
                  <label
                    htmlFor={`card-desc-${cardId}`}
                    className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    Description
                  </label>
                  <Textarea
                    id={`card-desc-${cardId}`}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onBlur={handleDescBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") handleClose();
                    }}
                    placeholder="Add a description… (optional)"
                    rows={7}
                    className="text-sm resize-none w-full"
                    data-ocid="card.textarea"
                  />
                </div>

                {/* Right — Metadata sidebar */}
                <div className="md:w-52 shrink-0 space-y-4">
                  {/* Column assignment — auto-saves, modal stays open */}
                  {columns.length > 0 && onMoveToColumn && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`card-column-${cardId}`}
                        className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block"
                      >
                        Column
                      </label>
                      <select
                        id={`card-column-${cardId}`}
                        value={card.columnId.toString()}
                        onChange={(e) => handleColumnChange(e.target.value)}
                        disabled={isMovingColumn}
                        className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        data-ocid="card.select"
                      >
                        {columns.map((col) => (
                          <option
                            key={col.id.toString()}
                            value={col.id.toString()}
                          >
                            {col.name}
                          </option>
                        ))}
                      </select>
                      {isMovingColumn && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Moving…
                        </span>
                      )}
                    </div>
                  )}

                  {/* Assignee — auto-saves */}
                  {users.length > 0 && onAssign && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`card-assign-${cardId}`}
                        className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block"
                      >
                        Assign To
                      </label>
                      <select
                        id={`card-assign-${cardId}`}
                        className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        value={
                          card.assignedUserId != null
                            ? card.assignedUserId.toString()
                            : "unassigned"
                        }
                        onChange={(e) => handleAssignChange(e.target.value)}
                        disabled={isAssigning}
                        data-ocid="card.select"
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

                  {/* Due Date — auto-saves on blur */}
                  {onUpdateDueDate && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`card-duedate-${cardId}`}
                        className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block"
                      >
                        Due Date
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`card-duedate-${cardId}`}
                          type="date"
                          className="flex-1 h-9 text-sm rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          onBlur={(e) => handleDueDateChange(e.target.value)}
                          disabled={isUpdatingDueDate}
                          data-ocid="card.input"
                        />
                        {editDueDate && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
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

                  {/* Created date */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created
                    </p>
                    <p className="text-xs text-foreground/70">
                      {formatCreatedDateTime(card.createdAt)}
                    </p>
                  </div>

                  {/* Archive / Restore */}
                  {activeUser && (
                    <div>
                      {card.isArchived ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs px-3 gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={handleRestore}
                          disabled={isArchiving || !onRestore}
                          title="Restore this card"
                          data-ocid="card.modal.secondary_button"
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
                          className="w-full h-8 text-xs px-3 gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={handleArchive}
                          disabled={isArchiving || !onArchive}
                          title="Archive this card"
                          data-ocid="card.modal.secondary_button"
                        >
                          {isArchiving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                          Archive
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Tags — full width, auto-saves on toggle ── */}
              {availableTags.length > 0 && onUpdateTags && (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => {
                      const isTagSelected = (card.tags ?? []).some(
                        (t) => t.toString() === tag.id.toString(),
                      );
                      return (
                        <button
                          key={tag.id.toString()}
                          type="button"
                          onClick={() => handleTagToggle(tag.id)}
                          disabled={isUpdatingTags}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                            isTagSelected
                              ? "opacity-100 ring-1 ring-offset-1 ring-current"
                              : "opacity-30 hover:opacity-70"
                          }`}
                          style={{
                            backgroundColor: `${tag.color}22`,
                            color: tag.color,
                            borderColor: `${tag.color}44`,
                          }}
                          title={
                            isTagSelected
                              ? `Remove tag: ${tag.name}`
                              : `Add tag: ${tag.name}`
                          }
                          data-ocid="card.toggle"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* ── Checklist ── */}
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left hover:text-foreground text-muted-foreground transition-colors group/cl"
                  onClick={() => setShowChecklist((v) => !v)}
                  data-ocid="card.toggle"
                >
                  <ListChecks className="h-4 w-4" />
                  <span className="text-sm font-semibold text-foreground">
                    Checklist
                  </span>
                  {checklistTotal > 0 && (
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                        checklistDone === checklistTotal
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-secondary text-muted-foreground"
                      }`}
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
                        .map((item, idx, sorted) => {
                          const itemIdStr = item.id.toString();
                          const isEditing = editingItemId === itemIdStr;
                          const isDragOver = dragOverItemId === itemIdStr;
                          return (
                            <div
                              key={itemIdStr}
                              draggable={!!activeUser}
                              onDragStart={() => setDraggingItemId(itemIdStr)}
                              onDragEnd={() => {
                                setDraggingItemId(null);
                                setDragOverItemId(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverItemId(itemIdStr);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (
                                  !draggingItemId ||
                                  draggingItemId === itemIdStr
                                )
                                  return;
                                const fromIdx = sorted.findIndex(
                                  (i) => i.id.toString() === draggingItemId,
                                );
                                const toIdx = idx;
                                if (fromIdx === -1 || fromIdx === toIdx) return;
                                const reordered = [...sorted];
                                const [moved] = reordered.splice(fromIdx, 1);
                                reordered.splice(toIdx, 0, moved);
                                if (activeUser) {
                                  reorderChecklistItems({
                                    cardId,
                                    newOrder: reordered.map((ci) => ci.id),
                                    actorUserId: activeUser.id,
                                  });
                                }
                                setDraggingItemId(null);
                                setDragOverItemId(null);
                              }}
                              className={`group/ci flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40 transition-colors ${
                                isDragOver ? "border-t-2 border-blue-500" : ""
                              }`}
                              data-ocid={`card.item.${idx + 1}`}
                            >
                              {activeUser && (
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab shrink-0" />
                              )}
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
                                data-ocid={`card.checkbox.${idx + 1}`}
                              />
                              {isEditing ? (
                                <Input
                                  value={editingItemText}
                                  onChange={(e) =>
                                    setEditingItemText(e.target.value)
                                  }
                                  onBlur={() => {
                                    if (
                                      editingItemText.trim() &&
                                      editingItemText !== item.text
                                    ) {
                                      updateChecklistItem({
                                        itemId: item.id,
                                        text: editingItemText.trim(),
                                        isDone: item.isDone,
                                        actorUserId: activeUser!.id,
                                        cardId,
                                      });
                                    }
                                    setEditingItemId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      if (
                                        editingItemText.trim() &&
                                        editingItemText !== item.text
                                      ) {
                                        updateChecklistItem({
                                          itemId: item.id,
                                          text: editingItemText.trim(),
                                          isDone: item.isDone,
                                          actorUserId: activeUser!.id,
                                          cardId,
                                        });
                                      }
                                      setEditingItemId(null);
                                    } else if (e.key === "Escape") {
                                      setEditingItemId(null);
                                    }
                                  }}
                                  autoFocus
                                  className="flex-1 h-6 text-xs py-0"
                                />
                              ) : (
                                <label
                                  htmlFor={`ci-${item.id}`}
                                  className={`flex-1 text-xs select-none ${
                                    item.isDone
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  } ${activeUser ? "cursor-pointer" : ""}`}
                                  onClick={(e) => {
                                    if (!activeUser) return;
                                    e.preventDefault();
                                    setEditingItemId(itemIdStr);
                                    setEditingItemText(item.text);
                                  }}
                                  onKeyDown={(e) => {
                                    if (!activeUser) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setEditingItemId(itemIdStr);
                                      setEditingItemText(item.text);
                                    }
                                  }}
                                >
                                  {item.text}
                                </label>
                              )}
                              {activeUser && (
                                <button
                                  type="button"
                                  className="opacity-0 group-hover/ci:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                  onClick={() =>
                                    handleDeleteChecklistItem(item.id)
                                  }
                                  title="Remove item"
                                  data-ocid={`card.delete_button.${idx + 1}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })
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
                          data-ocid="card.input"
                        />
                        <Button
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={handleAddChecklistItem}
                          disabled={
                            !newChecklistItem.trim() || isAddingChecklistItem
                          }
                          title="Add item"
                          data-ocid="card.button"
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

              {/* ── Comments ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    Comments
                  </span>
                  {comments.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                      {comments.length}
                    </span>
                  )}
                </div>

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
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${getInitialsColor(
                                comment.authorName,
                              )}`}
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
                                data-ocid="card.delete_button"
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
                        data-ocid="card.textarea"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || isAddingComment}
                      title="Send comment"
                      data-ocid="card.button"
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

              {/* ── Card History ── */}
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left hover:text-foreground text-muted-foreground transition-colors group/hist"
                  onClick={() => setShowHistory((v) => !v)}
                  data-ocid="card.toggle"
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
                              className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5 ${getInitialsColor(
                                rev.actorName,
                              )}`}
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
