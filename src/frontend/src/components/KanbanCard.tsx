import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { memo, useState } from "react";
import type { Card, Tag } from "../backend.d";
import type { User } from "../hooks/useQueries";

// ── Date helpers ───────────────────────────────────────────────────────────────

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

function isOverdue(dueDate: bigint): boolean {
  return Number(dueDate) / 1_000_000 < Date.now();
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

// ── KanbanCard ────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  card: Card;
  accentClass: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  /** Called when the card face is clicked — lifts modal to App level */
  onOpenModal: (cardId: bigint) => void;
  onArchive?: (cardId: bigint) => Promise<void>;
  users?: User[];
  activeUser?: User | null;
  availableTags?: Tag[];
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
  onOpenModal,
  onArchive,
  users = [],
  activeUser = null,
  availableTags = [],
  isMoving = false,
  isDeleting = false,
  isOverlay = false,
  disableDrag = false,
  isSelected = false,
  isSelectionMode = false,
  onToggleSelect,
}: KanbanCardProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id.toString(),
    disabled: isOverlay || disableDrag,
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

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
        className={`kanban-card group relative rounded-lg bg-card border-2 border-black/60 dark:border-white/20 border-l-4 ${accentClass} p-3 shadow-card ${
          isMoving || isDeleting ? "opacity-60 pointer-events-none" : ""
        } ${isDragging && !isOverlay ? "opacity-40 scale-95" : ""} ${
          isOverlay
            ? "shadow-card-hover rotate-1 scale-105 cursor-grabbing"
            : "cursor-pointer"
        } ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
        onClick={(e) => {
          if (isOverlay) return;
          if (isSelectionMode) {
            onToggleSelect?.(e);
          } else {
            onOpenModal(card.id);
          }
        }}
        onKeyDown={(e) => {
          if (isOverlay) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isSelectionMode) {
              onToggleSelect?.(e as unknown as React.MouseEvent);
            } else {
              onOpenModal(card.id);
            }
          }
        }}
        // biome-ignore lint/a11y/useSemanticElements: DnD sortable requires a div; keyboard nav handled via onKeyDown
        role="button"
        tabIndex={isOverlay ? -1 : 0}
        aria-label={`Open card: ${card.title}`}
      >
        {/* Multi-select checkbox */}
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
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onToggleSelect?.(e as unknown as React.MouseEvent);
              }
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
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Card content */}
        <div className={`${isSelectionMode ? "pl-6" : "pl-4"} pr-20`}>
          <p className="text-sm font-medium text-card-foreground leading-snug">
            {card.title}
          </p>
          {card.description && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
              {card.description}
            </p>
          )}
        </div>

        {/* Tag chips */}
        {resolvedTags.length > 0 && (
          <div
            className={`mt-2 flex flex-wrap gap-1 ${
              isSelectionMode ? "pl-6" : "pl-4"
            }`}
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
            className={`mt-1.5 flex items-center gap-1 ${
              isSelectionMode ? "pl-6" : "pl-4"
            }`}
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

        {/* Created date chip */}
        {!isOverlay && (
          <div
            className={`mt-1.5 flex items-center gap-1 ${
              isSelectionMode ? "pl-6" : "pl-4"
            }`}
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
            className={`mt-1.5 flex items-center gap-1 ${
              isSelectionMode ? "pl-6" : "pl-4"
            }`}
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
            className={`mt-2 flex items-center gap-1.5 ${
              isSelectionMode ? "pl-6" : "pl-4"
            }`}
          >
            <div
              className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${getInitialsColor(
                assignedUser.name,
              )}`}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveLeft();
                }}
                title="Move left"
                aria-label="Move card left"
                data-ocid="card.button"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {canMoveRight && (
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveRight();
                }}
                title="Move right"
                aria-label="Move card right"
                data-ocid="card.button"
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
              data-ocid="card.delete_button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal(card.id);
              }}
              title="Edit card"
              aria-label="Edit card"
              data-ocid="card.edit_button"
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
                data-ocid="card.secondary_button"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive instead (recommended)
              </Button>
            )}
            {/* Delete permanently */}
            <Button
              variant="destructive"
              className="w-full gap-1.5"
              onClick={() => {
                setDeleteConfirmOpen(false);
                onDelete();
              }}
              type="button"
              data-ocid="card.delete_button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete permanently
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setDeleteConfirmOpen(false)}
              type="button"
              data-ocid="card.cancel_button"
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const KanbanCard = memo(KanbanCardInner);
export default KanbanCard;
