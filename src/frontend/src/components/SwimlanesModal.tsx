import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  GripVertical,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Swimlane } from "../backend.d";
import {
  useCreateSwimlane,
  useDeleteSwimlane,
  useDisableSwimlanes,
  useEnableSwimlanes,
  useRenameSwimlane,
  useReorderSwimlanes,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

interface SwimlanesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: bigint;
  swimlanesEnabled: boolean;
  swimlanes: Swimlane[];
  activeUser: User | null;
}

export default function SwimlanesModal({
  open,
  onOpenChange,
  projectId,
  swimlanesEnabled,
  swimlanes,
  activeUser,
}: SwimlanesModalProps) {
  const [newLaneName, setNewLaneName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editingName, setEditingName] = useState("");
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<Swimlane[] | null>(null);

  const { mutateAsync: createSwimlane } = useCreateSwimlane();
  const { mutateAsync: renameSwimlane } = useRenameSwimlane();
  const { mutateAsync: deleteSwimlane } = useDeleteSwimlane();
  const { mutateAsync: reorderSwimlanes } = useReorderSwimlanes();
  const { mutateAsync: enableSwimlanes } = useEnableSwimlanes();
  const { mutateAsync: disableSwimlanes } = useDisableSwimlanes();

  const displaySwimlanes =
    localOrder ?? [...swimlanes].sort((a, b) => Number(a.order - b.order));

  async function handleToggleEnabled() {
    if (!activeUser) {
      toast.error("Set yourself as active first");
      return;
    }
    setTogglingEnabled(true);
    try {
      if (swimlanesEnabled) {
        await disableSwimlanes({ projectId, actorUserId: activeUser.id });
        toast.success("Swimlanes disabled");
      } else {
        await enableSwimlanes({ projectId, actorUserId: activeUser.id });
        toast.success("Swimlanes enabled");
      }
    } catch {
      toast.error("Failed to update swimlanes setting");
    } finally {
      setTogglingEnabled(false);
    }
  }

  async function handleCreate() {
    const trimmed = newLaneName.trim();
    if (!trimmed || !activeUser) return;
    setIsCreating(true);
    try {
      await createSwimlane({
        projectId,
        name: trimmed,
        actorUserId: activeUser.id,
      });
      setNewLaneName("");
      toast.success(`Swimlane "${trimmed}" created`);
    } catch {
      toast.error("Failed to create swimlane");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRename(swimlane: Swimlane) {
    const trimmed = editingName.trim();
    if (!trimmed || !activeUser || trimmed === swimlane.name) {
      setEditingId(null);
      return;
    }
    try {
      await renameSwimlane({
        swimlaneId: swimlane.id,
        newName: trimmed,
        actorUserId: activeUser.id,
        projectId,
      });
      setEditingId(null);
      toast.success("Swimlane renamed");
    } catch {
      toast.error("Failed to rename swimlane");
    }
  }

  async function handleDelete(swimlane: Swimlane) {
    if (!activeUser) return;
    try {
      await deleteSwimlane({
        swimlaneId: swimlane.id,
        actorUserId: activeUser.id,
        projectId,
      });
      toast.success(`Swimlane "${swimlane.name}" deleted`);
    } catch {
      toast.error("Failed to delete swimlane");
    }
  }

  // ── Drag reorder ─────────────────────────────────────────────────────────────
  function handleDragStart(idx: number) {
    setDraggingIdx(idx);
    setLocalOrder([...displaySwimlanes]);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
    if (draggingIdx === null || draggingIdx === idx) return;
    setLocalOrder((prev) => {
      if (!prev) return prev;
      const arr = [...prev];
      const [item] = arr.splice(draggingIdx, 1);
      arr.splice(idx, 0, item);
      setDraggingIdx(idx);
      return arr;
    });
  }

  async function handleDragEnd() {
    const fromIdx = draggingIdx;
    setDraggingIdx(null);
    setDragOverIdx(null);
    if (!localOrder || !activeUser) {
      setLocalOrder(null);
      return;
    }
    // Check if order changed
    const origOrder = [...swimlanes].sort((a, b) => Number(a.order - b.order));
    const changed = localOrder.some((s, i) => s.id !== origOrder[i]?.id);
    if (!changed) {
      setLocalOrder(null);
      return;
    }
    void fromIdx;
    try {
      await reorderSwimlanes({
        newOrder: localOrder.map((s) => s.id),
        actorUserId: activeUser.id,
        projectId,
      });
    } catch {
      toast.error("Failed to reorder swimlanes");
    } finally {
      setLocalOrder(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-display flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Swimlanes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Enable Swimlanes
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Group cards into horizontal bands within each column
              </p>
            </div>
            {togglingEnabled ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={swimlanesEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={!activeUser}
              />
            )}
          </div>

          {/* Swimlane list */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Lanes ({displaySwimlanes.length})
            </p>

            {displaySwimlanes.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-lg">
                No swimlanes yet. Add one below.
              </div>
            ) : (
              <div className="space-y-1">
                {displaySwimlanes.map((lane, idx) => (
                  <div
                    key={lane.id.toString()}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 bg-card transition-all ${
                      draggingIdx === idx ? "opacity-50 scale-95" : ""
                    } ${dragOverIdx === idx && draggingIdx !== idx ? "border-primary/40 bg-primary/5" : "border-border"}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />

                    {editingId === lane.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          className="h-7 text-sm px-2 py-0"
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(lane);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                          onClick={() => handleRename(lane)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-foreground truncate">
                          {lane.name}
                        </span>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                          onClick={() => {
                            setEditingId(lane.id);
                            setEditingName(lane.name);
                          }}
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          onClick={() => handleDelete(lane)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add lane input */}
            <div className="flex gap-2 pt-1">
              <Input
                value={newLaneName}
                onChange={(e) => setNewLaneName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="New lane name…"
                className="h-8 text-sm"
                disabled={isCreating}
              />
              <Button
                size="sm"
                className="h-8 shrink-0 gap-1 px-3"
                onClick={handleCreate}
                disabled={!newLaneName.trim() || !activeUser || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>

          {!activeUser && (
            <p className="text-xs text-muted-foreground text-center">
              Set yourself as active to manage swimlanes.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
