import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Check,
  ChevronDown,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Project } from "../backend.d";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useRenameProject,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

interface ProjectSwitcherProps {
  activeProjectId: bigint | null;
  onSelectProject: (projectId: bigint) => void;
  activeUser: User | null;
}

export default function ProjectSwitcher({
  activeProjectId,
  onSelectProject,
  activeUser,
}: ProjectSwitcherProps) {
  const { data: projects = [], isLoading } = useProjects();
  const { mutateAsync: createProject, isPending: isCreating } =
    useCreateProject();
  const { mutateAsync: renameProject, isPending: isRenaming } =
    useRenameProject();
  const { mutateAsync: deleteProject, isPending: isDeleting } =
    useDeleteProject();

  const [open, setOpen] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renamingId, setRenamingId] = useState<bigint | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const newInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (showNewInput) {
      setTimeout(() => newInputRef.current?.focus(), 50);
    }
  }, [showNewInput]);

  useEffect(() => {
    if (renamingId !== null) {
      setTimeout(() => renameInputRef.current?.select(), 50);
    }
  }, [renamingId]);

  async function handleCreateProject() {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    try {
      const newId = await createProject({
        name: trimmed,
        actorUserId: activeUser?.id ?? 0n,
      });
      toast.success(`Project "${trimmed}" created`);
      setNewProjectName("");
      setShowNewInput(false);
      onSelectProject(newId);
    } catch {
      toast.error("Failed to create project");
    }
  }

  async function handleRenameProject(projectId: bigint) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    const original = projects.find((p) => p.id === projectId);
    if (trimmed === original?.name) {
      setRenamingId(null);
      return;
    }
    try {
      await renameProject({
        projectId,
        newName: trimmed,
        actorUserId: activeUser?.id ?? 0n,
      });
      toast.success("Project renamed");
    } catch {
      toast.error("Failed to rename project");
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDeleteProject() {
    if (!deleteTarget) return;
    try {
      await deleteProject({
        projectId: deleteTarget.id,
        actorUserId: activeUser?.id ?? 0n,
      });
      toast.success(`Project "${deleteTarget.name}" deleted`);
      // If we deleted the active project, switch to first remaining
      if (activeProjectId === deleteTarget.id) {
        const remaining = projects.filter((p) => p.id !== deleteTarget.id);
        if (remaining.length > 0) {
          onSelectProject(remaining[0].id);
        }
      }
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/60 transition-colors text-sm font-medium text-foreground max-w-[180px] min-w-[120px]"
          >
            <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate flex-1 text-left">
              {isLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : (
                (activeProject?.name ?? "No project")
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-64 p-1"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Project list */}
          <div className="max-h-64 overflow-y-auto">
            {projects.length === 0 && !isLoading && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No projects yet
              </div>
            )}
            {projects.map((project) => (
              <div
                key={project.id.toString()}
                className="group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors"
              >
                {renamingId === project.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRenameProject(project.id);
                        }
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => handleRenameProject(project.id)}
                      className="h-7 text-sm px-2 py-0 flex-1"
                      disabled={isRenaming}
                    />
                  </div>
                ) : (
                  <>
                    {/* Project name button */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(project.id);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      {activeProjectId === project.id ? (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span
                        className={`text-sm truncate ${
                          activeProjectId === project.id
                            ? "font-semibold text-foreground"
                            : "text-foreground/80"
                        }`}
                      >
                        {project.name}
                      </span>
                    </button>

                    {/* Action buttons — visible on hover, only when active user set */}
                    {activeUser && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(project.id);
                            setRenameValue(project.name);
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title="Rename project"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(project);
                            setOpen(false);
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete project"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Separator + New project */}
          {activeUser && (
            <>
              <div className="h-px bg-border my-1" />
              {showNewInput ? (
                <div className="px-2 py-1.5 space-y-2">
                  <Input
                    ref={newInputRef}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateProject();
                      }
                      if (e.key === "Escape") {
                        setShowNewInput(false);
                        setNewProjectName("");
                      }
                    }}
                    placeholder="Project name"
                    className="h-7 text-sm px-2"
                    disabled={isCreating}
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 flex-1"
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim() || isCreating}
                    >
                      {isCreating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-3"
                      onClick={() => {
                        setShowNewInput(false);
                        setNewProjectName("");
                      }}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewInput(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New project
                </button>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete project "{deleteTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all columns and cards in this
              project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
