import type { backendInterface } from "@/backend.d";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useDeleteSnapshot, useSnapshots } from "@/hooks/useQueries";
import type { User } from "@/hooks/useQueries";
import {
  buildSnapshotJson,
  restoreFromSnapshotJson,
} from "@/utils/exportImport";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SnapshotsPanelProps {
  activeUser: User | null;
  actor: backendInterface | null;
  activeProjectId?: bigint | null;
  onRestored?: () => void;
}

function formatSnapshotDate(takenAt: bigint): string {
  const ms = Number(takenAt) / 1_000_000;
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Parse [pid:X] prefix from snapshot labels
function parsePid(label: string): { pid: string | null; display: string } {
  const m = label.match(/^\[pid:(\d+)\]\s*/);
  if (m) {
    return { pid: m[1], display: label.slice(m[0].length) };
  }
  return { pid: null, display: label };
}

export default function SnapshotsPanel({
  activeUser,
  actor,
  activeProjectId,
  onRestored,
}: SnapshotsPanelProps) {
  const queryClient = useQueryClient();
  const [showTakeForm, setShowTakeForm] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<{
    id: bigint;
    label: string;
    date: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: bigint;
    label: string;
  } | null>(null);
  const [downloadingId, setDownloadingId] = useState<bigint | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<number | null>(null);
  const [restoreDone, setRestoreDone] = useState<{
    columns: number;
    cards: number;
  } | null>(null);

  const { data: snapshots = [], isLoading: snapshotsLoading } = useSnapshots();

  const [isTaking, setIsTaking] = useState(false);
  const { mutateAsync: deleteSnapshot, isPending: isDeleting } =
    useDeleteSnapshot();

  const isMasterAdmin = activeUser?.isMasterAdmin === true;
  const isAdmin =
    activeUser?.isAdmin === true || activeUser?.isMasterAdmin === true;

  if (!isAdmin) return null;

  async function handleTakeSnapshot() {
    if (!actor || !activeUser || !activeProjectId) {
      toast.error("No active project or user");
      return;
    }
    const label =
      snapshotLabel.trim() ||
      `Manual snapshot · ${new Date().toLocaleString()}`;
    setSnapshotLabel("");
    setShowTakeForm(false);
    setIsTaking(true);
    try {
      const jsonStr = await buildSnapshotJson(actor, activeProjectId, label);
      const labelWithPid = `[pid:${activeProjectId}] ${label}`;
      await actor.storeSnapshot(labelWithPid, jsonStr, activeUser.id);
      await queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      toast.success("Snapshot saved");
    } catch (e) {
      toast.error(`Snapshot failed: ${String(e)}`);
    } finally {
      setIsTaking(false);
    }
  }

  async function handleDownloadSnapshot(snapshotId: bigint, label: string) {
    if (!actor) return;
    setDownloadingId(snapshotId);
    try {
      const json = await actor.getSnapshot(snapshotId);
      if (!json) {
        toast.error("Snapshot data not found");
        return;
      }
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = label.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `snapshot-${safe}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Snapshot downloaded");
    } catch (e) {
      toast.error(`Download failed: ${String(e)}`);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleConfirmRestore() {
    if (!restoreTarget || !actor || !activeUser) return;

    const targetProjectId = activeProjectId ?? null;
    if (!targetProjectId) {
      toast.error(
        "No active project selected. Go to the Board tab and select a project first.",
      );
      return;
    }

    // Keep dialog open, show progress inside it
    const capturedLabel = restoreTarget.label;
    const capturedId = restoreTarget.id;
    setIsRestoring(true);
    setRestoreProgress(5);
    setRestoreDone(null);

    try {
      // Step 1: Fetch snapshot JSON
      const json = await actor.getSnapshot(capturedId);
      if (!json) {
        toast.error("Snapshot data not found on server.");
        return;
      }

      // Step 2: Pre-validate — parse and check column count BEFORE deleting anything
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        toast.error("Snapshot JSON is corrupted — cannot restore.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshotProject = (parsed as any)?.project;
      const snapshotColumns: unknown[] = Array.isArray(snapshotProject?.columns)
        ? snapshotProject.columns
        : [];

      if (snapshotColumns.length === 0) {
        toast.error(
          "This snapshot contains 0 columns — restore aborted to protect your current board. The snapshot may have been taken while the board was empty.",
          { duration: 8000 },
        );
        return;
      }

      setRestoreProgress(15);

      // Step 3: Run the restore through the proven import pipeline
      const result = await restoreFromSnapshotJson(
        actor,
        json,
        targetProjectId,
        activeUser.id,
        (pct) => setRestoreProgress(15 + Math.floor(pct * 0.8)), // 15–95%
      );

      setRestoreProgress(95);

      // Step 4: Force-refetch ALL queries (including inactive Board tab queries)
      await queryClient.refetchQueries({ type: "all" });

      setRestoreProgress(100);

      if (result.errors.length > 0) {
        toast.error(
          `Restore had ${result.errors.length} error(s): ${result.errors[0]}`,
          { duration: 8000 },
        );
        // Still close dialog and show what was restored
      }

      // Set restoreDone BEFORE clearing isRestoring so the green state renders first
      setRestoreDone({
        columns: result.counts.columnsRestored,
        cards: result.counts.cardsRestored,
      });
      setIsRestoring(false);
      // Keep restoreProgress at 100 so the bar stays full while green state is shown

      // Auto-navigate to board so user sees the restored data
      if (result.counts.columnsRestored > 0) {
        onRestored?.();
        toast.success(
          `"${capturedLabel}" restored — ${result.counts.columnsRestored} columns, ${result.counts.cardsRestored} cards.`,
          { duration: 6000 },
        );
      } else if (result.errors.length === 0) {
        toast.warning(
          "Restore completed but 0 columns were imported. The snapshot may have been empty.",
          { duration: 8000 },
        );
      }

      // Auto-close the dialog after 3s so user can read the green confirmation
      setTimeout(() => {
        setRestoreTarget(null);
        setRestoreDone(null);
        setRestoreProgress(null);
      }, 3000);
    } catch (e) {
      toast.error(`Restore failed: ${String(e)}`);
      // On error, clean up immediately
      setIsRestoring(false);
      setRestoreProgress(null);
    } finally {
      // Note: on success path, setIsRestoring is called above in the try block
      // so this only affects the error path. restoreProgress is kept visible
      // until the dialog auto-closes after showing the green confirmation.
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || !activeUser) return;
    try {
      await deleteSnapshot({
        snapshotId: deleteTarget.id,
        actorUserId: activeUser.id,
      });
      toast.success("Snapshot deleted");
    } catch (e) {
      toast.error(`Delete failed: ${String(e)}`);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6" data-ocid="snapshots.panel">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-semibold text-foreground">
            Snapshots
          </h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {activeProjectId
              ? snapshots.filter((s) => {
                  const { pid } = parsePid(s.snapshotLabel || "");
                  return !pid || pid === String(activeProjectId);
                }).length
              : snapshots.length}{" "}
            / 30 max
          </span>
        </div>
        {isAdmin && !showTakeForm && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowTakeForm(true)}
            data-ocid="snapshots.open_modal_button"
          >
            <Plus className="h-3.5 w-3.5" />
            Take Snapshot
          </Button>
        )}
      </div>

      {/* ── Take Snapshot Form ── */}
      {showTakeForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-medium text-foreground">New Snapshot</p>
          <div className="flex gap-2">
            <Input
              placeholder="Label (optional — defaults to 'Manual snapshot')"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTakeSnapshot();
                if (e.key === "Escape") setShowTakeForm(false);
              }}
              className="text-sm h-8 flex-1"
              autoFocus
              data-ocid="snapshots.input"
            />
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleTakeSnapshot}
              disabled={isTaking}
              data-ocid="snapshots.submit_button"
            >
              {isTaking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isTaking ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setShowTakeForm(false);
                setSnapshotLabel("");
              }}
              disabled={isTaking}
              data-ocid="snapshots.cancel_button"
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A snapshot captures the full state of all projects, columns, cards,
            users and tags. Stored on-chain — max 30 snapshots retained (oldest
            removed automatically).
          </p>
        </div>
      )}

      {/* ── Snapshot List ── */}
      {snapshotsLoading ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground py-6"
          data-ocid="snapshots.loading_state"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading snapshots…
        </div>
      ) : snapshots.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-10 text-center"
          data-ocid="snapshots.empty_state"
        >
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
            <Database className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              No snapshots yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Take a snapshot to create a restore point for your board data.
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-2">
            {[...snapshots]
              .sort((a, b) => Number(b.takenAt - a.takenAt))
              .filter((snap) => {
                const { pid } = parsePid(snap.snapshotLabel || "");
                if (!pid) return true; // legacy snapshots without prefix: show for all projects
                return activeProjectId ? pid === String(activeProjectId) : true;
              })
              .map((snap, idx) => {
                const { display: displayLabel } = parsePid(
                  snap.snapshotLabel || "",
                );
                const dateStr = formatSnapshotDate(snap.takenAt);
                const isDownloading = downloadingId === snap.id;
                return (
                  <div
                    key={snap.id.toString()}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-secondary/30 transition-colors"
                    data-ocid={`snapshots.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {displayLabel || "Manual snapshot"}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          {snap.takenByName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Download */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          handleDownloadSnapshot(
                            snap.id,
                            displayLabel || snap.snapshotLabel,
                          )
                        }
                        disabled={isDownloading}
                        title="Download snapshot as JSON"
                        data-ocid={`snapshots.download_button.${idx + 1}`}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {/* Restore (master admin or snapshot-access admin) */}
                      {isMasterAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 gap-1.5"
                          onClick={() =>
                            setRestoreTarget({
                              id: snap.id,
                              label: displayLabel || "Manual snapshot",
                              date: dateStr,
                            })
                          }
                          disabled={isRestoring}
                          title="Restore from this snapshot"
                          data-ocid={`snapshots.restore_button.${idx + 1}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                      )}

                      {/* Delete (master admin or snapshot-access admin) */}
                      {isMasterAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDeleteTarget({
                              id: snap.id,
                              label: displayLabel || "Manual snapshot",
                            })
                          }
                          title="Delete snapshot"
                          data-ocid={`snapshots.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </ScrollArea>
      )}

      {/* ── Restore Confirmation Dialog ── */}
      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setRestoreTarget(null);
            setRestoreDone(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-ocid="snapshots.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              {restoreDone ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              {restoreDone ? "Restore Complete" : "Restore Snapshot"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {restoreDone ? (
                <>
                  Restored{" "}
                  <span className="font-semibold text-foreground">
                    {restoreDone.columns} columns
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-foreground">
                    {restoreDone.cards} cards
                  </span>
                  . Switching to Board tab…
                </>
              ) : (
                <>
                  Restore{" "}
                  <span className="font-semibold text-foreground">
                    &quot;{restoreTarget?.label}&quot;
                  </span>{" "}
                  taken on{" "}
                  <span className="font-semibold text-foreground">
                    {restoreTarget?.date}
                  </span>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {!restoreDone && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                This will replace all current board data
              </p>
              <p className="text-xs leading-relaxed">
                All columns, cards, tags, and comments in the active project
                will be wiped and replaced with this snapshot&apos;s data. Make
                sure you&apos;ve taken a snapshot of the current state first if
                you want to preserve it.
              </p>
            </div>
          )}

          {isRestoring && restoreProgress !== null && (
            <div className="px-1 pb-2 space-y-2">
              <Progress value={restoreProgress} className="h-2.5 w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {restoreProgress < 15
                  ? "Fetching snapshot data…"
                  : restoreProgress < 90
                    ? `Restoring board data… ${restoreProgress}%`
                    : restoreProgress < 100
                      ? "Refreshing board…"
                      : "Done!"}
              </p>
            </div>
          )}

          {restoreDone && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Board restored successfully. Navigating to Board tab now.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRestoreTarget(null);
                setRestoreDone(null);
              }}
              disabled={isRestoring}
              data-ocid="snapshots.cancel_button"
            >
              {restoreDone ? "Close" : "Cancel"}
            </Button>
            {!restoreDone && (
              <Button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="gap-1.5"
                data-ocid="snapshots.confirm_button"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {restoreProgress !== null
                      ? `Restoring… ${restoreProgress}%`
                      : "Restoring…"}
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore Now
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm" data-ocid="snapshots.delete_dialog">
          <DialogHeader>
            <DialogTitle className="text-base font-display">
              Delete Snapshot?
            </DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteTarget?.label}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              data-ocid="snapshots.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="gap-1.5"
              data-ocid="snapshots.confirm_button"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
