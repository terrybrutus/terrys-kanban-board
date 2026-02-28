import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Loader2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type { ColumnView, Tag } from "../backend.d";
import type { User } from "../hooks/useQueries";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedCard {
  title: string;
  description: string | null;
  matchedTagIds: bigint[];
  matchedAssigneeId: bigint | null;
  matchedAssigneeName: string | null;
}

interface ParseWarning {
  message: string;
}

interface CreationError {
  title: string;
  error: string;
}

type Step = "input" | "preview" | "creating" | "done";

interface BulkCardImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected target column (from the column's "..." menu) */
  targetColumn: ColumnView | null;
  columns: ColumnView[];
  projectTags: Tag[];
  users: User[];
  activeUser: User | null;
  onCreateCardWithId: (
    columnId: bigint,
    title: string,
    description: string | null,
  ) => Promise<bigint>;
  onUpdateCardTags: (cardId: bigint, tagIds: bigint[]) => Promise<void>;
  onAssignCard: (cardId: bigint, userId: bigint | null) => Promise<void>;
}

// ─── JSON input shape ─────────────────────────────────────────────────────────

interface RawJsonCard {
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  assigneeId?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTagStyle(color: string): React.CSSProperties {
  // color is a hex or named colour from the backend
  return { backgroundColor: `${color}22`, color, borderColor: `${color}55` };
}

function parsePlainText(text: string): {
  cards: ParsedCard[];
  warnings: ParseWarning[];
} {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const cards: ParsedCard[] = lines.map((title) => ({
    title,
    description: null,
    matchedTagIds: [],
    matchedAssigneeId: null,
    matchedAssigneeName: null,
  }));
  return { cards, warnings: [] };
}

function parseJson(
  text: string,
  projectTags: Tag[],
  users: User[],
): { cards: ParsedCard[]; warnings: ParseWarning[]; error: string | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      cards: [],
      warnings: [],
      error: "Invalid JSON — please check your syntax and try again.",
    };
  }

  if (!Array.isArray(raw)) {
    return {
      cards: [],
      warnings: [],
      error: "JSON must be an array of card objects [ { ... }, ... ]",
    };
  }

  const cards: ParsedCard[] = [];
  const warnings: ParseWarning[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as RawJsonCard;

    if (typeof item !== "object" || item === null) {
      warnings.push({
        message: `Item at index ${i} is not an object — skipped.`,
      });
      continue;
    }

    const title = typeof item.title === "string" ? item.title.trim() : null;
    if (!title) {
      warnings.push({
        message: `Item at index ${i} is missing a "title" string — skipped.`,
      });
      continue;
    }

    const description =
      typeof item.description === "string" && item.description.trim()
        ? item.description.trim()
        : null;

    // Resolve tags by name (case-insensitive)
    const matchedTagIds: bigint[] = [];
    if (Array.isArray(item.tags)) {
      for (const tagName of item.tags) {
        if (typeof tagName !== "string") continue;
        const found = projectTags.find(
          (t) => t.name.toLowerCase() === tagName.toLowerCase(),
        );
        if (found) {
          matchedTagIds.push(found.id);
        } else {
          warnings.push({
            message: `Card "${title}": tag "${tagName}" not found in this project — ignored.`,
          });
        }
      }
    }

    // Resolve assignee by userId string
    let matchedAssigneeId: bigint | null = null;
    let matchedAssigneeName: string | null = null;
    if (item.assigneeId !== undefined && item.assigneeId !== null) {
      const idStr = String(item.assigneeId);
      const found = users.find((u) => u.id.toString() === idStr);
      if (found) {
        matchedAssigneeId = found.id;
        matchedAssigneeName = found.name;
      } else {
        warnings.push({
          message: `Card "${title}": assigneeId "${idStr}" not found — assignee ignored.`,
        });
      }
    }

    cards.push({
      title,
      description,
      matchedTagIds,
      matchedAssigneeId,
      matchedAssigneeName,
    });
  }

  return { cards, warnings, error: null };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkCardImport({
  open,
  onOpenChange,
  targetColumn,
  columns,
  projectTags,
  users,
  activeUser,
  onCreateCardWithId,
  onUpdateCardTags,
  onAssignCard,
}: BulkCardImportProps) {
  const [step, setStep] = useState<Step>("input");
  const [inputTab, setInputTab] = useState<"plaintext" | "json">("plaintext");
  const [plainText, setPlainText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>(
    targetColumn?.id.toString() ?? columns[0]?.id.toString() ?? "",
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [parseWarnings, setParseWarnings] = useState<ParseWarning[]>([]);

  // Creating step state
  const [creatingProgress, setCreatingProgress] = useState(0);
  const [creationErrors, setCreationErrors] = useState<CreationError[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  // Sync the column selector when the modal opens with a new pre-selected column
  const lastOpenRef = { current: false };
  if (open && !lastOpenRef.current) {
    lastOpenRef.current = true;
  }

  // Reset all state on close
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setStep("input");
      setPlainText("");
      setJsonText("");
      setParseError(null);
      setParsedCards([]);
      setParseWarnings([]);
      setCreatingProgress(0);
      setCreationErrors([]);
      setDoneCount(0);
      setSelectedColumnId(
        targetColumn?.id.toString() ?? columns[0]?.id.toString() ?? "",
      );
    }
    onOpenChange(isOpen);
  }

  // Update column when targetColumn prop changes while modal is opening
  const effectiveColumnId =
    step === "input"
      ? selectedColumnId ||
        targetColumn?.id.toString() ||
        columns[0]?.id.toString() ||
        ""
      : selectedColumnId;

  function handlePreview() {
    setParseError(null);

    if (inputTab === "plaintext") {
      if (!plainText.trim()) return;
      const { cards, warnings } = parsePlainText(plainText);
      setParsedCards(cards);
      setParseWarnings(warnings);
      setStep("preview");
    } else {
      if (!jsonText.trim()) return;
      const { cards, warnings, error } = parseJson(
        jsonText,
        projectTags,
        users,
      );
      if (error) {
        setParseError(error);
        return;
      }
      if (cards.length === 0) {
        setParseError("No valid cards found in your JSON.");
        return;
      }
      setParsedCards(cards);
      setParseWarnings(warnings);
      setStep("preview");
    }
  }

  async function handleCreate() {
    if (!activeUser) return;

    const colId = BigInt(effectiveColumnId);
    setStep("creating");
    setCreatingProgress(0);
    setCreationErrors([]);

    let successCount = 0;
    const errors: CreationError[] = [];

    for (let i = 0; i < parsedCards.length; i++) {
      const card = parsedCards[i];
      setCreatingProgress(i + 1);

      try {
        const newCardId = await onCreateCardWithId(
          colId,
          card.title,
          card.description,
        );

        // Apply tags if any
        if (card.matchedTagIds.length > 0) {
          try {
            await onUpdateCardTags(newCardId, card.matchedTagIds);
          } catch {
            // Tag application failure is non-fatal
          }
        }

        // Apply assignee if any
        if (card.matchedAssigneeId !== null) {
          try {
            await onAssignCard(newCardId, card.matchedAssigneeId);
          } catch {
            // Assignee failure is non-fatal
          }
        }

        successCount++;
      } catch (err) {
        errors.push({
          title: card.title,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    setDoneCount(successCount);
    setCreationErrors(errors);
    setStep("done");
  }

  const inputIsEmpty =
    inputTab === "plaintext" ? !plainText.trim() : !jsonText.trim();

  const resolvedTargetColumnName =
    columns.find((c) => c.id.toString() === effectiveColumnId)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="text-base font-display flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            Bulk Import Cards
          </DialogTitle>
        </DialogHeader>

        {/* ── Step: Input ──────────────────────────────────────────────────── */}
        {step === "input" && (
          <div className="space-y-4 pt-1">
            <Tabs
              value={inputTab}
              onValueChange={(v) => {
                setInputTab(v as "plaintext" | "json");
                setParseError(null);
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="plaintext" className="flex-1 text-xs">
                  Plain Text
                </TabsTrigger>
                <TabsTrigger value="json" className="flex-1 text-xs">
                  JSON
                </TabsTrigger>
              </TabsList>

              <TabsContent value="plaintext" className="mt-3">
                <Textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder={
                    "One card title per line:\n\nPriority 22\nPriority 23\nPriority 24"
                  }
                  rows={8}
                  className="text-sm font-mono resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Each non-empty line becomes one card title.
                </p>
              </TabsContent>

              <TabsContent value="json" className="mt-3">
                <Textarea
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setParseError(null);
                  }}
                  placeholder={`[\n  { "title": "Priority 22", "description": "Ready for delivery", "tags": ["Active"], "assigneeId": "123" },\n  { "title": "Priority 23" }\n]`}
                  rows={8}
                  className="text-sm font-mono resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Array of objects. Only{" "}
                  <span className="font-mono text-foreground">title</span> is
                  required.{" "}
                  <span className="font-mono text-foreground">tags</span> are
                  matched by name.{" "}
                  <span className="font-mono text-foreground">assigneeId</span>{" "}
                  is matched by user ID.
                </p>
              </TabsContent>
            </Tabs>

            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/25 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{parseError}</p>
              </div>
            )}

            {/* Target column selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">
                Target column
              </span>
              <Select
                value={effectiveColumnId}
                onValueChange={setSelectedColumnId}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Select a column…" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem
                      key={col.id.toString()}
                      value={col.id.toString()}
                    >
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePreview}
                disabled={inputIsEmpty || !effectiveColumnId}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Preview ────────────────────────────────────────────────── */}
        {step === "preview" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Preview —{" "}
                <span className="text-primary">{parsedCards.length}</span> card
                {parsedCards.length !== 1 ? "s" : ""} to create
              </h3>
              <span className="text-xs text-muted-foreground">
                → {resolvedTargetColumnName}
              </span>
            </div>

            {/* Warnings */}
            {parseWarnings.length > 0 && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/25 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {parseWarnings.length} warning
                    {parseWarnings.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {parseWarnings.map((w) => (
                  <p
                    key={w.message}
                    className="text-xs text-amber-700 dark:text-amber-400"
                  >
                    • {w.message}
                  </p>
                ))}
              </div>
            )}

            {/* Card list */}
            <ScrollArea className="max-h-72 rounded-md border border-border">
              <div className="divide-y divide-border">
                {parsedCards.map((card, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parsed cards have no stable ID
                  <div key={i} className="px-3 py-2.5 space-y-1">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {card.title}
                    </p>
                    {card.description && (
                      <p className="text-xs text-muted-foreground leading-snug">
                        {card.description}
                      </p>
                    )}
                    {(card.matchedTagIds.length > 0 ||
                      card.matchedAssigneeName) && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {card.matchedTagIds.map((tagId) => {
                          const tag = projectTags.find((t) => t.id === tagId);
                          if (!tag) return null;
                          return (
                            <Badge
                              key={tagId.toString()}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 font-normal border"
                              style={getTagStyle(tag.color)}
                            >
                              {tag.name}
                            </Badge>
                          );
                        })}
                        {card.matchedAssigneeName && (
                          <span className="text-[10px] text-muted-foreground">
                            → {card.matchedAssigneeName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("input")}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button size="sm" onClick={handleCreate} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Create {parsedCards.length} card
                {parsedCards.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Creating ───────────────────────────────────────────────── */}
        {step === "creating" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Creating card {creatingProgress} of {parsedCards.length}…
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Please don't close this window
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-xs h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${(creatingProgress / parsedCards.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Step: Done ───────────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Done! <span className="text-primary">{doneCount}</span> card
                  {doneCount !== 1 ? "s" : ""} created
                </p>
                <p className="text-xs text-muted-foreground">
                  in column &ldquo;{resolvedTargetColumnName}&rdquo;
                </p>
              </div>
            </div>

            {creationErrors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/25 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <span className="text-xs font-semibold text-destructive">
                    {creationErrors.length} card
                    {creationErrors.length !== 1 ? "s" : ""} failed
                  </span>
                </div>
                <ScrollArea className="max-h-28">
                  {creationErrors.map((e, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: creation errors have no stable ID
                    <p key={i} className="text-xs text-destructive">
                      • {e.title}: {e.error}
                    </p>
                  ))}
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
