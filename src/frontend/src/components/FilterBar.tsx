import { Input } from "@/components/ui/input";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import type { FilterPreset, Tag } from "../backend.d";
import type { User } from "../hooks/useQueries";

export interface FilterState {
  assigneeId: bigint | null;
  tagIds: string[];
  unassignedOnly: boolean;
  textSearch: string;
  dateField: "createdAt" | "dueDate" | null;
  dateFrom: string;
  dateTo: string;
  showArchived: boolean;
}

export const EMPTY_FILTER: FilterState = {
  assigneeId: null,
  tagIds: [],
  unassignedOnly: false,
  textSearch: "",
  dateField: null,
  dateFrom: "",
  dateTo: "",
  showArchived: false,
};

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  users: User[];
  tags: Tag[];
  presets?: FilterPreset[];
  activeUser?: User | null;
  onSavePreset?: (name: string) => Promise<void>;
  onDeletePreset?: (presetId: bigint) => Promise<void>;
  onApplyPreset?: (preset: FilterPreset) => void;
}

function isFilterActive(filters: FilterState): boolean {
  return (
    filters.assigneeId !== null ||
    filters.tagIds.length > 0 ||
    filters.unassignedOnly ||
    filters.textSearch !== "" ||
    filters.dateField !== null ||
    filters.showArchived
  );
}

export default function FilterBar({
  filters,
  onChange,
  users,
  tags,
  presets,
  activeUser,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Close presets dropdown when clicking outside
  const handlePresetsBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!presetsRef.current?.contains(e.relatedTarget as Node)) {
      setPresetsOpen(false);
    }
  };

  const hasFilters = isFilterActive(filters);
  const chipCount = [
    filters.assigneeId !== null,
    filters.tagIds.length > 0,
    filters.unassignedOnly,
    filters.textSearch !== "",
    filters.dateField !== null,
    filters.showArchived,
  ].filter(Boolean).length;

  function patch(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }

  function removeTag(tagId: string) {
    patch({ tagIds: filters.tagIds.filter((id) => id !== tagId) });
  }

  const assigneeName = filters.assigneeId
    ? users.find((u) => u.id === filters.assigneeId)?.name
    : null;

  async function handleSavePreset() {
    const trimmed = presetName.trim();
    if (!trimmed || !onSavePreset) return;
    setIsSaving(true);
    try {
      await onSavePreset(trimmed);
      setPresetName("");
      setShowSaveInput(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeletePreset(presetId: bigint) {
    if (!onDeletePreset) return;
    setDeletingId(presetId);
    try {
      await onDeletePreset(presetId);
    } finally {
      setDeletingId(null);
    }
  }

  function canDeletePreset(preset: FilterPreset): boolean {
    if (!activeUser) return false;
    return (
      activeUser.id === preset.createdByUserId ||
      activeUser.isAdmin ||
      activeUser.isMasterAdmin
    );
  }

  const showPresetsDropdown = presets !== undefined;
  const showSaveButton =
    hasFilters && !!activeUser && !!onSavePreset && !showSaveInput;

  return (
    <div
      className={`border-b border-border bg-card/50 backdrop-blur-sm transition-all ${
        hasFilters ? "border-primary/20" : ""
      }`}
    >
      {/* Collapsed state: filter trigger + active chips */}
      <div className="flex items-center gap-2 px-6 py-2 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
            expanded
              ? "bg-secondary text-foreground border-border"
              : hasFilters
                ? "bg-primary/10 text-primary border-primary/25 hover:bg-primary/15"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {chipCount > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center leading-none">
              {chipCount}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {/* Presets dropdown */}
        {showPresetsDropdown && (
          <div
            ref={presetsRef}
            className="relative"
            onBlur={handlePresetsBlur}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={() => setPresetsOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                presetsOpen
                  ? "bg-secondary text-foreground border-border"
                  : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Presets
              {presets && presets.length > 0 && (
                <span className="bg-muted text-muted-foreground rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center leading-none">
                  {presets.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3" />
            </button>

            {presetsOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                {!presets || presets.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                    No saved presets yet
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {presets.map((preset) => (
                      <div
                        key={preset.id.toString()}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/60 group transition-colors"
                      >
                        <button
                          type="button"
                          className="flex-1 text-left text-sm text-foreground truncate"
                          onClick={() => {
                            onApplyPreset?.(preset);
                            setPresetsOpen(false);
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <BookmarkCheck className="h-3 w-3 text-primary shrink-0 opacity-60" />
                            <span className="truncate">{preset.name}</span>
                          </span>
                        </button>
                        {canDeletePreset(preset) && (
                          <button
                            type="button"
                            disabled={deletingId === preset.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePreset(preset.id);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                            title="Delete preset"
                          >
                            {deletingId === preset.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save as preset button / inline input */}
        {showSaveButton && (
          <button
            type="button"
            onClick={() => {
              setShowSaveInput(true);
              setTimeout(() => saveInputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Save as preset
          </button>
        )}

        {showSaveInput && (
          <div className="flex items-center gap-1.5">
            <Input
              ref={saveInputRef}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
                if (e.key === "Escape") {
                  setShowSaveInput(false);
                  setPresetName("");
                }
              }}
              placeholder="Preset name…"
              className="h-7 text-xs w-40"
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!presetName.trim() || isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSaveInput(false);
                setPresetName("");
              }}
              disabled={isSaving}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Active filter chips */}
        {filters.textSearch && (
          <FilterChip
            label={`"${filters.textSearch.length > 20 ? `${filters.textSearch.slice(0, 20)}…` : filters.textSearch}"`}
            onRemove={() => patch({ textSearch: "" })}
            color="blue"
          />
        )}
        {assigneeName && (
          <FilterChip
            label={`Assignee: ${assigneeName}`}
            onRemove={() => patch({ assigneeId: null })}
            color="violet"
          />
        )}
        {filters.unassignedOnly && (
          <FilterChip
            label="Unassigned only"
            onRemove={() => patch({ unassignedOnly: false })}
            color="amber"
          />
        )}
        {filters.tagIds.map((tagId) => {
          const tag = tags.find((t) => t.id.toString() === tagId);
          if (!tag) return null;
          return (
            <button
              key={tagId}
              type="button"
              onClick={() => removeTag(tagId)}
              className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80 group"
              style={{
                backgroundColor: `${tag.color}22`,
                color: tag.color,
                borderColor: `${tag.color}44`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <X className="h-2.5 w-2.5 opacity-70 group-hover:opacity-100" />
            </button>
          );
        })}
        {filters.dateField && (
          <FilterChip
            label={`${filters.dateField === "createdAt" ? "Created" : "Due"}${filters.dateFrom ? ` from ${filters.dateFrom}` : ""}${filters.dateTo ? ` to ${filters.dateTo}` : ""}`}
            onRemove={() =>
              patch({ dateField: null, dateFrom: "", dateTo: "" })
            }
            color="emerald"
          />
        )}
        {filters.showArchived && (
          <FilterChip
            label="Showing archived"
            onRemove={() => patch({ showArchived: false })}
            color="rose"
          />
        )}

        {/* Clear all */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {expanded && (
        <div className="px-6 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-border/50">
          {/* Text search */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-search"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                id="filter-search"
                value={filters.textSearch}
                onChange={(e) => patch({ textSearch: e.target.value })}
                placeholder="Title or description…"
                className="pl-8 h-8 text-sm"
              />
              {filters.textSearch && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => patch({ textSearch: "" })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Assignee filter */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-assignee"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Assignee
            </label>
            <div className="flex gap-1.5">
              <select
                id="filter-assignee"
                className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={filters.assigneeId?.toString() ?? ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    patch({ assigneeId: null });
                  } else {
                    patch({
                      assigneeId: BigInt(e.target.value),
                      unassignedOnly: false,
                    });
                  }
                }}
              >
                <option value="">Any assignee</option>
                {users.map((u) => (
                  <option key={u.id.toString()} value={u.id.toString()}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded accent-primary"
                checked={filters.unassignedOnly}
                onChange={(e) =>
                  patch({
                    unassignedOnly: e.target.checked,
                    assigneeId: e.target.checked ? null : filters.assigneeId,
                  })
                }
              />
              <span className="text-xs text-muted-foreground">
                Unassigned only
              </span>
            </label>
          </div>

          {/* Tag filter */}
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = filters.tagIds.includes(tag.id.toString());
                  return (
                    <button
                      key={tag.id.toString()}
                      type="button"
                      onClick={() => {
                        if (active) {
                          patch({
                            tagIds: filters.tagIds.filter(
                              (id) => id !== tag.id.toString(),
                            ),
                          });
                        } else {
                          patch({
                            tagIds: [...filters.tagIds, tag.id.toString()],
                          });
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                        active
                          ? "opacity-100 ring-1 ring-offset-1 ring-current"
                          : "opacity-50 hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor: `${tag.color}22`,
                        color: tag.color,
                        borderColor: `${tag.color}44`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Archived toggle */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Archived Cards
            </p>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded accent-primary"
                checked={filters.showArchived}
                onChange={(e) => patch({ showArchived: e.target.checked })}
              />
              <span className="text-xs text-muted-foreground">
                Show archived cards
              </span>
            </label>
          </div>

          {/* Date range filter */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-date-field"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Date Range
            </label>
            <select
              id="filter-date-field"
              className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.dateField ?? ""}
              onChange={(e) => {
                const val = e.target.value as "createdAt" | "dueDate" | "";
                patch({
                  dateField: val || null,
                  dateFrom: "",
                  dateTo: "",
                });
              }}
            >
              <option value="">No date filter</option>
              <option value="createdAt">Created date</option>
              <option value="dueDate">Due date</option>
            </select>
            {filters.dateField && (
              <div className="flex gap-1.5 items-center mt-1.5">
                <input
                  type="date"
                  className="flex-1 h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={filters.dateFrom}
                  onChange={(e) => patch({ dateFrom: e.target.value })}
                  placeholder="From"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  –
                </span>
                <input
                  type="date"
                  className="flex-1 h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={filters.dateTo}
                  onChange={(e) => patch({ dateTo: e.target.value })}
                  placeholder="To"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FilterChip helper ─────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
  color,
}: {
  label: string;
  onRemove: () => void;
  color: "blue" | "violet" | "amber" | "emerald" | "rose";
}) {
  const colorMap = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
    violet:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
    amber:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    emerald:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
  };

  return (
    <button
      type="button"
      onClick={onRemove}
      className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80 group ${colorMap[color]}`}
    >
      {label}
      <X className="h-2.5 w-2.5 opacity-70 group-hover:opacity-100" />
    </button>
  );
}
