import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Tag } from "../backend.d";
import {
  useCreateTag,
  useDeleteTag,
  useProjectTags,
  useRenameTag,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

const PRESET_COLORS = [
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#10b981", label: "Green" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#8b5cf6", label: "Purple" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#6b7280", label: "Gray" },
];

interface TagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: bigint;
  activeUser: User | null;
}

export default function TagsModal({
  open,
  onOpenChange,
  projectId,
  activeUser,
}: TagsModalProps) {
  const { data: tags = [], isLoading } = useProjectTags(projectId);
  const { mutateAsync: createTag, isPending: isCreating } = useCreateTag();
  const { mutateAsync: renameTag, isPending: isRenaming } = useRenameTag();
  const { mutateAsync: deleteTag, isPending: isDeleting } = useDeleteTag();

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0].hex);
  const [renamingId, setRenamingId] = useState<bigint | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<bigint | null>(null);

  async function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed || !activeUser) return;
    try {
      await createTag({
        projectId,
        name: trimmed,
        color: newTagColor,
        actorUserId: activeUser.id,
      });
      setNewTagName("");
      toast.success(`Tag "${trimmed}" created`);
    } catch {
      toast.error("Failed to create tag");
    }
  }

  async function handleRenameTag(tag: Tag) {
    const trimmed = renameValue.trim();
    if (!trimmed || !activeUser) {
      setRenamingId(null);
      return;
    }
    if (trimmed === tag.name) {
      setRenamingId(null);
      return;
    }
    try {
      await renameTag({
        tagId: tag.id,
        newName: trimmed,
        actorUserId: activeUser.id,
        projectId,
      });
      toast.success("Tag renamed");
    } catch {
      toast.error("Failed to rename tag");
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDeleteTag(tag: Tag) {
    if (!activeUser) return;
    try {
      await deleteTag({
        tagId: tag.id,
        actorUserId: activeUser.id,
        projectId,
      });
      toast.success(`Tag "${tag.name}" deleted`);
      setDeletingId(null);
    } catch {
      toast.error("Failed to delete tag");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-primary" />
            Manage Tags
          </DialogTitle>
        </DialogHeader>

        {/* Tag list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded shimmer" />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No tags yet. Create one below.
            </div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id.toString()}
                className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card"
              >
                {/* Color swatch */}
                <div
                  className="h-4 w-4 rounded-full shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: tag.color }}
                />

                {/* Name or rename input */}
                {renamingId === tag.id ? (
                  <Input
                    className="h-7 text-sm flex-1 px-2"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameTag(tag);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => handleRenameTag(tag)}
                    autoFocus
                    disabled={isRenaming}
                  />
                ) : (
                  <span className="flex-1 text-sm text-foreground truncate">
                    {tag.name}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {deletingId === tag.id ? (
                    <>
                      <span className="text-xs text-destructive">Delete?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 text-xs px-2"
                        onClick={() => handleDeleteTag(tag)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Yes"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={() => setDeletingId(null)}
                        disabled={isDeleting}
                      >
                        No
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        onClick={() => {
                          setRenamingId(tag.id);
                          setRenameValue(tag.name);
                        }}
                        title="Rename tag"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => setDeletingId(tag.id)}
                        title="Delete tag"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create new tag */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Add New Tag
          </p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTag();
              }}
              className="h-8 text-sm flex-1"
              disabled={isCreating}
            />
            <Button
              size="sm"
              className="h-8 text-xs px-3 gap-1.5 shrink-0"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || !activeUser || isCreating}
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3 w-3" />
                  Add
                </>
              )}
            </Button>
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Color</p>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`h-6 w-6 rounded-full ring-2 transition-all ${
                    newTagColor === c.hex
                      ? "ring-foreground ring-offset-1"
                      : "ring-transparent hover:ring-muted-foreground/50"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setNewTagColor(c.hex)}
                  title={c.label}
                  aria-label={`Select ${c.label}`}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
