import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { useState } from "react";
import type { Card } from "../backend.d";
import type { User } from "../hooks/useQueries";

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
  users?: User[];
  activeUser?: User | null;
  isMoving?: boolean;
  isDeleting?: boolean;
  /** When true the card is the drag overlay ghost — no drag listeners attached */
  isOverlay?: boolean;
  /** When true, disable card drag (e.g. while a column is being dragged) */
  disableDrag?: boolean;
}

export default function KanbanCard({
  card,
  accentClass,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onUpdate,
  onAssign,
  users = [],
  activeUser: _activeUser = null,
  isMoving = false,
  isDeleting = false,
  isOverlay = false,
  disableDrag = false,
}: KanbanCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description ?? "");
  const [isAssigning, setIsAssigning] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id.toString(),
    disabled: isOverlay || editing || disableDrag,
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  function startEdit() {
    setEditTitle(card.title);
    setEditDesc(card.description ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function saveEdit() {
    const trimTitle = editTitle.trim();
    if (!trimTitle) return;
    onUpdate(trimTitle, editDesc.trim() || null);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancelEdit();
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

  // Find the assigned user name
  const assignedUser =
    card.assignedUserId != null
      ? users.find((u) => u.id === card.assignedUserId)
      : null;

  // Generate color from name hash for initials
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

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`kanban-card rounded-lg bg-card border-l-4 ${accentClass} p-3 shadow-card`}
      >
        <Input
          className="mb-2 text-sm font-medium"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Card title"
        />
        <Textarea
          className="mb-2 text-sm resize-none"
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a description… (optional)"
          rows={2}
        />
        {/* Assign to section */}
        {users.length > 0 && onAssign && (
          <div className="mb-2 space-y-1">
            <label
              htmlFor={`assign-card-${card.id.toString()}`}
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Assign to
            </label>
            <select
              id={`assign-card-${card.id.toString()}`}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
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
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            onClick={saveEdit}
            disabled={!editTitle.trim()}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-3"
            onClick={cancelEdit}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card group relative rounded-lg bg-card border-l-4 ${accentClass} p-3 shadow-card ${
        isMoving || isDeleting ? "opacity-60 pointer-events-none" : ""
      } ${isDragging && !isOverlay ? "opacity-40 scale-95" : ""} ${
        isOverlay ? "shadow-card-hover rotate-1 scale-105 cursor-grabbing" : ""
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors touch-none"
        title="Drag card"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Card content — click to edit */}
      <button
        type="button"
        className="w-full text-left focus:outline-none pl-4"
        onClick={startEdit}
        aria-label={`Edit card: ${card.title}`}
      >
        <p className="text-sm font-medium text-card-foreground leading-snug pr-6">
          {card.title}
        </p>
        {card.description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
            {card.description}
          </p>
        )}
      </button>

      {/* Assignee chip — shown when assigned */}
      {assignedUser && (
        <div className="mt-2 pl-4 flex items-center gap-1.5">
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

      {/* Unassigned indicator when no user but there are users available */}
      {!assignedUser && users.length > 0 && !isOverlay && (
        <div className="mt-2 pl-4 flex items-center gap-1 opacity-0 group-hover:opacity-60 transition-opacity">
          <UserCircle2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Unassigned</span>
        </div>
      )}

      {/* Action buttons — revealed on hover */}
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
          onClick={onDelete}
          title="Delete card"
          aria-label="Delete card"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          onClick={startEdit}
          title="Edit card"
          aria-label="Edit card"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
