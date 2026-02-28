import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { backendInterface } from "../backend.d";
import type { User } from "../hooks/useQueries";
import { exportProject, importProject } from "../utils/exportImport";
import type { ImportResult } from "../utils/exportImport";

interface ProjectExportImportProps {
  actor: backendInterface;
  projectId: bigint;
  projectName: string;
  activeUser: User | null;
  onImportComplete: () => void;
}

export default function ProjectExportImport({
  actor,
  projectId,
  projectName,
  activeUser,
  onImportComplete,
}: ProjectExportImportProps) {
  const queryClient = useQueryClient();

  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // ── Import state ────────────────────────────────────────────────────────────
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [importFile, setImportFile] = useState<File | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parsedPayload, setParsedPayload] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export handler ──────────────────────────────────────────────────────────
  async function handleExport() {
    if (!activeUser) {
      toast.error("Set yourself as active before exporting");
      return;
    }
    setExporting(true);
    try {
      await exportProject(actor, projectId, projectName);
      toast.success("Project exported successfully");
    } catch (e) {
      toast.error(`Export failed: ${String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  // ── File selection ──────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setParsedPayload(null);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        setParsedPayload(parsed);
      } catch {
        setParseError("Invalid JSON file — could not parse.");
        setParsedPayload(null);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  // ── Import handler ──────────────────────────────────────────────────────────
  async function handleImport() {
    if (!activeUser) {
      toast.error("Set yourself as active before importing");
      return;
    }
    if (!parsedPayload) {
      toast.error("Please select a valid JSON file first");
      return;
    }

    setImporting(true);
    try {
      const result = await importProject(
        actor,
        parsedPayload,
        projectId,
        activeUser.id,
        importMode,
      );
      setImportResult(result);
      setResultModalOpen(true);

      if (result.success) {
        toast.success("Import completed successfully");
      } else {
        toast.error(
          "Import completed with errors — check the result for details",
        );
      }

      // Invalidate all queries so board data refreshes
      await queryClient.invalidateQueries();
      onImportComplete();

      // Reset file state
      setImportFile(null);
      setParsedPayload(null);
    } catch (e) {
      toast.error(`Import failed unexpectedly: ${String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  const hasFile = !!importFile && !!parsedPayload;
  const hasParseError = !!parseError;

  return (
    <>
      <div className="space-y-5">
        {/* Export section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Export project
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Download a full snapshot of this project as JSON. Includes all
            columns, cards, tags, comments, history, and filter presets. PINs
            are never exported.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || !activeUser}
            className="gap-2 h-8 text-xs"
          >
            {exporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </>
            )}
          </Button>
          {!activeUser && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Set an active user to enable export.
            </p>
          )}
        </div>

        <Separator />

        {/* Import section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Import project
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Import a previously exported JSON file. Choose whether to replace
            all data or merge new items.
          </p>

          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-2 h-8 text-xs"
            >
              <FileJson className="h-3.5 w-3.5" />
              Choose JSON file
            </Button>
            {importFile && (
              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                {importFile.name}
              </span>
            )}
          </div>

          {hasParseError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {parseError}
            </p>
          )}

          {hasFile && (
            <div className="space-y-3 pt-1">
              {/* Import mode selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Import mode
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                        Merge
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Add new items; skip existing ones and report conflicts
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground group-hover:text-destructive transition-colors">
                        Replace
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Wipe this project and replace all data with the import
                        file
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {importMode === "replace" && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    Replace mode will permanently delete all current columns,
                    cards, and tags in this project before importing.
                  </p>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || !activeUser}
                className="gap-2 h-8 text-xs w-full"
                variant={importMode === "replace" ? "destructive" : "default"}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Confirm import ({importMode})
                  </>
                )}
              </Button>

              {!activeUser && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Set an active user to enable import.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Import result modal */}
      <Dialog
        open={resultModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setResultModalOpen(false);
            setWarningsExpanded(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              {importResult?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Import Complete
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Import Completed with Errors
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {importResult && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-2">
                {/* Counts table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                          Item
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          Imported
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Users",
                          count: importResult.counts.usersImported,
                        },
                        {
                          label: "Columns",
                          count: importResult.counts.columnsImported,
                        },
                        {
                          label: "Cards",
                          count: importResult.counts.cardsImported,
                        },
                        {
                          label: "Tags",
                          count: importResult.counts.tagsImported,
                        },
                        {
                          label: "Comments",
                          count: importResult.counts.commentsImported,
                        },
                        {
                          label: "Filter Presets",
                          count: importResult.counts.filterPresetsImported,
                        },
                      ].map(({ label, count }) => (
                        <tr
                          key={label}
                          className="border-t border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-1.5 text-foreground">
                            {label}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-medium text-foreground">
                            {count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Unassigned cards section */}
                {importResult.unassignedCardCount > 0 && (
                  <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        {importResult.unassignedCardCount} card
                        {importResult.unassignedCardCount !== 1 ? "s" : ""}{" "}
                        could not be placed — column not found
                      </p>
                    </div>
                    <ul className="space-y-0.5 pl-6">
                      {importResult.unassignedCardTitles.map((title) => (
                        <li
                          key={title}
                          className="text-xs text-amber-700 dark:text-amber-400 list-disc"
                        >
                          {title}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      These cards were not imported. Fix the{" "}
                      <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                        columnId
                      </code>{" "}
                      in your JSON and re-import, or create them manually in the
                      correct column.
                    </p>
                  </div>
                )}

                {/* Warnings */}
                {importResult.warnings.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setWarningsExpanded((p) => !p)}
                      className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors w-full text-left"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {importResult.warnings.length} warning
                      {importResult.warnings.length !== 1 ? "s" : ""}
                      {warningsExpanded ? (
                        <ChevronUp className="h-3 w-3 ml-auto" />
                      ) : (
                        <ChevronDown className="h-3 w-3 ml-auto" />
                      )}
                    </button>
                    {warningsExpanded && (
                      <ul className="space-y-1 pl-5">
                        {importResult.warnings.map((w) => (
                          <li
                            key={w}
                            className="text-xs text-amber-700 dark:text-amber-400 list-disc leading-relaxed"
                          >
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs font-semibold text-destructive">
                        {importResult.errors.length} error
                        {importResult.errors.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ul className="space-y-1 pl-5">
                      {importResult.errors.map((e) => (
                        <li
                          key={e}
                          className="text-xs text-destructive list-disc leading-relaxed"
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="pt-1">
            <Button
              size="sm"
              onClick={() => {
                setResultModalOpen(false);
                setWarningsExpanded(false);
              }}
              className="w-full h-8 text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
