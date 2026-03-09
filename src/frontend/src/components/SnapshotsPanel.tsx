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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteSnapshot,
  useGrantSnapshotAccess,
  useRevokeSnapshotAccess,
  useSnapshots,
  useTakeSnapshot,
  useUsers,
} from "@/hooks/useQueries";
import type { User } from "@/hooks/useQueries";
import { restoreFromSnapshot } from "@/utils/exportImport";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
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

export default function SnapshotsPanel({
  activeUser,
  actor,
  activeProjectId,
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

  const { data: snapshots = [], isLoading: snapshotsLoading } = useSnapshots();
  const { data: users = [] } = useUsers();

  const { mutateAsync: takeSnapshot, isPending: isTaking } = useTakeSnapshot();
  const { mutateAsync: deleteSnapshot, isPending: isDeleting } =
    useDeleteSnapshot();
  const { mutateAsync: grantAccess } = useGrantSnapshotAccess();
  const { mutateAsync: revokeAccess } = useRevokeSnapshotAccess();

  const isMasterAdmin = activeUser?.isMasterAdmin === true;
  const isAdmin =
    activeUser?.isAdmin === true || activeUser?.isMasterAdmin === true;

  if (!isAdmin) return null;

  async function handleTakeSnapshot() {
    if (!activeUser) {
      toast.error("No active user");
      return;
    }
    const label = snapshotLabel.trim() || "Manual snapshot";
    try {
      await takeSnapshot({ snapshotLabel: label, actorUserId: activeUser.id });
      toast.success(`Snapshot "${label}" saved`);
      setSnapshotLabel("");
      setShowTakeForm(false);
    } catch (e) {
      toast.error(`Failed to take snapshot: ${String(e)}`);
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

    setIsRestoring(true);
    setRestoreTarget(null);

    try {
      const json = await actor.getSnapshot(restoreTarget.id);
      if (!json) {
        toast.error("Snapshot data not found");
        return;
      }

      // Use the dedicated snapshot restore function (handles the raw backend format)
      const result = await restoreFromSnapshot(
        actor,
        json,
        targetProjectId,
        activeUser.id,
      );

      // Invalidate all queries so board refreshes immediately
      await queryClient.invalidateQueries();

      if (result.success) {
        toast.success(
          `Snapshot "${restoreTarget.label}" restored — ${result.counts.columnsRestored} columns, ${result.counts.cardsRestored} cards.`,
          { duration: 5000 },
        );
      } else if (result.errors.length > 0) {
        toast.error(
          `Restore completed with ${result.errors.length} error(s): ${result.errors[0]}`,
          { duration: 8000 },
        );
      } else {
        toast.success(
          `Snapshot "${restoreTarget.label}" restored. Check board for results.`,
        );
      }
    } catch (e) {
      toast.error(`Restore failed: ${String(e)}`);
    } finally {
      setIsRestoring(false);
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

  // Admin users eligible for snapshot access toggle (non-master admins)
  const adminUsers = users.filter(
    (u) => (u.isAdmin || u.isMasterAdmin) && !u.isMasterAdmin,
  );

  async function handleToggleAccess(user: User, currentlyGranted: boolean) {
    if (!activeUser || !isMasterAdmin) return;
    try {
      if (currentlyGranted) {
        await revokeAccess({ userId: user.id, actorUserId: activeUser.id });
        toast.success(`Snapshot access revoked for ${user.name}`);
      } else {
        await grantAccess({ userId: user.id, actorUserId: activeUser.id });
        toast.success(`Snapshot access granted to ${user.name}`);
      }
    } catch (e) {
      toast.error(`Failed to update access: ${String(e)}`);
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
            {snapshots.length} / 30 max
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
            users, tags, and swimlanes. Stored on-chain — max 30 snapshots
            retained (oldest removed automatically).
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
              .map((snap, idx) => {
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
                        {snap.snapshotLabel || "Manual snapshot"}
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
                          handleDownloadSnapshot(snap.id, snap.snapshotLabel)
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

                      {/* Restore (master admin only) */}
                      {isMasterAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 gap-1.5"
                          onClick={() =>
                            setRestoreTarget({
                              id: snap.id,
                              label: snap.snapshotLabel || "Manual snapshot",
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

                      {/* Delete (master admin only) */}
                      {isMasterAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDeleteTarget({
                              id: snap.id,
                              label: snap.snapshotLabel || "Manual snapshot",
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

      {/* ── Snapshot Access Management (master admin only) ── */}
      {isMasterAdmin && adminUsers.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">
                Snapshot Access
              </p>
              <span className="text-xs text-muted-foreground">
                — grant admins the ability to take snapshots
              </span>
            </div>
            <div className="space-y-2">
              {adminUsers.map((u, idx) => (
                <div
                  key={u.id.toString()}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5"
                  data-ocid={`snapshots.access.row.${idx + 1}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {u.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm text-foreground">{u.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`snapshot-access-${u.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Can take snapshots
                    </Label>
                    <Switch
                      id={`snapshot-access-${u.id}`}
                      checked={false}
                      onCheckedChange={(checked) =>
                        handleToggleAccess(u, !checked)
                      }
                      data-ocid={`snapshots.access.switch.${idx + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Restore Confirmation Dialog ── */}
      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) setRestoreTarget(null);
        }}
      >
        <DialogContent className="max-w-md" data-ocid="snapshots.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Restore Snapshot
            </DialogTitle>
            <DialogDescription className="text-sm">
              Restore{" "}
              <span className="font-semibold text-foreground">
                "{restoreTarget?.label}"
              </span>{" "}
              taken on{" "}
              <span className="font-semibold text-foreground">
                {restoreTarget?.date}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              This will replace all current board data
            </p>
            <p className="text-xs leading-relaxed">
              All columns, cards, tags, and comments in the active project will
              be wiped and replaced with this snapshot's data. This action
              cannot be undone. Make sure you've taken a snapshot of the current
              state first if you want to preserve it.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setRestoreTarget(null)}
              disabled={isRestoring}
              data-ocid="snapshots.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={isRestoring}
              className="gap-1.5"
              data-ocid="snapshots.confirm_button"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Restoring…
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore Now
                </>
              )}
            </Button>
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
              Delete "{deleteTarget?.label}"? This cannot be undone.
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
