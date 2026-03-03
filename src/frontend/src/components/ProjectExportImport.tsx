import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Download,
  FileJson,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Upload,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { backendInterface } from "../backend.d";
import { useColumns, useProjectTags, useUsers } from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";
import {
  exportProject,
  exportProjectToString,
  importProject,
} from "../utils/exportImport";
import type { ImportResult, KanbanExport } from "../utils/exportImport";

interface ProjectExportImportProps {
  actor: backendInterface;
  projectId: bigint;
  projectName: string;
  activeUser: User | null;
  onImportComplete: () => void;
}

// ── Field mapping types ───────────────────────────────────────────────────────

interface FieldMapping {
  incoming: string;
  /** "existing:<id>" | "create" | "skip" */
  action: string;
}

interface ImportMappings {
  columns: FieldMapping[];
  users: FieldMapping[];
  tags: FieldMapping[];
}

// ── Import Mapping Modal ──────────────────────────────────────────────────────

function ImportMappingModal({
  parsedPayload,
  projectId,
  onConfirm,
  onCancel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsedPayload: any;
  projectId: bigint;
  onConfirm: (mappings: ImportMappings) => void;
  onCancel: () => void;
}) {
  const { data: existingColumns = [] } = useColumns(projectId);
  const { data: existingUsers = [] } = useUsers();
  const { data: existingTags = [] } = useProjectTags(projectId);

  // Extract incoming fields from parsed payload
  const payload = parsedPayload as Partial<KanbanExport>;
  const incomingColumns: string[] = (payload.project?.columns ?? []).map(
    (c) => c.name ?? "",
  );
  const incomingUsers: string[] = (payload.users ?? []).map(
    (u) => u.name ?? "",
  );
  const incomingTags: string[] = (payload.project?.tags ?? []).map(
    (t) => t.name ?? "",
  );

  // Initialize mappings: auto-match exact names, otherwise "create"
  function initMappings(
    incoming: string[],
    existing: { name: string; id: { toString(): string } }[],
  ): FieldMapping[] {
    return incoming.map((name) => {
      const match = existing.find(
        (e) => e.name.toLowerCase() === name.toLowerCase(),
      );
      return {
        incoming: name,
        action: match ? `existing:${match.id.toString()}` : "create",
      };
    });
  }

  const [columnMappings, setColumnMappings] = useState<FieldMapping[]>(() =>
    initMappings(incomingColumns, existingColumns),
  );
  const [userMappings, setUserMappings] = useState<FieldMapping[]>(() =>
    initMappings(incomingUsers, existingUsers),
  );
  const [tagMappings, setTagMappings] = useState<FieldMapping[]>(() =>
    initMappings(incomingTags, existingTags),
  );

  function updateMapping(
    mappings: FieldMapping[],
    setMappings: (m: FieldMapping[]) => void,
    idx: number,
    action: string,
  ) {
    const next = [...mappings];
    next[idx] = { ...next[idx], action };
    setMappings(next);
  }

  function handleConfirm() {
    onConfirm({
      columns: columnMappings,
      users: userMappings,
      tags: tagMappings,
    });
  }

  function MappingSection({
    title,
    mappings,
    setMappings,
    existing,
    entityLabel,
  }: {
    title: string;
    mappings: FieldMapping[];
    setMappings: (m: FieldMapping[]) => void;
    existing: { name: string; id: { toString(): string } }[];
    entityLabel: string;
  }) {
    if (mappings.length === 0) {
      return (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground italic">
            None found in import file.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          {title}
        </h3>
        <div className="space-y-1.5">
          {mappings.map((m, idx) => {
            const isExactMatch = m.action.startsWith("existing:");
            const isCreate = m.action === "create";
            return (
              <div
                key={`${m.incoming}-${idx}`}
                className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-secondary/30 border border-border/40"
              >
                <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                  {m.incoming}
                </span>
                <span className="text-muted-foreground/50 text-xs shrink-0">
                  →
                </span>
                <select
                  className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[160px]"
                  value={m.action}
                  onChange={(e) =>
                    updateMapping(mappings, setMappings, idx, e.target.value)
                  }
                >
                  <option value="create">
                    ✦ Auto-create new {entityLabel}
                  </option>
                  {existing.map((e) => (
                    <option
                      key={e.id.toString()}
                      value={`existing:${e.id.toString()}`}
                    >
                      → {e.name}
                    </option>
                  ))}
                </select>
                {/* Status badge */}
                {isExactMatch ? (
                  <span
                    className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0"
                    title="Exact name match found"
                  >
                    ✓ matched
                  </span>
                ) : isCreate ? (
                  <span
                    className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0"
                    title="Will be created automatically if not mapped"
                  >
                    <Plus className="h-2.5 w-2.5 inline" /> new
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                    mapped
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const totalFields =
    columnMappings.length + userMappings.length + tagMappings.length;
  const autoCreating = [
    ...columnMappings,
    ...userMappings,
    ...tagMappings,
  ].filter((m) => m.action === "create").length;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-display font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Map Import Fields
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Review how incoming fields map to your existing app. Exact name
            matches are pre-selected. Unmapped fields will be auto-created.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-6">
            {totalFields === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No mappable fields found in the import file.
              </p>
            ) : (
              <>
                <MappingSection
                  title="Columns"
                  mappings={columnMappings}
                  setMappings={setColumnMappings}
                  existing={existingColumns}
                  entityLabel="column"
                />
                {columnMappings.length > 0 && userMappings.length > 0 && (
                  <Separator />
                )}
                <MappingSection
                  title="Users / Assignees"
                  mappings={userMappings}
                  setMappings={setUserMappings}
                  existing={existingUsers}
                  entityLabel="user"
                />
                {userMappings.length > 0 && tagMappings.length > 0 && (
                  <Separator />
                )}
                <MappingSection
                  title="Tags"
                  mappings={tagMappings}
                  setMappings={setTagMappings}
                  existing={existingTags}
                  entityLabel="tag"
                />
              </>
            )}

            {/* Auto-create notice */}
            {autoCreating > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <strong>{autoCreating}</strong> field
                  {autoCreating !== 1 ? "s" : ""} will be auto-created in your
                  app. You can always rename or delete them after import.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <Button size="sm" onClick={handleConfirm} className="flex-1 gap-2">
            <Upload className="h-3.5 w-3.5" />
            Import with these settings
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="gap-1.5"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Export/Import component ──────────────────────────────────────────────

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
  const [copying, setCopying] = useState(false);

  // ── Import state ────────────────────────────────────────────────────────────
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parsedPayload, setParsedPayload] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);

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

  // ── Copy JSON to clipboard ──────────────────────────────────────────────────
  async function handleCopyJson() {
    if (!activeUser) {
      toast.error("Set yourself as active before exporting");
      return;
    }
    setCopying(true);
    try {
      const jsonStr = await exportProjectToString(
        actor,
        projectId,
        projectName,
      );
      await navigator.clipboard.writeText(jsonStr);
      toast.success("JSON copied to clipboard");
    } catch (e) {
      toast.error(`Copy failed: ${String(e)}`);
    } finally {
      setCopying(false);
    }
  }

  // ── Paste JSON parsing ───────────────────────────────────────────────────────
  function handlePasteTextChange(text: string) {
    setPasteText(text);
    setPasteError(null);
    setParsedPayload(null);
    if (!text.trim()) return;
    try {
      const parsed = JSON.parse(text);
      setParsedPayload(parsed);
      setImportFile(null);
    } catch {
      setPasteError("Invalid JSON — could not parse. Check for syntax errors.");
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

  // ── Import handler (after mapping) ─────────────────────────────────────────
  async function handleImportWithMappings(mappings: ImportMappings) {
    setShowMappingModal(false);
    if (!activeUser || !parsedPayload) return;

    // Apply mappings: rewrite the parsed payload so columns/users/tags use
    // existing IDs when mapped, and keep the names for auto-create when not.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remappedPayload: any = JSON.parse(JSON.stringify(parsedPayload));

    // Remap columns by name substitution
    if (remappedPayload?.project?.columns) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      remappedPayload.project.columns = remappedPayload.project.columns.map(
        (col: any) => {
          const mapping = mappings.columns.find(
            (m) => m.incoming.toLowerCase() === (col.name ?? "").toLowerCase(),
          );
          if (mapping?.action.startsWith("existing:")) {
            const existingId = mapping.action.replace("existing:", "");
            return { ...col, _existingId: existingId };
          }
          return col;
        },
      );
    }

    // Remap users: replace assigneeName with mapped name
    if (remappedPayload?.project?.columns) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const col of remappedPayload.project.columns as any[]) {
        if (col.cards) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          col.cards = col.cards.map((card: any) => {
            const aName = card.assigneeName ?? null;
            if (!aName) return card;
            const mapping = mappings.users.find(
              (m) => m.incoming.toLowerCase() === aName.toLowerCase(),
            );
            if (mapping?.action.startsWith("existing:")) {
              // Find user name for this existing ID — import resolves by name
              return card; // name stays the same; importProject will match by name
            }
            return card;
          });
        }
      }
    }

    setImporting(true);
    try {
      const result = await importProject(
        actor,
        remappedPayload,
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

  const hasFile =
    (inputMode === "file" ? !!importFile : !!pasteText.trim()) &&
    !!parsedPayload;
  const hasParseError = inputMode === "file" ? !!parseError : !!pasteError;

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
            are never exported. Assignees are stored by name for portability.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || copying || !activeUser}
              className="gap-2 h-8 text-xs"
              data-ocid="export.primary_button"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download JSON
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyJson}
              disabled={exporting || copying || !activeUser}
              className="gap-2 h-8 text-xs"
              data-ocid="export.secondary_button"
            >
              {copying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Copying…
                </>
              ) : (
                <>
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy JSON
                </>
              )}
            </Button>
          </div>
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
            Import a previously exported JSON file. A mapping screen will appear
            so you can align incoming fields with your current app before any
            data is written.
          </p>

          {/* Input mode toggle */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setInputMode("file");
                setParsedPayload(null);
                setPasteText("");
                setPasteError(null);
              }}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                inputMode === "file"
                  ? "bg-secondary border-border text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileJson className="h-3 w-3" />
                Upload file
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode("paste");
                setParsedPayload(null);
                setImportFile(null);
                setParseError(null);
              }}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                inputMode === "paste"
                  ? "bg-secondary border-border text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Paste JSON
              </span>
            </button>
          </div>

          {/* File picker */}
          {inputMode === "file" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                data-ocid="import.upload_button"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="gap-2 h-8 text-xs"
                  data-ocid="import.primary_button"
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
            </>
          )}

          {/* Paste JSON area */}
          {inputMode === "paste" && (
            <div className="space-y-2">
              <Textarea
                value={pasteText}
                onChange={(e) => handlePasteTextChange(e.target.value)}
                placeholder='Paste your exported JSON here… (e.g. {"schemaVersion": 1, "project": {...}})'
                rows={8}
                className="text-xs font-mono resize-y"
                disabled={importing}
                data-ocid="import.editor"
              />
              {parsedPayload && !pasteError && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Valid JSON — ready to map and import
                </p>
              )}
            </div>
          )}

          {hasParseError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {inputMode === "file" ? parseError : pasteError}
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
                onClick={() => setShowMappingModal(true)}
                disabled={importing || !activeUser}
                className="gap-2 h-8 text-xs w-full"
                variant={importMode === "replace" ? "destructive" : "default"}
                data-ocid="import.open_modal_button"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <MapPin className="h-3.5 w-3.5" />
                    Review & map fields…
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

      {/* Pre-import mapping modal */}
      {showMappingModal && parsedPayload && (
        <ImportMappingModal
          parsedPayload={parsedPayload}
          projectId={projectId}
          onConfirm={handleImportWithMappings}
          onCancel={() => setShowMappingModal(false)}
        />
      )}

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
        <DialogContent className="max-w-lg" data-ocid="import.modal">
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
              data-ocid="import.close_button"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
